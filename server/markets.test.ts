import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { upsertUser } from "./db";

// Mock context for testing
function createMockContext(userId?: number, role: "user" | "admin" = "user"): TrpcContext {
  return {
    user: userId
      ? {
          id: userId,
          openId: `test-user-${userId}`,
          email: `user${userId}@test.com`,
          name: `Test User ${userId}`,
          loginMethod: "test",
          role,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        }
      : null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

// Setup test users in database
async function setupTestUser(userId: number, role: "user" | "admin" = "user") {
  await upsertUser({
    openId: `test-user-${userId}`,
    email: `user${userId}@test.com`,
    name: `Test User ${userId}`,
    loginMethod: "test",
    role,
  });
}

describe("Markets Router", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeAll(async () => {
    const ctx = createMockContext();
    caller = appRouter.createCaller(ctx);
  });

  it("should list markets", async () => {
    const markets = await caller.markets.list({
      limit: 10,
      offset: 0,
    });

    expect(Array.isArray(markets)).toBe(true);
  });

  it("should filter markets by category", async () => {
    const markets = await caller.markets.list({
      category: "Politics",
      limit: 10,
      offset: 0,
    });

    expect(Array.isArray(markets)).toBe(true);
  });

  it("should search markets", async () => {
    const markets = await caller.markets.list({
      search: "test",
      limit: 10,
      offset: 0,
    });

    expect(Array.isArray(markets)).toBe(true);
  });

  it("should get market by id", async () => {
    // First setup admin user
    await setupTestUser(1, "admin");
    
    // Create a market with admin context
    const adminCtx = createMockContext(1, "admin");
    const adminCaller = appRouter.createCaller(adminCtx);

    const createResult = await adminCaller.markets.create({
      title: "Test Market",
      description: "A test market",
      category: "Politics",
      endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    });

    expect(createResult).toBeDefined();

    // Then fetch it
    const market = await caller.markets.getById(1);
    expect(market).toBeDefined();
    if (market) {
      expect(market.title).toBe("Test Market");
    }
  });

  it("should not allow non-admin to create market", async () => {
    await setupTestUser(2, "user");
    
    const userCtx = createMockContext(2, "user");
    const userCaller = appRouter.createCaller(userCtx);

    try {
      await userCaller.markets.create({
        title: "Unauthorized Market",
        category: "Politics",
        endsAt: new Date(),
      });
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect((error as Error).message).toContain("Only admins");
    }
  });
});

describe("Portfolio Router", () => {
  beforeAll(async () => {
    await setupTestUser(3, "user");
    await setupTestUser(4, "user");
    await setupTestUser(5, "user");
  });

  it("should get or create portfolio for user", async () => {
    const userCtx = createMockContext(3, "user");
    const userCaller = appRouter.createCaller(userCtx);

    const portfolio = await userCaller.portfolio.get();

    expect(portfolio).toBeDefined();
    expect(portfolio.userId).toBe(3);
    expect(portfolio.balance).toBeDefined();
  });

  it("should update portfolio balance", async () => {
    const userCtx = createMockContext(4, "user");
    const userCaller = appRouter.createCaller(userCtx);

    const result = await userCaller.portfolio.updateBalance(100);

    expect(result.success).toBe(true);

    const portfolio = await userCaller.portfolio.get();
    expect(parseFloat(portfolio.balance || "0")).toBe(100);
  });

  it("should update portfolio stats", async () => {
    const userCtx = createMockContext(5, "user");
    const userCaller = appRouter.createCaller(userCtx);

    const result = await userCaller.portfolio.updateStats({
      totalInvested: 500,
      totalReturns: 100,
    });

    expect(result.success).toBe(true);

    const portfolio = await userCaller.portfolio.get();
    expect(parseFloat(portfolio.totalInvested || "0")).toBe(500);
    expect(parseFloat(portfolio.totalReturns || "0")).toBe(100);
  });
});

describe("Bets Router", () => {
  beforeAll(async () => {
    await setupTestUser(6, "user");
    await setupTestUser(7, "user");
    await setupTestUser(8, "user");
  });

  it("should not allow bet without sufficient balance", async () => {
    const userCtx = createMockContext(6, "user");
    const userCaller = appRouter.createCaller(userCtx);

    try {
      await userCaller.bets.place({
        marketId: 1,
        outcome: "yes",
        amount: 1000,
        priceAtBet: 50,
      });
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect((error as Error).message).toContain("Insufficient balance");
    }
  });

  it("should place bet with sufficient balance", async () => {
    const userCtx = createMockContext(7, "user");
    const userCaller = appRouter.createCaller(userCtx);

    // First set balance
    await userCaller.portfolio.updateBalance(500);

    // Then place bet
    const result = await userCaller.bets.place({
      marketId: 1,
      outcome: "yes",
      amount: 100,
      priceAtBet: 50,
    });

    expect(result).toBeDefined();
  });

  it("should get user bets", async () => {
    const userCtx = createMockContext(8, "user");
    const userCaller = appRouter.createCaller(userCtx);

    // Set balance and place bet
    await userCaller.portfolio.updateBalance(500);
    await userCaller.bets.place({
      marketId: 1,
      outcome: "no",
      amount: 50,
      priceAtBet: 50,
    });

    // Get bets
    const bets = await userCaller.bets.getUserBets();

    expect(Array.isArray(bets)).toBe(true);
    expect(bets.length).toBeGreaterThan(0);
  });
});

describe("Leaderboard Router", () => {
  it("should get top traders", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const leaderboard = await caller.leaderboard.getTop(10);

    expect(Array.isArray(leaderboard)).toBe(true);
  });

  it("should return limited results", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const leaderboard = await caller.leaderboard.getTop(5);

    expect(leaderboard.length).toBeLessThanOrEqual(5);
  });
});
