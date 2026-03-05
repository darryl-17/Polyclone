import { eq, desc, and, like, gte, lte, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, 
  users,
  markets,
  bets,
  portfolios,
  comments,
  newsArticles,
  priceHistory,
  notifications,
  stripeTransactions,
  aiPredictions,
  type Market,
  type Bet,
  type Portfolio,
  type Comment,
  type NewsArticle,
  type PriceHistory,
  type Notification,
  type StripeTransaction,
  type AIPrediction,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ===== MARKETS =====
export async function getMarkets(
  category?: string,
  search?: string,
  limit: number = 20,
  offset: number = 0
) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];
  if (category) {
    conditions.push(eq(markets.category, category));
  }
  if (search) {
    conditions.push(like(markets.title, `%${search}%`));
  }

  if (conditions.length > 0) {
    return await db.select().from(markets)
      .where(and(...conditions))
      .orderBy(desc(markets.createdAt))
      .limit(limit)
      .offset(offset);
  }

  return await db.select().from(markets)
    .orderBy(desc(markets.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getMarketById(id: number): Promise<Market | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(markets).where(eq(markets.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createMarket(data: {
  title: string;
  description?: string;
  category: string;
  subcategory?: string;
  imageUrl?: string;
  endsAt: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(markets).values(data);
  return result;
}

export async function updateMarketPrice(
  marketId: number,
  yesPrice: number,
  noPrice: number,
  volume: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(markets)
    .set({
      yesPrice: yesPrice.toString(),
      noPrice: noPrice.toString(),
      volume24h: volume.toString(),
      updatedAt: new Date(),
    })
    .where(eq(markets.id, marketId));
}

// ===== BETS =====
export async function placeBet(data: {
  userId: number;
  marketId: number;
  outcome: "yes" | "no";
  amount: number;
  priceAtBet: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(bets).values({
    userId: data.userId,
    marketId: data.marketId,
    outcome: data.outcome,
    amount: data.amount.toString(),
    priceAtBet: data.priceAtBet.toString(),
  });
  return result;
}

export async function getUserBets(userId: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(bets)
    .where(eq(bets.userId, userId))
    .orderBy(desc(bets.createdAt))
    .limit(limit);
}

export async function getMarketBets(marketId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(bets)
    .where(eq(bets.marketId, marketId));
}

export async function settleBet(betId: number, payout: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(bets)
    .set({
      settledAt: new Date(),
      payout: payout.toString(),
      updatedAt: new Date(),
    } as any)
    .where(eq(bets.id, betId));
}

// ===== PORTFOLIOS =====
export async function getOrCreatePortfolio(userId: number): Promise<Portfolio> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  let portfolio = await db.select().from(portfolios)
    .where(eq(portfolios.userId, userId))
    .limit(1);

  if (portfolio.length === 0) {
    await db.insert(portfolios).values({
      userId,
      balance: "0",
      totalInvested: "0",
      totalReturns: "0",
    });
    portfolio = await db.select().from(portfolios)
      .where(eq(portfolios.userId, userId))
      .limit(1);
  }

  return portfolio[0]!;
}

export async function updatePortfolioBalance(userId: number, newBalance: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(portfolios)
    .set({
      balance: newBalance.toString(),
      updatedAt: new Date(),
    })
    .where(eq(portfolios.userId, userId));
}

export async function updatePortfolioStats(
  userId: number,
  totalInvested: number,
  totalReturns: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(portfolios)
    .set({
      totalInvested: totalInvested.toString(),
      totalReturns: totalReturns.toString(),
      updatedAt: new Date(),
    })
    .where(eq(portfolios.userId, userId));
}

// ===== COMMENTS =====
export async function getMarketComments(marketId: number, limit: number = 20) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(comments)
    .where(eq(comments.marketId, marketId))
    .orderBy(desc(comments.createdAt))
    .limit(limit);
}

export async function createComment(data: {
  userId: number;
  marketId: number;
  content: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(comments).values(data);
  return result;
}

// ===== NEWS =====
export async function getMarketNews(marketId: number, limit: number = 10) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(newsArticles)
    .where(eq(newsArticles.marketId, marketId))
    .orderBy(desc(newsArticles.publishedAt))
    .limit(limit);
}

export async function createNewsArticle(data: {
  marketId: number;
  title: string;
  source?: string;
  url?: string;
  imageUrl?: string;
  summary?: string;
  publishedAt?: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(newsArticles).values(data);
  return result;
}

// ===== PRICE HISTORY =====
export async function getPriceHistory(
  marketId: number,
  hours: number = 24
) {
  const db = await getDb();
  if (!db) return [];

  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  return await db.select().from(priceHistory)
    .where(
      and(
        eq(priceHistory.marketId, marketId),
        gte(priceHistory.recordedAt, since)
      )
    )
    .orderBy(priceHistory.recordedAt);
}

export async function recordPriceHistory(data: {
  marketId: number;
  yesPrice: number;
  noPrice: number;
  volume?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(priceHistory).values({
    marketId: data.marketId,
    yesPrice: data.yesPrice.toString(),
    noPrice: data.noPrice.toString(),
    volume: data.volume?.toString() || "0",
  });
  return result;
}

// ===== NOTIFICATIONS =====
export async function createNotification(data: {
  userId: number;
  marketId?: number;
  type: "market_resolved" | "price_threshold" | "market_ending" | "new_comment" | "deposit_confirmed" | "withdrawal_processed";
  title: string;
  message?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(notifications).values(data);
  return result;
}

export async function getUserNotifications(userId: number, limit: number = 20) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function markNotificationAsRead(notificationId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(notifications)
    .set({ isRead: true })
    .where(eq(notifications.id, notificationId));
}

// ===== STRIPE TRANSACTIONS =====
export async function createStripeTransaction(data: {
  userId: number;
  stripePaymentIntentId?: string;
  type: "deposit" | "withdrawal";
  amount: number;
  status?: "pending" | "completed" | "failed" | "cancelled";
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(stripeTransactions).values({
    userId: data.userId,
    stripePaymentIntentId: data.stripePaymentIntentId,
    type: data.type,
    amount: data.amount.toString(),
    status: data.status || "pending",
  });
  return result;
}

export async function updateStripeTransactionStatus(
  transactionId: number,
  status: "pending" | "completed" | "failed" | "cancelled"
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(stripeTransactions)
    .set({
      status,
      updatedAt: new Date(),
    })
    .where(eq(stripeTransactions.id, transactionId));
}

export async function getUserStripeTransactions(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(stripeTransactions)
    .where(eq(stripeTransactions.userId, userId))
    .orderBy(desc(stripeTransactions.createdAt));
}

// ===== AI PREDICTIONS =====
export async function createAIPrediction(data: {
  marketId: number;
  prediction: string;
  confidence?: number;
  reasoning?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(aiPredictions).values({
    marketId: data.marketId,
    prediction: data.prediction,
    confidence: data.confidence?.toString(),
    reasoning: data.reasoning,
  });
  return result;
}

export async function getMarketAIPrediction(marketId: number): Promise<AIPrediction | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(aiPredictions)
    .where(eq(aiPredictions.marketId, marketId))
    .orderBy(desc(aiPredictions.createdAt))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ===== LEADERBOARD =====
export async function getLeaderboard(limit: number = 50) {
  const db = await getDb();
  if (!db) return [];

  return await db.select({
    userId: portfolios.userId,
    totalReturns: portfolios.totalReturns,
    balance: portfolios.balance,
    totalInvested: portfolios.totalInvested,
    userName: users.name,
    userAvatar: users.avatar,
  })
    .from(portfolios)
    .innerJoin(users, eq(portfolios.userId, users.id))
    .orderBy(desc(portfolios.totalReturns))
    .limit(limit);
}
