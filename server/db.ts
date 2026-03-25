import { eq, desc, asc, and, like, gte, lte, isNull } from "drizzle-orm";
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
  trades,
  positions,
  watchlists,
  users,
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
import { ENV } from "./_core/env";
import {
  applyBuyImpact,
  applySellImpact,
  parseCents,
  proceedsFromSellShares,
  sanitizeSearchTerm,
  sharesFromBuyUsd,
} from "./services/predictionMarket";

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
export type MarketSort = "new" | "trending" | "ending" | "volume24h";

export async function getMarkets(
  category?: string,
  search?: string,
  limit: number = 20,
  offset: number = 0,
  options?: {
    sort?: MarketSort;
    liveOnly?: boolean;
  }
) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];
  if (category) {
    conditions.push(eq(markets.category, category));
  }
  if (search) {
    const safe = sanitizeSearchTerm(search);
    if (safe.length > 0) {
      conditions.push(like(markets.title, `%${safe}%`));
    }
  }
  if (options?.liveOnly !== false) {
    conditions.push(isNull(markets.resolvedAt));
  }

  const whereClause =
    conditions.length > 0 ? and(...conditions) : undefined;
  const sort = options?.sort ?? "new";

  const orderBy =
    sort === "trending"
      ? [desc(markets.totalVolume), desc(markets.createdAt)]
      : sort === "volume24h"
        ? [desc(markets.volume24h), desc(markets.createdAt)]
        : sort === "ending"
          ? [asc(markets.endsAt)]
          : [desc(markets.createdAt)];

  const q = db.select().from(markets);
  if (whereClause) {
    return await q
      .where(whereClause)
      .orderBy(...orderBy)
      .limit(limit)
      .offset(offset);
  }

  return await q.orderBy(...orderBy).limit(limit).offset(offset);
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

// ===== BETS / TRADES =====
async function upsertPositionAfterBuy(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  userId: number,
  marketId: number,
  outcome: "yes" | "no",
  addShares: number,
  priceCents: number
): Promise<void> {
  const existing = await db
    .select()
    .from(positions)
    .where(
      and(
        eq(positions.userId, userId),
        eq(positions.marketId, marketId),
        eq(positions.outcome, outcome)
      )
    )
    .limit(1);

  if (existing.length === 0) {
    await db.insert(positions).values({
      userId,
      marketId,
      outcome,
      shares: addShares.toFixed(8),
      avgPriceCents: priceCents.toFixed(4),
    });
    return;
  }

  const row = existing[0]!;
  const oldShares = parseFloat(String(row.shares));
  const oldAvg = parseFloat(String(row.avgPriceCents));
  const newShares = oldShares + addShares;
  const newAvg =
    newShares === 0
      ? priceCents
      : (oldShares * oldAvg + addShares * priceCents) / newShares;

  await db
    .update(positions)
    .set({
      shares: newShares.toFixed(8),
      avgPriceCents: newAvg.toFixed(4),
      updatedAt: new Date(),
    })
    .where(eq(positions.id, row.id));
}

export async function executeBuyTrade(data: {
  userId: number;
  marketId: number;
  outcome: "yes" | "no";
  amountUsd: number;
}): Promise<{
  yesPrice: number;
  noPrice: number;
  shares: number;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  if (data.amountUsd <= 0) {
    throw new Error("Amount must be positive");
  }

  const marketRows = await db
    .select()
    .from(markets)
    .where(eq(markets.id, data.marketId))
    .limit(1);
  const market = marketRows[0];
  if (!market) throw new Error("Market not found");
  if (market.resolvedAt) throw new Error("Market is resolved");

  const portfolio = await getOrCreatePortfolio(data.userId);
  const balance = parseFloat(portfolio.balance || "0");
  if (balance < data.amountUsd) throw new Error("Insufficient balance");

  const yesCents = parseCents(market.yesPrice);
  const noCents = parseCents(market.noPrice);
  const fillPrice = data.outcome === "yes" ? yesCents : noCents;
  const shares = sharesFromBuyUsd(data.amountUsd, fillPrice);
  const impact = applyBuyImpact(yesCents, data.outcome, data.amountUsd);

  const newTotalVol = parseFloat(market.totalVolume || "0") + data.amountUsd;
  const newVol24 = parseFloat(market.volume24h || "0") + data.amountUsd;

  await db
    .update(markets)
    .set({
      yesPrice: impact.yes.toFixed(2),
      noPrice: impact.no.toFixed(2),
      totalVolume: newTotalVol.toFixed(2),
      volume24h: newVol24.toFixed(2),
      updatedAt: new Date(),
    })
    .where(eq(markets.id, data.marketId));

  await db.insert(trades).values({
    userId: data.userId,
    marketId: data.marketId,
    outcome: data.outcome,
    side: "buy",
    shares: shares.toFixed(8),
    priceCents: fillPrice.toFixed(2),
    notionalUsd: data.amountUsd.toFixed(2),
  });

  await upsertPositionAfterBuy(
    db,
    data.userId,
    data.marketId,
    data.outcome,
    shares,
    fillPrice
  );

  const newBalance = balance - data.amountUsd;
  const newInvested =
    parseFloat(portfolio.totalInvested || "0") + data.amountUsd;
  await db
    .update(portfolios)
    .set({
      balance: newBalance.toFixed(2),
      totalInvested: newInvested.toFixed(2),
      updatedAt: new Date(),
    })
    .where(eq(portfolios.userId, data.userId));

  await recordPriceHistory({
    marketId: data.marketId,
    yesPrice: impact.yes,
    noPrice: impact.no,
    volume: newVol24,
  });

  return { yesPrice: impact.yes, noPrice: impact.no, shares };
}

export async function placeBet(data: {
  userId: number;
  marketId: number;
  outcome: "yes" | "no";
  amount: number;
  priceAtBet: number;
}) {
  return executeBuyTrade({
    userId: data.userId,
    marketId: data.marketId,
    outcome: data.outcome,
    amountUsd: data.amount,
  });
}

export async function executeSellTrade(data: {
  userId: number;
  marketId: number;
  outcome: "yes" | "no";
  shares: number;
}): Promise<{
  proceeds: number;
  yesPrice: number;
  noPrice: number;
}> {
  if (data.shares <= 0) throw new Error("Shares must be positive");
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const marketRows = await db
    .select()
    .from(markets)
    .where(eq(markets.id, data.marketId))
    .limit(1);
  const market = marketRows[0];
  if (!market) throw new Error("Market not found");
  if (market.resolvedAt) throw new Error("Market is resolved");

  const posRows = await db
    .select()
    .from(positions)
    .where(
      and(
        eq(positions.userId, data.userId),
        eq(positions.marketId, data.marketId),
        eq(positions.outcome, data.outcome)
      )
    )
    .limit(1);

  if (posRows.length === 0) throw new Error("No position to sell");

  const pos = posRows[0]!;
  const held = parseFloat(String(pos.shares));
  if (held + 1e-9 < data.shares) throw new Error("Insufficient shares");

  const yesCents = parseCents(market.yesPrice);
  const noCents = parseCents(market.noPrice);
  const fillPrice = data.outcome === "yes" ? yesCents : noCents;
  const proceeds = proceedsFromSellShares(data.shares, fillPrice);
  const impact = applySellImpact(yesCents, data.outcome, proceeds);

  const newTotalVol = parseFloat(market.totalVolume || "0") + proceeds;
  const newVol24 = parseFloat(market.volume24h || "0") + proceeds;

  await db
    .update(markets)
    .set({
      yesPrice: impact.yes.toFixed(2),
      noPrice: impact.no.toFixed(2),
      totalVolume: newTotalVol.toFixed(2),
      volume24h: newVol24.toFixed(2),
      updatedAt: new Date(),
    })
    .where(eq(markets.id, data.marketId));

  await db.insert(trades).values({
    userId: data.userId,
    marketId: data.marketId,
    outcome: data.outcome,
    side: "sell",
    shares: data.shares.toFixed(8),
    priceCents: fillPrice.toFixed(2),
    notionalUsd: proceeds.toFixed(2),
  });

  const newHeld = held - data.shares;
  if (newHeld < 1e-6) {
    await db.delete(positions).where(eq(positions.id, pos.id));
  } else {
    await db
      .update(positions)
      .set({
        shares: newHeld.toFixed(8),
        updatedAt: new Date(),
      })
      .where(eq(positions.id, pos.id));
  }

  const portfolio = await getOrCreatePortfolio(data.userId);
  const balance = parseFloat(portfolio.balance || "0");
  await db
    .update(portfolios)
    .set({
      balance: (balance + proceeds).toFixed(2),
      updatedAt: new Date(),
    })
    .where(eq(portfolios.userId, data.userId));

  await recordPriceHistory({
    marketId: data.marketId,
    yesPrice: impact.yes,
    noPrice: impact.no,
    volume: newVol24,
  });

  return { proceeds, yesPrice: impact.yes, noPrice: impact.no };
}

export async function getUserBets(userId: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select({
      id: trades.id,
      userId: trades.userId,
      marketId: trades.marketId,
      outcome: trades.outcome,
      amount: trades.notionalUsd,
      priceAtBet: trades.priceCents,
      createdAt: trades.createdAt,
      side: trades.side,
      shares: trades.shares,
      settledAt: markets.resolvedAt,
      marketTitle: markets.title,
    })
    .from(trades)
    .leftJoin(markets, eq(trades.marketId, markets.id))
    .where(eq(trades.userId, userId))
    .orderBy(desc(trades.createdAt))
    .limit(limit);
}

export async function getMarketBets(marketId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select({
      id: trades.id,
      userId: trades.userId,
      marketId: trades.marketId,
      outcome: trades.outcome,
      side: trades.side,
      shares: trades.shares,
      priceCents: trades.priceCents,
      notionalUsd: trades.notionalUsd,
      createdAt: trades.createdAt,
      userName: users.name,
    })
    .from(trades)
    .innerJoin(users, eq(trades.userId, users.id))
    .where(eq(trades.marketId, marketId))
    .orderBy(desc(trades.createdAt))
    .limit(200);
}

export async function getMarketPositionsSummary(marketId: number) {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select({
      outcome: positions.outcome,
      shares: positions.shares,
      userId: positions.userId,
      userName: users.name,
    })
    .from(positions)
    .innerJoin(users, eq(positions.userId, users.id))
    .where(eq(positions.marketId, marketId));

  return rows;
}

export async function getUserPositions(userId: number, limit = 100) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select({
      id: positions.id,
      marketId: positions.marketId,
      outcome: positions.outcome,
      shares: positions.shares,
      avgPriceCents: positions.avgPriceCents,
      title: markets.title,
      yesPrice: markets.yesPrice,
      noPrice: markets.noPrice,
      resolvedAt: markets.resolvedAt,
    })
    .from(positions)
    .innerJoin(markets, eq(positions.marketId, markets.id))
    .where(eq(positions.userId, userId))
    .orderBy(desc(positions.updatedAt))
    .limit(limit);
}

export async function resolveMarketAndSettle(
  marketId: number,
  resolution: "yes" | "no" | "invalid"
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const marketRows = await db
    .select()
    .from(markets)
    .where(eq(markets.id, marketId))
    .limit(1);
  if (marketRows.length === 0) throw new Error("Market not found");
  const m = marketRows[0]!;
  if (m.resolvedAt) throw new Error("Already resolved");

  await db
    .update(markets)
    .set({
      resolution,
      resolvedAt: new Date(),
      isLive: false,
      updatedAt: new Date(),
    })
    .where(eq(markets.id, marketId));

  const allPositions = await db
    .select()
    .from(positions)
    .where(eq(positions.marketId, marketId));

  for (const pos of allPositions) {
    const shares = parseFloat(String(pos.shares));
    const avg = parseFloat(String(pos.avgPriceCents));
    const cost = shares * (avg / 100);

    let payout = 0;
    if (resolution === "invalid") {
      payout = cost;
    } else if (resolution === "yes" && pos.outcome === "yes") {
      payout = shares;
    } else if (resolution === "no" && pos.outcome === "no") {
      payout = shares;
    }

    const p = await getOrCreatePortfolio(pos.userId);
    const bal = parseFloat(p.balance || "0");
    const ret = parseFloat(p.totalReturns || "0") + (payout - cost);

    await db
      .update(portfolios)
      .set({
        balance: (bal + payout).toFixed(2),
        totalReturns: ret.toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(portfolios.userId, pos.userId));

    await db.delete(positions).where(eq(positions.id, pos.id));

    await createNotification({
      userId: pos.userId,
      marketId,
      type: "market_resolved",
      title: "Market resolved",
      message: `Outcome: ${resolution}`,
    });
  }

  const legacyBets = await db
    .select()
    .from(bets)
    .where(and(eq(bets.marketId, marketId), isNull(bets.settledAt)));

  for (const bet of legacyBets) {
    const amount = parseFloat(String(bet.amount));
    const price = parseFloat(String(bet.priceAtBet));
    const bShares = amount / (price / 100);
    let payout = 0;
    if (resolution === "invalid") {
      payout = amount;
    } else if (
      (resolution === "yes" && bet.outcome === "yes") ||
      (resolution === "no" && bet.outcome === "no")
    ) {
      payout = bShares;
    }
    const cost = amount;
    const p = await getOrCreatePortfolio(bet.userId);
    const bal = parseFloat(p.balance || "0");
    const ret = parseFloat(p.totalReturns || "0") + (payout - cost);

    await db
      .update(portfolios)
      .set({
        balance: (bal + payout).toFixed(2),
        totalReturns: ret.toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(portfolios.userId, bet.userId));

    await db
      .update(bets)
      .set({
        settledAt: new Date(),
        payout: payout.toFixed(2),
        updatedAt: new Date(),
      } as any)
      .where(eq(bets.id, bet.id));

    await createNotification({
      userId: bet.userId,
      marketId,
      type: "market_resolved",
      title: "Market resolved",
      message: "Your position on this market settled.",
    });
  }

  return { success: true as const };
}

export async function addDemoDeposit(userId: number, amount: number) {
  if (amount <= 0 || amount > 1_000_000) {
    throw new Error("Invalid demo deposit amount");
  }
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const p = await getOrCreatePortfolio(userId);
  const bal = parseFloat(p.balance || "0");
  await db
    .update(portfolios)
    .set({
      balance: (bal + amount).toFixed(2),
      updatedAt: new Date(),
    })
    .where(eq(portfolios.userId, userId));

  await createStripeTransaction({
    userId,
    type: "deposit",
    amount,
    status: "completed",
  });

  await createNotification({
    userId,
    type: "deposit_confirmed",
    title: "Deposit credited (demo)",
    message: `+$${amount.toFixed(2)} added for paper trading.`,
  });

  return { success: true as const, balance: bal + amount };
}

export async function getWatchlistMarketIds(userId: number): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select({ marketId: watchlists.marketId })
    .from(watchlists)
    .where(eq(watchlists.userId, userId));

  return rows.map((r) => r.marketId);
}

export async function addToWatchlist(userId: number, marketId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const m = await getMarketById(marketId);
  if (!m) throw new Error("Market not found");

  const existing = await db
    .select()
    .from(watchlists)
    .where(
      and(
        eq(watchlists.userId, userId),
        eq(watchlists.marketId, marketId)
      )
    )
    .limit(1);

  if (existing.length === 0) {
    await db.insert(watchlists).values({ userId, marketId });
  }

  return { success: true as const };
}

export async function removeFromWatchlist(userId: number, marketId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .delete(watchlists)
    .where(
      and(eq(watchlists.userId, userId), eq(watchlists.marketId, marketId))
    );

  return { success: true as const };
}

export async function getMarketCommentsWithUsers(
  marketId: number,
  limit: number = 50
) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select({
      id: comments.id,
      content: comments.content,
      createdAt: comments.createdAt,
      userId: comments.userId,
      userName: users.name,
      userAvatar: users.avatar,
    })
    .from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .where(eq(comments.marketId, marketId))
    .orderBy(desc(comments.createdAt))
    .limit(limit);
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
