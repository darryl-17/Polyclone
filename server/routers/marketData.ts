import { router, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import {
  fetchCryptoData,
  fetchStockData,
  fetchSportsEvents,
  fetchEconomicIndicators,
} from "../services/externalApis";
import { refreshAllMarkets } from "../services/marketGenerator";

export const marketDataRouter = router({
  // Get crypto market data
  getCryptoData: publicProcedure
    .input(
      z.object({
        ids: z.array(z.string()).optional(),
      })
    )
    .query(async ({ input }) => {
      const cryptoData = await fetchCryptoData(input.ids);
      return cryptoData;
    }),

  // Get stock data
  getStockData: publicProcedure
    .input(
      z.object({
        symbol: z.string(),
      })
    )
    .query(async ({ input }) => {
      const stockData = await fetchStockData(input.symbol);
      return stockData;
    }),

  // Get sports events
  getSportsEvents: publicProcedure
    .input(
      z.object({
        sport: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const events = await fetchSportsEvents(input.sport || "all");
      return events;
    }),

  // Get economic indicators
  getEconomicIndicators: publicProcedure.query(async () => {
    const indicators = await fetchEconomicIndicators();
    return indicators;
  }),

  // Refresh all markets with latest data
  refreshMarkets: publicProcedure.mutation(async () => {
    const result = await refreshAllMarkets();
    return result;
  }),

  // Get market statistics
  getMarketStats: publicProcedure.query(async () => {
    return {
      totalMarkets: 0, // Would be fetched from DB
      activeMarkets: 0,
      totalVolume: 0,
      averageOdds: 50,
      lastUpdated: new Date(),
    };
  }),
});
