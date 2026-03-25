import { useMemo, useState } from "react";
import { useRoute } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { AppNav, WatchlistStar } from "@/components/AppNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { getLoginUrl } from "@/const";
import { buildSyntheticOrderBook } from "@/lib/orderBook";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  Loader2,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Link } from "wouter";
import { toast } from "sonner";

export default function MarketDetail() {
  const [, params] = useRoute("/market/:id");
  const marketId = params?.id ? Number.parseInt(params.id, 10) : null;

  const { user, isAuthenticated } = useAuth();
  const isAdmin = user?.role === "admin";

  const [betAmount, setBetAmount] = useState("");
  const [sellShares, setSellShares] = useState("");
  const [selectedOutcome, setSelectedOutcome] = useState<"yes" | "no">("yes");
  const [commentText, setCommentText] = useState("");

  const utils = trpc.useUtils();

  const { data: market, isLoading: marketLoading } =
    trpc.markets.getById.useQuery(marketId ?? 0, { enabled: !!marketId });

  const { data: priceHistory = [] } = trpc.markets.getPriceHistory.useQuery(
    { marketId: marketId ?? 0, hours: 168 },
    { enabled: !!marketId }
  );

  const { data: comments = [] } = trpc.comments.list.useQuery(
    { marketId: marketId ?? 0, limit: 50 },
    { enabled: !!marketId }
  );

  const { data: news = [] } = trpc.news.getNews.useQuery(
    { query: market?.title, limit: 10 },
    { enabled: !!market }
  );

  const { data: portfolio } = trpc.portfolio.get.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const { data: myPositions = [] } = trpc.portfolio.positions.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  const { data: watchIds = [] } = trpc.watchlist.ids.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const { data: activity = [] } = trpc.bets.getMarketBets.useQuery(
    marketId ?? 0,
    { enabled: !!marketId }
  );

  const { data: holders = [] } = trpc.markets.getPositions.useQuery(
    marketId ?? 0,
    { enabled: !!marketId }
  );

  const { data: aiPred } = trpc.aiPredictions.getMarketPrediction.useQuery(
    marketId ?? 0,
    { enabled: !!marketId }
  );

  const placeBetMutation = trpc.bets.place.useMutation({
    onSuccess: async () => {
      toast.success("Trade filled");
      setBetAmount("");
      await Promise.all([
        utils.markets.getById.invalidate(marketId!),
        utils.markets.getPriceHistory.invalidate({
          marketId: marketId!,
          hours: 168,
        }),
        utils.portfolio.get.invalidate(),
        utils.portfolio.positions.invalidate(),
        utils.bets.getMarketBets.invalidate(marketId!),
        utils.markets.getPositions.invalidate(marketId!),
        utils.bets.getUserBets.invalidate(),
      ]);
    },
    onError: (e) => toast.error(e.message || "Trade failed"),
  });

  const sellMutation = trpc.bets.sell.useMutation({
    onSuccess: async () => {
      toast.success("Sold");
      setSellShares("");
      await Promise.all([
        utils.markets.getById.invalidate(marketId!),
        utils.portfolio.get.invalidate(),
        utils.portfolio.positions.invalidate(),
        utils.bets.getMarketBets.invalidate(marketId!),
        utils.markets.getPositions.invalidate(marketId!),
      ]);
    },
    onError: (e) => toast.error(e.message || "Sell failed"),
  });

  const commentMutation = trpc.comments.create.useMutation({
    onSuccess: async () => {
      setCommentText("");
      await utils.comments.list.invalidate({ marketId: marketId!, limit: 50 });
    },
    onError: (e) => toast.error(e.message || "Could not post"),
  });

  const resolveMutation = trpc.markets.resolve.useMutation({
    onSuccess: async () => {
      toast.success("Market resolved");
      await utils.markets.getById.invalidate(marketId!);
    },
    onError: (e) => toast.error(e.message || "Resolve failed"),
  });

  const positionThisMarket = useMemo(
    () => myPositions.filter((p) => p.marketId === marketId),
    [myPositions, marketId]
  );

  const yesPos = positionThisMarket.find((p) => p.outcome === "yes");
  const noPos = positionThisMarket.find((p) => p.outcome === "no");

  const yesPrice = parseFloat(market?.yesPrice || "50");
  const noPrice = parseFloat(market?.noPrice || "50");
  const fillPrice = selectedOutcome === "yes" ? yesPrice : noPrice;

  const buySharesPreview =
    betAmount && fillPrice > 0
      ? parseFloat(betAmount) / (fillPrice / 100)
      : 0;
  const maxPayoutPreview = buySharesPreview;

  const orderBook = useMemo(
    () => buildSyntheticOrderBook(yesPrice),
    [yesPrice]
  );

  const chartData = priceHistory.map((ph) => ({
    time: new Date(ph.recordedAt).toLocaleString(),
    yes: parseFloat(ph.yesPrice || "0"),
    no: parseFloat(ph.noPrice || "0"),
  }));

  const handleBuy = () => {
    if (!marketId || !betAmount || !isAuthenticated) {
      toast.error("Log in and enter an amount");
      return;
    }
    const amount = parseFloat(betAmount);
    if (Number.isNaN(amount) || amount <= 0) {
      toast.error("Invalid amount");
      return;
    }
    placeBetMutation.mutate({
      marketId,
      outcome: selectedOutcome,
      amount,
      priceAtBet: fillPrice,
    });
  };

  const handleSell = () => {
    if (!marketId || !sellShares || !isAuthenticated) return;
    const sh = parseFloat(sellShares);
    if (Number.isNaN(sh) || sh <= 0) {
      toast.error("Invalid shares");
      return;
    }
    sellMutation.mutate({
      marketId,
      outcome: selectedOutcome,
      shares: sh,
    });
  };

  const maxSell =
    selectedOutcome === "yes"
      ? parseFloat(yesPos?.shares || "0")
      : parseFloat(noPos?.shares || "0");

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
        <AppNav />
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

  const resolved = !!market.resolvedAt;
  const watched = watchIds.includes(market.id);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppNav />

      <div className="border-b border-border">
        <div className="container py-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <Link href="/">
                <a className="flex items-center gap-2 text-accent hover:underline mb-4 text-sm">
                  <ArrowLeft className="w-4 h-4" />
                  Markets
                </a>
              </Link>
              <div className="flex items-start gap-2">
                <h1 className="text-2xl sm:text-3xl font-bold mb-2 flex-1">
                  {market.title}
                </h1>
                {isAuthenticated && (
                  <WatchlistStar
                    marketId={market.id}
                    isWatched={watched}
                    disabled={resolved}
                  />
                )}
              </div>
              {market.description && (
                <p className="text-muted-foreground mb-4 max-w-3xl">
                  {market.description}
                </p>
              )}
              <div className="flex gap-2 flex-wrap items-center">
                <span className="market-category">{market.category}</span>
                {market.subcategory && (
                  <span className="market-category">{market.subcategory}</span>
                )}
                {resolved && (
                  <span className="text-xs uppercase tracking-wide text-amber-500 border border-amber-500/40 px-2 py-0.5 rounded">
                    Resolved: {market.resolution}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="container py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Odds</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-background rounded-lg">
                  <div className="text-sm text-muted-foreground mb-2">Yes</div>
                  <div className="text-4xl font-bold probability-yes">
                    {yesPrice}%
                  </div>
                </div>
                <div className="text-center p-4 bg-background rounded-lg">
                  <div className="text-sm text-muted-foreground mb-2">No</div>
                  <div className="text-4xl font-bold probability-no">
                    {noPrice}%
                  </div>
                </div>
              </div>
              <div className="mt-4 text-sm text-muted-foreground">
                Volume: $
                {Number.parseFloat(market.totalVolume || "0").toLocaleString()}
              </div>
            </div>

            {aiPred && (
              <div className="bg-card border border-border rounded-lg p-6">
                <h2 className="text-lg font-semibold mb-2">AI insight</h2>
                <p className="text-sm">{aiPred.prediction}</p>
                {aiPred.confidence != null && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Confidence: {parseFloat(String(aiPred.confidence))}%
                  </p>
                )}
              </div>
            )}

            {chartData.length > 0 && (
              <div className="bg-card border border-border rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4">Price history</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="time" stroke="var(--muted-foreground)" />
                    <YAxis stroke="var(--muted-foreground)" domain={[0, 100]} />
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

            <Tabs defaultValue="book">
              <TabsList className="flex flex-wrap h-auto gap-1">
                <TabsTrigger value="book">Order book</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
                <TabsTrigger value="holders">Holders</TabsTrigger>
                <TabsTrigger value="discussion">Discussion</TabsTrigger>
              </TabsList>

              <TabsContent value="book" className="mt-4">
                <div className="bg-card border border-border rounded-lg p-4 grid sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="font-semibold mb-2 text-muted-foreground">
                      Asks (Yes)
                    </div>
                    <div className="space-y-1 font-mono text-xs">
                      {orderBook.asks.map((r) => (
                        <div
                          key={`a-${r.price}`}
                          className="flex justify-between text-red-400/90"
                        >
                          <span>{r.price}¢</span>
                          <span>{r.size.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold mb-2 text-muted-foreground">
                      Bids (Yes)
                    </div>
                    <div className="space-y-1 font-mono text-xs">
                      {orderBook.bids.map((r) => (
                        <div
                          key={`b-${r.price}`}
                          className="flex justify-between text-emerald-400/90"
                        >
                          <span>{r.price}¢</span>
                          <span>{r.size.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Synthetic book for UI; real Polymarket uses a central limit order
                  book.
                </p>
              </TabsContent>

              <TabsContent value="activity" className="mt-4">
                <div className="bg-card border border-border rounded-lg divide-y divide-border max-h-80 overflow-y-auto">
                  {activity.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground">
                      No trades yet
                    </p>
                  ) : (
                    activity.map((row) => (
                      <div
                        key={row.id}
                        className="p-3 text-sm flex justify-between gap-2"
                      >
                        <div>
                          <span className="font-medium">
                            {row.userName || `User #${row.userId}`}
                          </span>{" "}
                          <span className="text-muted-foreground">
                            {row.side} {row.outcome.toUpperCase()}
                          </span>
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          <div>
                            ${parseFloat(String(row.notionalUsd)).toFixed(2)}
                          </div>
                          <div>
                            {new Date(row.createdAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="holders" className="mt-4">
                <div className="bg-card border border-border rounded-lg divide-y divide-border max-h-80 overflow-y-auto">
                  {holders.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground">
                      No open positions
                    </p>
                  ) : (
                    holders.map((h, i) => (
                      <div
                        key={`${h.userId}-${h.outcome}-${i}`}
                        className="p-3 text-sm flex justify-between"
                      >
                        <span>{h.userName || `User #${h.userId}`}</span>
                        <span>
                          {h.outcome.toUpperCase()}{" "}
                          {parseFloat(String(h.shares)).toFixed(2)} sh
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="discussion" className="mt-4 space-y-4">
                {isAuthenticated && !resolved && (
                  <div className="space-y-2">
                    <Textarea
                      placeholder="Share your take…"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      className="min-h-[88px]"
                      maxLength={1000}
                    />
                    <Button
                      type="button"
                      disabled={
                        commentMutation.isPending || commentText.trim().length === 0
                      }
                      onClick={() => {
                        if (!marketId) return;
                        commentMutation.mutate({
                          marketId,
                          content: commentText.trim(),
                        });
                      }}
                    >
                      {commentMutation.isPending ? "Posting…" : "Post comment"}
                    </Button>
                  </div>
                )}
                <div className="space-y-4">
                  {comments.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      No comments yet
                    </p>
                  ) : (
                    comments.map((c) => (
                      <div
                        key={c.id}
                        className="border-b border-border pb-4 last:border-0"
                      >
                        <div className="flex justify-between gap-2 mb-1">
                          <span className="font-medium text-sm">
                            {c.userName || `User #${c.userId}`}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(c.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm">{c.content}</p>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <div className="lg:col-span-1 space-y-6">
            <div className="bg-card border border-border rounded-lg p-6 lg:sticky lg:top-24">
              <h2 className="text-xl font-semibold mb-4">Trade</h2>

              {!isAuthenticated ? (
                <div className="text-center py-6">
                  <p className="text-muted-foreground mb-4 text-sm">
                    Log in to trade
                  </p>
                  <a href={getLoginUrl()}>
                    <Button className="w-full">Log in</Button>
                  </a>
                </div>
              ) : resolved ? (
                <p className="text-sm text-muted-foreground">
                  This market is resolved; trading is closed.
                </p>
              ) : (
                <>
                  <div className="bg-background rounded-lg p-3 mb-4">
                    <div className="text-xs text-muted-foreground mb-1">
                      Cash balance
                    </div>
                    <div className="text-2xl font-bold">
                      ${parseFloat(portfolio?.balance || "0").toFixed(2)}
                    </div>
                  </div>

                  {(yesPos || noPos) && (
                    <div className="text-xs text-muted-foreground mb-4 space-y-1">
                      {yesPos && (
                        <div>
                          Yes: {parseFloat(String(yesPos.shares)).toFixed(2)} sh
                          @ avg {parseFloat(String(yesPos.avgPriceCents)).toFixed(1)}
                          ¢
                        </div>
                      )}
                      {noPos && (
                        <div>
                          No: {parseFloat(String(noPos.shares)).toFixed(2)} sh @ avg{" "}
                          {parseFloat(String(noPos.avgPriceCents)).toFixed(1)}¢
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <button
                      type="button"
                      onClick={() => setSelectedOutcome("yes")}
                      className={`py-3 rounded-lg font-semibold transition-colors ${
                        selectedOutcome === "yes"
                          ? "bg-green-500/20 text-green-400 border border-green-500/50"
                          : "bg-background border border-border"
                      }`}
                    >
                      Buy Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedOutcome("no")}
                      className={`py-3 rounded-lg font-semibold transition-colors ${
                        selectedOutcome === "no"
                          ? "bg-red-500/20 text-red-400 border border-red-500/50"
                          : "bg-background border border-border"
                      }`}
                    >
                      Buy No
                    </button>
                  </div>

                  <label className="text-sm text-muted-foreground block mb-2">
                    Amount (USDC)
                  </label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={betAmount}
                    onChange={(e) => setBetAmount(e.target.value)}
                    className="search-input mb-4"
                  />

                  {betAmount && (
                    <div className="bg-background rounded-lg p-3 mb-4 text-sm">
                      <div className="text-xs text-muted-foreground">
                        Est. shares
                      </div>
                      <div className="font-semibold">
                        {buySharesPreview.toFixed(2)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-2">
                        Max payout if right
                      </div>
                      <div className="font-semibold text-emerald-400">
                        ${maxPayoutPreview.toFixed(2)}
                      </div>
                    </div>
                  )}

                  <Button
                    className="w-full mb-6"
                    onClick={handleBuy}
                    disabled={placeBetMutation.isPending || !betAmount}
                  >
                    {placeBetMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin inline" />
                        Buying…
                      </>
                    ) : (
                      "Buy"
                    )}
                  </Button>

                  <div className="border-t border-border pt-4">
                    <h3 className="font-semibold mb-2 text-sm">Sell shares</h3>
                    <div className="text-xs text-muted-foreground mb-2">
                      Max: {maxSell.toFixed(2)} ({selectedOutcome.toUpperCase()})
                    </div>
                    <Input
                      type="number"
                      placeholder="Shares"
                      value={sellShares}
                      onChange={(e) => setSellShares(e.target.value)}
                      className="search-input mb-2"
                    />
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={handleSell}
                      disabled={
                        sellMutation.isPending ||
                        !sellShares ||
                        maxSell <= 0
                      }
                    >
                      {sellMutation.isPending ? "Selling…" : "Sell"}
                    </Button>
                  </div>
                </>
              )}
            </div>

            {news && news.length > 0 && (
              <div className="bg-card border border-border rounded-lg p-6">
                <h3 className="font-semibold mb-4">Related news</h3>
                <div className="space-y-3">
                  {news.map((article: { id?: string; title?: string; url?: string; source?: { name?: string } }) => {
                    const newsKey = article.id || article.title || "";
                    const newsUrl = article.url || "#";
                    const newsTitle = article.title || "News";
                    const newsSource = article.source?.name || "News";
                    return (
                      <a
                        key={newsKey}
                        href={newsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-sm hover:text-accent transition-colors"
                      >
                        <div className="font-medium line-clamp-2">{newsTitle}</div>
                        <div className="text-xs text-muted-foreground">
                          {newsSource}
                        </div>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

            {isAdmin && !resolved && (
              <div className="bg-card border border-amber-500/30 rounded-lg p-6">
                <h3 className="font-semibold mb-2 text-amber-500">
                  Admin: resolve
                </h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Credits wallets and closes the market.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      resolveMutation.mutate({
                        marketId: market.id,
                        resolution: "yes",
                      })
                    }
                    disabled={resolveMutation.isPending}
                  >
                    Yes
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      resolveMutation.mutate({
                        marketId: market.id,
                        resolution: "no",
                      })
                    }
                    disabled={resolveMutation.isPending}
                  >
                    No
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      resolveMutation.mutate({
                        marketId: market.id,
                        resolution: "invalid",
                      })
                    }
                    disabled={resolveMutation.isPending}
                  >
                    Invalid
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
