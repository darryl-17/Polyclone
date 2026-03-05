import { getDb } from "../db";
import { markets, priceHistory } from "../../drizzle/schema";
import { fetchNews, analyzeSentiment, fetchCryptoData, fetchSportsEvents } from "./externalApis";
import { eq, isNull } from "drizzle-orm";

export interface GeneratedMarket {
  title: string;
  description: string;
  category: string;
  subcategory?: string;
  yesPrice: string;
  noPrice: string;
  endsAt: Date;
  sourceUrl?: string;
  imageUrl?: string;
}

/**
 * Generate markets from news articles
 */
export async function generateMarketsFromNews(): Promise<GeneratedMarket[]> {
  const generatedMarkets: GeneratedMarket[] = [];

  try {
    // Fetch news from different categories
    const categories = [
      { query: "economic recession inflation", category: "Finance" },
      { query: "political election government", category: "Politics" },
      { query: "cryptocurrency Bitcoin Ethereum", category: "Crypto" },
      { query: "sports championship tournament", category: "Sports" },
      { query: "climate change environment", category: "Climate & Science" },
      { query: "technology AI startup", category: "Tech" },
      { query: "geopolitical conflict war", category: "Geopolitics" },
    ];

    for (const { query, category } of categories) {
      const articles = await fetchNews(query, undefined, 5);

      for (const article of articles) {
        // Analyze sentiment to determine initial odds
        const sentiment = await analyzeSentiment(article.title + " " + article.description);

        // Calculate initial odds based on sentiment
        let yesPrice = 50;
        if (sentiment.sentiment === "positive") {
          yesPrice = Math.min(50 + sentiment.score * 30, 90);
        } else if (sentiment.sentiment === "negative") {
          yesPrice = Math.max(50 + sentiment.score * 30, 10);
        }

        const noPrice = 100 - yesPrice;

        // Create market object
        const market: GeneratedMarket = {
          title: article.title,
          description: article.description || article.content,
          category,
          yesPrice: yesPrice.toString(),
          noPrice: noPrice.toString(),
          endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          sourceUrl: article.url,
          imageUrl: article.urlToImage,
        };

        generatedMarkets.push(market);
      }
    }

    return generatedMarkets;
  } catch (error) {
    console.error("Error generating markets from news:", error);
    return [];
  }
}

/**
 * Generate markets from crypto data
 */
export async function generateCryptoMarkets(): Promise<GeneratedMarket[]> {
  const generatedMarkets: GeneratedMarket[] = [];

  try {
    const cryptoData = await fetchCryptoData(["bitcoin", "ethereum", "cardano"]);

    for (const crypto of cryptoData) {
      const priceChange = crypto.price_change_percentage_24h || 0;

      // Calculate odds based on price momentum
      let yesPrice = 50;
      if (priceChange > 5) {
        yesPrice = Math.min(50 + (priceChange / 20) * 30, 90);
      } else if (priceChange < -5) {
        yesPrice = Math.max(50 + (priceChange / 20) * 30, 10);
      }

      const noPrice = 100 - yesPrice;

      const market: GeneratedMarket = {
        title: `Will ${crypto.name} reach $${(crypto.current_price * 1.2).toFixed(2)} in 30 days?`,
        description: `Current price: $${crypto.current_price.toFixed(2)}. 24h change: ${priceChange.toFixed(2)}%. Market cap: $${(crypto.market_cap / 1e9).toFixed(2)}B`,
        category: "Crypto",
        subcategory: crypto.symbol.toUpperCase(),
        yesPrice: yesPrice.toString(),
        noPrice: noPrice.toString(),
        endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        imageUrl: crypto.image,
      };

      generatedMarkets.push(market);
    }

    return generatedMarkets;
  } catch (error) {
    console.error("Error generating crypto markets:", error);
    return [];
  }
}

/**
 * Generate markets from sports events
 */
export async function generateSportsMarkets(): Promise<GeneratedMarket[]> {
  const generatedMarkets: GeneratedMarket[] = [];

  try {
    const events = await fetchSportsEvents("all");

    for (const event of events) {
      // Default to 50-50 odds for upcoming events
      const market: GeneratedMarket = {
        title: `Will ${event.homeTeam} beat ${event.awayTeam}?`,
        description: `${event.league} - ${event.name}. Scheduled for ${new Date(event.date).toLocaleDateString()}`,
        category: "Sports",
        subcategory: event.league,
        yesPrice: "50",
        noPrice: "50",
        endsAt: new Date(event.date),
      };

      generatedMarkets.push(market);
    }

    return generatedMarkets;
  } catch (error) {
    console.error("Error generating sports markets:", error);
    return [];
  }
}

/**
 * Save generated markets to database
 */
export async function saveGeneratedMarkets(generatedMarkets: GeneratedMarket[]): Promise<number> {
  const db = await getDb();
  if (!db) {
    console.error("Database not available");
    return 0;
  }

  try {
    let savedCount = 0;

    for (const market of generatedMarkets) {
      try {
        // Check if market already exists (by title)
        const existing = await db
          .select()
          .from(markets)
          .where(eq(markets.title, market.title))
          .limit(1);

        if (existing.length === 0) {
          // Insert new market
          await db.insert(markets).values({
            title: market.title,
            description: market.description,
            category: market.category,
            subcategory: market.subcategory,
            yesPrice: market.yesPrice,
            noPrice: market.noPrice,
            endsAt: market.endsAt,
            imageUrl: market.imageUrl,
            totalVolume: "0",
          });

          savedCount++;
        }
      } catch (error) {
        console.error("Error saving individual market:", error);
        continue;
      }
    }

    return savedCount;
  } catch (error) {
    console.error("Error saving generated markets:", error);
    return 0;
  }
}

/**
 * Update market prices based on latest data
 */
export async function updateMarketPrices(): Promise<number> {
  const db = await getDb();
  if (!db) {
    console.error("Database not available");
    return 0;
  }

  try {
    // Fetch all active markets
    const activeMarkets = await db
      .select()
      .from(markets)
      .where(isNull(markets.resolvedAt))
      .limit(100);

    let updatedCount = 0;

    for (const market of activeMarkets) {
      try {
        // For crypto markets, fetch latest price
        if (market.category === "Crypto" && market.subcategory) {
          const cryptoData = await fetchCryptoData([market.subcategory.toLowerCase()]);
          if (cryptoData.length > 0) {
            const crypto = cryptoData[0];
            const priceChange = crypto.price_change_percentage_24h || 0;

            // Update odds based on price change
            let yesPrice = 50;
            if (priceChange > 5) {
              yesPrice = Math.min(50 + (priceChange / 20) * 30, 90);
            } else if (priceChange < -5) {
              yesPrice = Math.max(50 + (priceChange / 20) * 30, 10);
            }

            const noPrice = 100 - yesPrice;

            // Update market
            await db
              .update(markets)
              .set({
                yesPrice: yesPrice.toString(),
                noPrice: noPrice.toString(),
              })
              .where(eq(markets.id, market.id));

            // Record price history
            await db.insert(priceHistory).values({
              marketId: market.id,
              yesPrice: yesPrice.toString(),
              noPrice: noPrice.toString(),
              recordedAt: new Date(),
            });

            updatedCount++;
          }
        }
      } catch (error) {
        console.error("Error updating market price:", error);
        continue;
      }
    }

    return updatedCount;
  } catch (error) {
    console.error("Error updating market prices:", error);
    return 0;
  }
}

/**
 * Refresh all markets with latest data
 */
export async function refreshAllMarkets(): Promise<{
  generated: number;
  saved: number;
  updated: number;
}> {
  try {
    // Generate new markets from various sources
    const newsMarkets = await generateMarketsFromNews();
    const cryptoMarkets = await generateCryptoMarkets();
    const sportsMarkets = await generateSportsMarkets();

    const allMarkets = [...newsMarkets, ...cryptoMarkets, ...sportsMarkets];

    // Save new markets
    const saved = await saveGeneratedMarkets(allMarkets);

    // Update existing market prices
    const updated = await updateMarketPrices();

    return {
      generated: allMarkets.length,
      saved,
      updated,
    };
  } catch (error) {
    console.error("Error refreshing markets:", error);
    return { generated: 0, saved: 0, updated: 0 };
  }
}
