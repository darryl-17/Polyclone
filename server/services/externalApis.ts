import axios from "axios";

// Types for external APIs
export interface NewsArticle {
  title: string;
  description: string;
  url: string;
  urlToImage: string;
  publishedAt: string;
  source: {
    id: string;
    name: string;
  };
  content: string;
}

export interface CryptoData {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  price_change_percentage_24h: number;
  circulating_supply: number;
  image: string;
}

export interface StockData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  volume: number;
}

export interface SportsEvent {
  id: string;
  name: string;
  date: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  status: string;
  homeScore?: number;
  awayScore?: number;
}

// NewsAPI Service
export async function fetchNews(
  query: string,
  category?: string,
  limit: number = 20
): Promise<NewsArticle[]> {
  try {
    const newsApiKey = process.env.NEWS_API_KEY;
    if (!newsApiKey) {
      console.warn("NEWS_API_KEY not configured");
      return [];
    }

    const url = "https://newsapi.org/v2/everything";
    const params: Record<string, any> = {
      q: query,
      sortBy: "publishedAt",
      language: "en",
      pageSize: limit,
      apiKey: newsApiKey,
    };

    if (category) {
      params.category = category;
    }

    const response = await axios.get(url, { params });
    return response.data.articles || [];
  } catch (error) {
    console.error("Error fetching news:", error);
    return [];
  }
}

// CoinGecko API Service (Free, no key required)
export async function fetchCryptoData(ids: string[] = []): Promise<CryptoData[]> {
  try {
    const cryptoIds = ids.length > 0 ? ids : ["bitcoin", "ethereum", "cardano"];
    const url = "https://api.coingecko.com/api/v3/coins/markets";

    const response = await axios.get(url, {
      params: {
        vs_currency: "usd",
        ids: cryptoIds.join(","),
        order: "market_cap_desc",
        per_page: 250,
        sparkline: false,
      },
    });

    return response.data || [];
  } catch (error) {
    console.error("Error fetching crypto data:", error);
    return [];
  }
}

// Stock Data Service (using Alpha Vantage or similar)
export async function fetchStockData(symbol: string): Promise<StockData | null> {
  try {
    const alphaVantageKey = process.env.ALPHA_VANTAGE_KEY;
    if (!alphaVantageKey) {
      console.warn("ALPHA_VANTAGE_KEY not configured");
      return null;
    }

    const url = "https://www.alphavantage.co/query";
    const response = await axios.get(url, {
      params: {
        function: "GLOBAL_QUOTE",
        symbol,
        apikey: alphaVantageKey,
      },
    });

    const quote = response.data["Global Quote"];
    if (!quote || !quote["05. price"]) {
      return null;
    }

    return {
      symbol,
      name: symbol,
      price: parseFloat(quote["05. price"]),
      change: parseFloat(quote["09. change"]),
      changePercent: parseFloat(quote["10. change percent"]),
      high: parseFloat(quote["03. high"]),
      low: parseFloat(quote["04. low"]),
      volume: parseInt(quote["06. volume"]),
    };
  } catch (error) {
    console.error("Error fetching stock data:", error);
    return null;
  }
}

// Sports Data Service (using ESPN API or similar)
export async function fetchSportsEvents(sport: string): Promise<SportsEvent[]> {
  try {
    // This is a placeholder - you would need to integrate with ESPN API or similar
    // For now, returning mock data
    const mockEvents: SportsEvent[] = [
      {
        id: "1",
        name: "Super Bowl LVIII",
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        league: "NFL",
        homeTeam: "Kansas City Chiefs",
        awayTeam: "San Francisco 49ers",
        status: "scheduled",
      },
      {
        id: "2",
        name: "Champions League Final",
        date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        league: "UEFA",
        homeTeam: "TBD",
        awayTeam: "TBD",
        status: "scheduled",
      },
    ];

    return mockEvents;
  } catch (error) {
    console.error("Error fetching sports events:", error);
    return [];
  }
}

// Economic Indicators Service
export async function fetchEconomicIndicators(): Promise<Record<string, any>> {
  try {
    // This would integrate with FRED API or similar
    // Placeholder implementation
    return {
      unemploymentRate: 3.7,
      inflationRate: 3.4,
      gdpGrowth: 2.5,
      interestRate: 5.25,
      lastUpdated: new Date(),
    };
  } catch (error) {
    console.error("Error fetching economic indicators:", error);
    return {};
  }
}

// Weather Data Service
export async function fetchWeatherData(city: string): Promise<Record<string, any> | null> {
  try {
    const weatherApiKey = process.env.OPENWEATHER_API_KEY;
    if (!weatherApiKey) {
      console.warn("OPENWEATHER_API_KEY not configured");
      return null;
    }

    const url = "https://api.openweathermap.org/data/2.5/weather";
    const response = await axios.get(url, {
      params: {
        q: city,
        appid: weatherApiKey,
        units: "metric",
      },
    });

    return {
      city,
      temperature: response.data.main.temp,
      humidity: response.data.main.humidity,
      windSpeed: response.data.wind.speed,
      condition: response.data.weather[0].main,
      description: response.data.weather[0].description,
    };
  } catch (error) {
    console.error("Error fetching weather data:", error);
    return null;
  }
}

// Sentiment Analysis Service (using external API or local model)
export async function analyzeSentiment(text: string): Promise<{
  sentiment: "positive" | "negative" | "neutral";
  score: number;
}> {
  try {
    // Placeholder - would integrate with sentiment analysis API
    // For now, simple keyword-based analysis
    const positiveKeywords = ["gain", "profit", "rise", "bull", "growth", "surge"];
    const negativeKeywords = ["loss", "decline", "fall", "bear", "crash", "drop"];

    const lowerText = text.toLowerCase();
    const positiveCount = positiveKeywords.filter((k) => lowerText.includes(k)).length;
    const negativeCount = negativeKeywords.filter((k) => lowerText.includes(k)).length;

    let sentiment: "positive" | "negative" | "neutral" = "neutral";
    let score = 0;

    if (positiveCount > negativeCount) {
      sentiment = "positive";
      score = Math.min(positiveCount / 5, 1);
    } else if (negativeCount > positiveCount) {
      sentiment = "negative";
      score = -Math.min(negativeCount / 5, 1);
    }

    return { sentiment, score };
  } catch (error) {
    console.error("Error analyzing sentiment:", error);
    return { sentiment: "neutral", score: 0 };
  }
}
