import { 
  int, 
  mysqlEnum, 
  mysqlTable, 
  text, 
  timestamp, 
  varchar,
  decimal,
  boolean,
  json,
  index,
  foreignKey,
  unique
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  avatar: text("avatar"),
  bio: text("bio"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
}, (table) => ({
  openIdIdx: index("openId_idx").on(table.openId),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Markets table - represents prediction markets
 */
export const markets = mysqlTable("markets", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }).notNull(), // Politics, Sports, Crypto, Finance, etc.
  subcategory: varchar("subcategory", { length: 100 }),
  imageUrl: text("imageUrl"),
  
  // Probability and volume
  yesPrice: decimal("yesPrice", { precision: 5, scale: 2 }).default("50.00"), // 0-100
  noPrice: decimal("noPrice", { precision: 5, scale: 2 }).default("50.00"),
  volume24h: decimal("volume24h", { precision: 20, scale: 2 }).default("0"),
  totalVolume: decimal("totalVolume", { precision: 20, scale: 2 }).default("0"),
  
  // Market lifecycle
  endsAt: timestamp("endsAt").notNull(),
  resolvedAt: timestamp("resolvedAt"),
  resolution: mysqlEnum("resolution", ["yes", "no", "invalid"]).default("yes"),
  
  // Metadata
  isLive: boolean("isLive").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  categoryIdx: index("category_idx").on(table.category),
  isLiveIdx: index("isLive_idx").on(table.isLive),
  endsAtIdx: index("endsAt_idx").on(table.endsAt),
}));

export type Market = typeof markets.$inferSelect;
export type InsertMarket = typeof markets.$inferInsert;

/**
 * Bets table - tracks user bets on markets
 */
export const bets = mysqlTable("bets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  marketId: int("marketId").notNull(),
  outcome: mysqlEnum("outcome", ["yes", "no"]).notNull(),
  amount: decimal("amount", { precision: 20, scale: 2 }).notNull(),
  priceAtBet: decimal("priceAtBet", { precision: 5, scale: 2 }).notNull(),
  
  // Settlement
  settledAt: timestamp("settledAt"),
  payout: decimal("payout", { precision: 20, scale: 2 }),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdx: index("userId_idx").on(table.userId),
  marketIdx: index("marketId_idx").on(table.marketId),
  userMarketIdx: index("userId_marketId_idx").on(table.userId, table.marketId),
  fk_user: foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
  }),
  fk_market: foreignKey({
    columns: [table.marketId],
    foreignColumns: [markets.id],
  }),
}));

export type Bet = typeof bets.$inferSelect;
export type InsertBet = typeof bets.$inferInsert;

/**
 * Portfolio table - tracks user balances
 */
export const portfolios = mysqlTable("portfolios", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  balance: decimal("balance", { precision: 20, scale: 2 }).default("0"),
  totalInvested: decimal("totalInvested", { precision: 20, scale: 2 }).default("0"),
  totalReturns: decimal("totalReturns", { precision: 20, scale: 2 }).default("0"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  fk_user: foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
  }),
}));

export type Portfolio = typeof portfolios.$inferSelect;
export type InsertPortfolio = typeof portfolios.$inferInsert;

/**
 * Comments table - tracks market discussions
 */
export const comments = mysqlTable("comments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  marketId: int("marketId").notNull(),
  content: text("content").notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdx: index("userId_idx").on(table.userId),
  marketIdx: index("marketId_idx").on(table.marketId),
  fk_user: foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
  }),
  fk_market: foreignKey({
    columns: [table.marketId],
    foreignColumns: [markets.id],
  }),
}));

export type Comment = typeof comments.$inferSelect;
export type InsertComment = typeof comments.$inferInsert;

/**
 * News articles - tracks news for markets
 */
export const newsArticles = mysqlTable("newsArticles", {
  id: int("id").autoincrement().primaryKey(),
  marketId: int("marketId").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  source: varchar("source", { length: 200 }),
  url: text("url"),
  imageUrl: text("imageUrl"),
  summary: text("summary"),
  
  publishedAt: timestamp("publishedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  marketIdx: index("marketId_idx").on(table.marketId),
  fk_market: foreignKey({
    columns: [table.marketId],
    foreignColumns: [markets.id],
  }),
}));

export type NewsArticle = typeof newsArticles.$inferSelect;
export type InsertNewsArticle = typeof newsArticles.$inferInsert;

/**
 * Price history - tracks historical prices for charts
 */
export const priceHistory = mysqlTable("priceHistory", {
  id: int("id").autoincrement().primaryKey(),
  marketId: int("marketId").notNull(),
  yesPrice: decimal("yesPrice", { precision: 5, scale: 2 }).notNull(),
  noPrice: decimal("noPrice", { precision: 5, scale: 2 }).notNull(),
  volume: decimal("volume", { precision: 20, scale: 2 }).default("0"),
  
  recordedAt: timestamp("recordedAt").defaultNow().notNull(),
}, (table) => ({
  marketIdx: index("marketId_idx").on(table.marketId),
  recordedAtIdx: index("recordedAt_idx").on(table.recordedAt),
  fk_market: foreignKey({
    columns: [table.marketId],
    foreignColumns: [markets.id],
  }),
}));

export type PriceHistory = typeof priceHistory.$inferSelect;
export type InsertPriceHistory = typeof priceHistory.$inferInsert;

/**
 * Notifications - tracks user notifications
 */
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  marketId: int("marketId"),
  type: mysqlEnum("type", [
    "market_resolved",
    "price_threshold",
    "market_ending",
    "new_comment",
    "deposit_confirmed",
    "withdrawal_processed"
  ]).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  message: text("message"),
  isRead: boolean("isRead").default(false),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdx: index("userId_idx").on(table.userId),
  marketIdx: index("marketId_idx").on(table.marketId),
  fk_user: foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
  }),
  fk_market: foreignKey({
    columns: [table.marketId],
    foreignColumns: [markets.id],
  }),
}));

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

/**
 * Stripe transactions - tracks deposits and withdrawals
 */
export const stripeTransactions = mysqlTable("stripeTransactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }).unique(),
  type: mysqlEnum("type", ["deposit", "withdrawal"]).notNull(),
  amount: decimal("amount", { precision: 20, scale: 2 }).notNull(),
  status: mysqlEnum("status", ["pending", "completed", "failed", "cancelled"]).default("pending"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdx: index("userId_idx").on(table.userId),
  fk_user: foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
  }),
}));

export type StripeTransaction = typeof stripeTransactions.$inferSelect;
export type InsertStripeTransaction = typeof stripeTransactions.$inferInsert;

/**
 * AI Predictions - stores AI-generated market insights
 */
export const aiPredictions = mysqlTable("aiPredictions", {
  id: int("id").autoincrement().primaryKey(),
  marketId: int("marketId").notNull(),
  prediction: text("prediction").notNull(),
  confidence: decimal("confidence", { precision: 5, scale: 2 }), // 0-100
  reasoning: text("reasoning"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  marketIdx: index("marketId_idx").on(table.marketId),
  fk_market: foreignKey({
    columns: [table.marketId],
    foreignColumns: [markets.id],
  }),
}));

export type AIPrediction = typeof aiPredictions.$inferSelect;
export type InsertAIPrediction = typeof aiPredictions.$inferInsert;
