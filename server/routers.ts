import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  getMarkets,
  getMarketById,
  createMarket,
  updateMarketPrice,
  placeBet,
  getUserBets,
  getMarketBets,
  settleBet,
  getOrCreatePortfolio,
  updatePortfolioBalance,
  updatePortfolioStats,
  getMarketComments,
  createComment,
  getMarketNews,
  createNewsArticle,
  getPriceHistory,
  recordPriceHistory,
  createNotification,
  getUserNotifications,
  markNotificationAsRead,
  createStripeTransaction,
  updateStripeTransactionStatus,
  getUserStripeTransactions,
  createAIPrediction,
  getMarketAIPrediction,
  getLeaderboard,
} from "./db";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // ===== MARKETS =====
  markets: router({
    list: publicProcedure
      .input(
        z.object({
          category: z.string().optional(),
          search: z.string().optional(),
          limit: z.number().default(20),
          offset: z.number().default(0),
        })
      )
      .query(async ({ input }) => {
        return await getMarkets(input.category, input.search, input.limit, input.offset);
      }),

    getById: publicProcedure
      .input(z.number())
      .query(async ({ input }) => {
        return await getMarketById(input);
      }),

    create: protectedProcedure
      .input(
        z.object({
          title: z.string(),
          description: z.string().optional(),
          category: z.string(),
          subcategory: z.string().optional(),
          imageUrl: z.string().optional(),
          endsAt: z.date(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        // Only admins can create markets
        if (ctx.user?.role !== "admin") {
          throw new Error("Only admins can create markets");
        }
        return await createMarket(input);
      }),

    updatePrice: protectedProcedure
      .input(
        z.object({
          marketId: z.number(),
          yesPrice: z.number(),
          noPrice: z.number(),
          volume: z.number(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== "admin") {
          throw new Error("Only admins can update prices");
        }
        await updateMarketPrice(input.marketId, input.yesPrice, input.noPrice, input.volume);
        return { success: true };
      }),

    getPriceHistory: publicProcedure
      .input(
        z.object({
          marketId: z.number(),
          hours: z.number().default(24),
        })
      )
      .query(async ({ input }) => {
        return await getPriceHistory(input.marketId, input.hours);
      }),

    recordPrice: protectedProcedure
      .input(
        z.object({
          marketId: z.number(),
          yesPrice: z.number(),
          noPrice: z.number(),
          volume: z.number().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== "admin") {
          throw new Error("Only admins can record prices");
        }
        await recordPriceHistory({
          marketId: input.marketId,
          yesPrice: input.yesPrice,
          noPrice: input.noPrice,
          volume: input.volume,
        });
        return { success: true };
      }),
  }),

  // ===== BETS =====
  bets: router({
    place: protectedProcedure
      .input(
        z.object({
          marketId: z.number(),
          outcome: z.enum(["yes", "no"]),
          amount: z.number().positive(),
          priceAtBet: z.number(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const portfolio = await getOrCreatePortfolio(ctx.user!.id);
        
        // Check if user has sufficient balance
        const balance = parseFloat(portfolio.balance || "0");
        if (balance < input.amount) {
          throw new Error("Insufficient balance");
        }

        // Place the bet
        const result = await placeBet({
          userId: ctx.user!.id,
          marketId: input.marketId,
          outcome: input.outcome,
          amount: input.amount,
          priceAtBet: input.priceAtBet,
        });

        // Update portfolio balance
        const newBalance = Math.max(0, balance - input.amount);
        await updatePortfolioBalance(ctx.user!.id, newBalance);

        return result;
      }),

    getUserBets: protectedProcedure
      .input(z.number().optional())
      .query(async ({ input, ctx }) => {
        return await getUserBets(ctx.user!.id, input || 50);
      }),

    getMarketBets: publicProcedure
      .input(z.number())
      .query(async ({ input }) => {
        return await getMarketBets(input);
      }),

    settle: protectedProcedure
      .input(
        z.object({
          betId: z.number(),
          payout: z.number(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== "admin") {
          throw new Error("Only admins can settle bets");
        }
        await settleBet(input.betId, input.payout);
        return { success: true };
      }),
  }),

  // ===== PORTFOLIO =====
  portfolio: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      return await getOrCreatePortfolio(ctx.user!.id);
    }),

    updateBalance: protectedProcedure
      .input(z.number())
      .mutation(async ({ input, ctx }) => {
        await updatePortfolioBalance(ctx.user!.id, input);
        return { success: true };
      }),

    updateStats: protectedProcedure
      .input(
        z.object({
          totalInvested: z.number(),
          totalReturns: z.number(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await updatePortfolioStats(ctx.user!.id, input.totalInvested, input.totalReturns);
        return { success: true };
      }),
  }),

  // ===== COMMENTS =====
  comments: router({
    list: publicProcedure
      .input(
        z.object({
          marketId: z.number(),
          limit: z.number().default(20),
        })
      )
      .query(async ({ input }) => {
        return await getMarketComments(input.marketId, input.limit);
      }),

    create: protectedProcedure
      .input(
        z.object({
          marketId: z.number(),
          content: z.string().min(1).max(1000),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const result = await createComment({
          userId: ctx.user!.id,
          marketId: input.marketId,
          content: input.content,
        });

        return result;
      }),
  }),

  // ===== NEWS =====
  news: router({
    getMarketNews: publicProcedure
      .input(
        z.object({
          marketId: z.number(),
          limit: z.number().default(10),
        })
      )
      .query(async ({ input }) => {
        return await getMarketNews(input.marketId, input.limit);
      }),

    create: protectedProcedure
      .input(
        z.object({
          marketId: z.number(),
          title: z.string(),
          source: z.string().optional(),
          url: z.string().optional(),
          imageUrl: z.string().optional(),
          summary: z.string().optional(),
          publishedAt: z.date().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== "admin") {
          throw new Error("Only admins can create news");
        }
        return await createNewsArticle({
          marketId: input.marketId,
          title: input.title,
          source: input.source,
          url: input.url,
          imageUrl: input.imageUrl,
          summary: input.summary,
          publishedAt: input.publishedAt,
        });
      }),
  }),

  // ===== NOTIFICATIONS =====
  notifications: router({
    list: protectedProcedure
      .input(z.number().optional())
      .query(async ({ input, ctx }) => {
        return await getUserNotifications(ctx.user!.id, input || 20);
      }),

    markAsRead: protectedProcedure
      .input(z.number())
      .mutation(async ({ input }) => {
        await markNotificationAsRead(input);
        return { success: true };
      }),

    create: protectedProcedure
      .input(
        z.object({
          marketId: z.number().optional(),
          type: z.enum([
            "market_resolved",
            "price_threshold",
            "market_ending",
            "new_comment",
            "deposit_confirmed",
            "withdrawal_processed",
          ]),
          title: z.string(),
          message: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        return await createNotification({
          userId: ctx.user!.id,
          marketId: input.marketId || undefined,
          type: input.type,
          title: input.title,
          message: input.message,
        });
      }),
  }),

  // ===== STRIPE TRANSACTIONS =====
  stripe: router({
    createTransaction: protectedProcedure
      .input(
        z.object({
          stripePaymentIntentId: z.string().optional(),
          type: z.enum(["deposit", "withdrawal"]),
          amount: z.number().positive(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        return await createStripeTransaction({
          userId: ctx.user!.id,
          stripePaymentIntentId: input.stripePaymentIntentId,
          type: input.type,
          amount: input.amount,
        });
      }),

    updateTransactionStatus: protectedProcedure
      .input(
        z.object({
          transactionId: z.number(),
          status: z.enum(["pending", "completed", "failed", "cancelled"]),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== "admin") {
          throw new Error("Only admins can update transaction status");
        }
        await updateStripeTransactionStatus(input.transactionId, input.status);
        return { success: true };
      }),

    getTransactions: protectedProcedure.query(async ({ ctx }) => {
      return await getUserStripeTransactions(ctx.user!.id);
    }),
  }),

  // ===== AI PREDICTIONS =====
  aiPredictions: router({
    getMarketPrediction: publicProcedure
      .input(z.number())
      .query(async ({ input }) => {
        return await getMarketAIPrediction(input);
      }),

    create: protectedProcedure
      .input(
        z.object({
          marketId: z.number(),
          prediction: z.string(),
          confidence: z.number().optional(),
          reasoning: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== "admin") {
          throw new Error("Only admins can create predictions");
        }
        return await createAIPrediction({
          marketId: input.marketId,
          prediction: input.prediction,
          confidence: input.confidence,
          reasoning: input.reasoning,
        });
      }),
  }),

  // ===== LEADERBOARD =====
  leaderboard: router({
    getTop: publicProcedure
      .input(z.number().default(50))
      .query(async ({ input }) => {
        return await getLeaderboard(input);
      }),
  }),
});

export type AppRouter = typeof appRouter;
