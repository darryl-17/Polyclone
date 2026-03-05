import { router, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import { fetchNews, analyzeSentiment } from "../services/externalApis";

export const newsRouter = router({
  // Get news articles
  getNews: publicProcedure
    .input(
      z.object({
        query: z.string().optional(),
        category: z.string().optional(),
        limit: z.number().default(20),
      })
    )
    .query(async ({ input }) => {
      const articles = await fetchNews(input.query || "market economy", input.category, input.limit);

      // Add sentiment analysis to each article
      const articlesWithSentiment = await Promise.all(
        articles.map(async (article) => {
          const sentiment = await analyzeSentiment(article.title + " " + article.description);
          return {
            ...article,
            sentiment: sentiment.sentiment,
            sentimentScore: sentiment.score,
          };
        })
      );

      return articlesWithSentiment;
    }),

  // Get news by category
  getNewsByCategory: publicProcedure
    .input(
      z.object({
        category: z.enum([
          "Politics",
          "Finance",
          "Crypto",
          "Sports",
          "Climate & Science",
          "Tech",
          "Geopolitics",
        ]),
        limit: z.number().default(10),
      })
    )
    .query(async ({ input }) => {
      const categoryQueries: Record<string, string> = {
        Politics: "political election government policy",
        Finance: "economic recession inflation interest rate",
        Crypto: "cryptocurrency Bitcoin Ethereum blockchain",
        Sports: "sports championship tournament match",
        "Climate & Science": "climate change environment science research",
        Tech: "technology AI startup innovation",
        Geopolitics: "geopolitical conflict war international relations",
      };

      const query = categoryQueries[input.category];
      const articles = await fetchNews(query, undefined, input.limit);

      return articles;
    }),

  // Get trending topics
  getTrendingTopics: publicProcedure.query(async () => {
    const categories = [
      "Politics",
      "Finance",
      "Crypto",
      "Sports",
      "Climate & Science",
      "Tech",
      "Geopolitics",
    ];

    const trendingByCategory = await Promise.all(
      categories.map(async (category) => {
        const categoryQueries: Record<string, string> = {
          Politics: "political election government policy",
          Finance: "economic recession inflation interest rate",
          Crypto: "cryptocurrency Bitcoin Ethereum blockchain",
          Sports: "sports championship tournament match",
          "Climate & Science": "climate change environment science research",
          Tech: "technology AI startup innovation",
          Geopolitics: "geopolitical conflict war international relations",
        };

        const query = categoryQueries[category];
        const articles = await fetchNews(query, undefined, 3);

        return {
          category,
          articles: articles.slice(0, 3),
        };
      })
    );

    return trendingByCategory;
  }),

  // Search news
  searchNews: publicProcedure
    .input(
      z.object({
        query: z.string(),
        limit: z.number().default(20),
      })
    )
    .query(async ({ input }) => {
      const articles = await fetchNews(input.query, undefined, input.limit);
      return articles;
    }),
});
