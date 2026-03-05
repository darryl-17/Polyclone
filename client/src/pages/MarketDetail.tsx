import { useState } from "react";
import { useRoute } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowLeft, TrendingUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Link } from "wouter";
import { toast } from "sonner";

export default function MarketDetail() {
  const [, params] = useRoute("/market/:id");
  const marketId = params?.id ? parseInt(params.id) : null;
  
  const { user, isAuthenticated } = useAuth();
  const [betAmount, setBetAmount] = useState<string>("");
  const [selectedOutcome, setSelectedOutcome] = useState<"yes" | "no">("yes");

  // Fetch market details
  const { data: market, isLoading: marketLoading } = trpc.markets.getById.useQuery(
    marketId || 0,
    { enabled: !!marketId }
  );

  // Fetch price history for chart
  const { data: priceHistory = [] } = trpc.markets.getPriceHistory.useQuery(
    { marketId: marketId || 0, hours: 24 },
    { enabled: !!marketId }
  );

  // Fetch comments
  const { data: comments = [] } = trpc.comments.list.useQuery(
    { marketId: marketId || 0, limit: 20 },
    { enabled: !!marketId }
  );

  // Fetch news
  const { data: news = [] } = trpc.news.getMarketNews.useQuery(
    { marketId: marketId || 0, limit: 10 },
    { enabled: !!marketId }
  );

  // Fetch user portfolio
  const { data: portfolio } = trpc.portfolio.get.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  // Place bet mutation
  const placeBetMutation = trpc.bets.place.useMutation({
    onSuccess: () => {
      toast.success("Bet placed successfully!");
      setBetAmount("");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to place bet");
    },
  });

  // Create comment mutation
  const createCommentMutation = trpc.comments.create.useMutation({
    onSuccess: () => {
      toast.success("Comment posted!");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to post comment");
    },
  });

  const handlePlaceBet = async () => {
    if (!marketId || !betAmount || !isAuthenticated) {
      toast.error("Please fill in all fields and log in");
      return;
    }

    const amount = parseFloat(betAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    const priceAtBet = selectedOutcome === "yes" 
      ? parseFloat(market?.yesPrice || "50")
      : parseFloat(market?.noPrice || "50");

    placeBetMutation.mutate({
      marketId,
      outcome: selectedOutcome,
      amount,
      priceAtBet,
    });
  };

  if (marketLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!market) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="container py-8">
          <Link href="/">
            <a className="flex items-center gap-2 text-accent hover:underline mb-8">
              <ArrowLeft className="w-4 h-4" />
              Back to Markets
            </a>
          </Link>
          <p className="text-muted-foreground">Market not found</p>
        </div>
      </div>
    );
  }

  const chartData = priceHistory.map((ph) => ({
    time: new Date(ph.recordedAt).toLocaleTimeString(),
    yes: parseFloat(ph.yesPrice || "0"),
    no: parseFloat(ph.noPrice || "0"),
  }));

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border">
        <div className="container py-8">
          <Link href="/">
            <a className="flex items-center gap-2 text-accent hover:underline mb-4">
              <ArrowLeft className="w-4 h-4" />
              Back to Markets
            </a>
          </Link>

          <h1 className="text-3xl font-bold mb-2">{market.title}</h1>
          <p className="text-muted-foreground mb-4">{market.description}</p>

          <div className="flex gap-4 flex-wrap">
            <span className="market-category">{market.category}</span>
            {market.subcategory && (
              <span className="market-category">{market.subcategory}</span>
            )}
          </div>
        </div>
      </div>

      <main className="container py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Chart and Details */}
          <div className="lg:col-span-2">
            {/* Probabilities */}
            <div className="bg-card border border-border rounded-lg p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Current Odds</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-background rounded-lg">
                  <div className="text-sm text-muted-foreground mb-2">Yes</div>
                  <div className="text-4xl font-bold probability-yes">
                    {parseFloat(market.yesPrice || "50")}%
                  </div>
                </div>
                <div className="text-center p-4 bg-background rounded-lg">
                  <div className="text-sm text-muted-foreground mb-2">No</div>
                  <div className="text-4xl font-bold probability-no">
                    {parseFloat(market.noPrice || "50")}%
                  </div>
                </div>
              </div>
              <div className="mt-4 text-sm text-muted-foreground">
                Volume: ${(parseFloat(market.totalVolume || "0") / 1000000).toFixed(2)}M
              </div>
            </div>

            {/* Price Chart */}
            {chartData.length > 0 && (
              <div className="bg-card border border-border rounded-lg p-6 mb-6">
                <h2 className="text-xl font-semibold mb-4">Price History (24h)</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="time" stroke="var(--muted-foreground)" />
                    <YAxis stroke="var(--muted-foreground)" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        border: "1px solid var(--border)",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="yes"
                      stroke="var(--chart-1)"
                      dot={false}
                      name="Yes"
                    />
                    <Line
                      type="monotone"
                      dataKey="no"
                      stroke="var(--chart-2)"
                      dot={false}
                      name="No"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Comments Section */}
            <div className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Discussion</h2>
              <div className="space-y-4">
                {comments.length === 0 ? (
                  <p className="text-muted-foreground">No comments yet</p>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className="border-b border-border pb-4 last:border-b-0">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium text-sm">User #{comment.userId}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(comment.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-foreground">{comment.content}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Betting Panel */}
          <div className="lg:col-span-1">
            {/* Betting Card */}
            <div className="bg-card border border-border rounded-lg p-6 sticky top-20">
              <h2 className="text-xl font-semibold mb-4">Place a Bet</h2>

              {!isAuthenticated ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">Sign in to place bets</p>
                  <a href="/login">
                    <Button className="w-full">Sign In</Button>
                  </a>
                </div>
              ) : (
                <>
                  {/* Balance */}
                  <div className="bg-background rounded-lg p-3 mb-4">
                    <div className="text-xs text-muted-foreground mb-1">Available Balance</div>
                    <div className="text-2xl font-bold">
                      ${(parseFloat(portfolio?.balance || "0")).toFixed(2)}
                    </div>
                  </div>

                  {/* Outcome Selection */}
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <button
                      onClick={() => setSelectedOutcome("yes")}
                      className={`py-3 rounded-lg font-semibold transition-colors ${
                        selectedOutcome === "yes"
                          ? "bg-green-500/20 text-green-400 border border-green-500/50"
                          : "bg-background border border-border text-foreground hover:border-accent"
                      }`}
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setSelectedOutcome("no")}
                      className={`py-3 rounded-lg font-semibold transition-colors ${
                        selectedOutcome === "no"
                          ? "bg-red-500/20 text-red-400 border border-red-500/50"
                          : "bg-background border border-border text-foreground hover:border-accent"
                      }`}
                    >
                      No
                    </button>
                  </div>

                  {/* Amount Input */}
                  <div className="mb-4">
                    <label className="text-sm text-muted-foreground block mb-2">
                      Amount to Bet
                    </label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={betAmount}
                      onChange={(e) => setBetAmount(e.target.value)}
                      className="search-input"
                    />
                  </div>

                  {/* Potential Payout */}
                  {betAmount && (
                    <div className="bg-background rounded-lg p-3 mb-4">
                      <div className="text-xs text-muted-foreground mb-1">Potential Payout</div>
                      <div className="text-lg font-bold">
                        ${(parseFloat(betAmount) * 2).toFixed(2)}
                      </div>
                    </div>
                  )}

                  {/* Place Bet Button */}
                  <Button
                    className="w-full"
                    onClick={handlePlaceBet}
                    disabled={placeBetMutation.isPending || !betAmount}
                  >
                    {placeBetMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Placing Bet...
                      </>
                    ) : (
                      "Place Bet"
                    )}
                  </Button>
                </>
              )}
            </div>

            {/* News Section */}
            {news.length > 0 && (
              <div className="bg-card border border-border rounded-lg p-6 mt-6">
                <h3 className="font-semibold mb-4">Related News</h3>
                <div className="space-y-3">
                  {news.map((article) => (
                    <a
                      key={article.id}
                      href={article.url || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-sm hover:text-accent transition-colors"
                    >
                      <div className="font-medium line-clamp-2">{article.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {article.source}
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
