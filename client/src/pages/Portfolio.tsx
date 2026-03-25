import { useAuth } from "@/_core/hooks/useAuth";
import { AppNav } from "@/components/AppNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Loader2, ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { toast } from "sonner";

export default function Portfolio() {
  const { user, isAuthenticated } = useAuth();
  const [depositAmount, setDepositAmount] = useState("");

  const { data: portfolio, isLoading: portfolioLoading } =
    trpc.portfolio.get.useQuery(undefined, { enabled: isAuthenticated });

  const { data: bets = [] } = trpc.bets.getUserBets.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const { data: openPositions = [] } = trpc.portfolio.positions.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  const { data: transactions = [] } = trpc.stripe.getTransactions.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  const utils = trpc.useUtils();

  const depositDemoMutation = trpc.portfolio.depositDemo.useMutation({
    onSuccess: async () => {
      toast.success("Demo deposit credited");
      setDepositAmount("");
      await Promise.all([
        utils.portfolio.get.invalidate(),
        utils.stripe.getTransactions.invalidate(),
        utils.notifications.list.invalidate(),
      ]);
    },
    onError: (e) => toast.error(e.message || "Deposit failed"),
  });

  const createTransactionMutation = trpc.stripe.createTransaction.useMutation({
    onSuccess: () => {
      toast.success("Withdrawal recorded (pending)");
    },
    onError: (error) => {
      toast.error(error.message || "Failed");
    },
  });

  const handleDemoDeposit = () => {
    if (!depositAmount) {
      toast.error("Enter an amount");
      return;
    }
    const amount = parseFloat(depositAmount);
    if (Number.isNaN(amount) || amount <= 0) {
      toast.error("Invalid amount");
      return;
    }
    depositDemoMutation.mutate(amount);
  };

  const handleWithdrawStub = () => {
    if (!depositAmount) {
      toast.error("Enter an amount");
      return;
    }
    const amount = parseFloat(depositAmount);
    if (Number.isNaN(amount) || amount <= 0) return;
    createTransactionMutation.mutate({
      type: "withdrawal",
      amount,
    });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <AppNav />
        <div className="container py-8">
          <p className="text-muted-foreground">Log in to view your portfolio</p>
        </div>
      </div>
    );
  }

  if (portfolioLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  const totalReturns = parseFloat(portfolio?.totalReturns || "0");
  const isPositive = totalReturns >= 0;

  const activePositions = openPositions.filter((p) => !p.resolvedAt);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppNav />

      <div className="border-b border-border">
        <div className="container py-8">
          <Link href="/">
            <a className="flex items-center gap-2 text-accent hover:underline mb-4">
              <ArrowLeft className="w-4 h-4" />
              Markets
            </a>
          </Link>

          <h1 className="text-3xl font-bold mb-2">Portfolio</h1>
          <p className="text-muted-foreground">{user?.name}</p>
        </div>
      </div>

      <main className="container py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-lg text-muted-foreground mb-2">Cash</h2>
              <div className="text-4xl font-bold mb-4">
                ${parseFloat(portfolio?.balance || "0").toFixed(2)}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">
                    Invested
                  </div>
                  <div className="text-2xl font-semibold">
                    ${parseFloat(portfolio?.totalInvested || "0").toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">
                    Realized P&amp;L
                  </div>
                  <div
                    className={`text-2xl font-semibold flex items-center gap-2 ${
                      isPositive ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {isPositive ? (
                      <TrendingUp className="w-5 h-5" />
                    ) : (
                      <TrendingDown className="w-5 h-5" />
                    )}
                    ${Math.abs(totalReturns).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Open positions</h2>
              {activePositions.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No open positions — buy shares on any market.
                </p>
              ) : (
                <div className="space-y-3">
                  {activePositions.map((p) => (
                    <Link key={p.id} href={`/market/${p.marketId}`}>
                      <a className="block border border-border rounded-lg p-4 hover:bg-background/50 transition-colors">
                        <div className="font-medium line-clamp-2">{p.title}</div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {p.outcome.toUpperCase()} ·{" "}
                          {parseFloat(String(p.shares)).toFixed(2)} sh @ avg{" "}
                          {parseFloat(String(p.avgPriceCents)).toFixed(1)}¢
                        </div>
                      </a>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Trade history</h2>
              {bets.length === 0 ? (
                <p className="text-muted-foreground text-sm">No trades yet</p>
              ) : (
                <div className="space-y-3">
                  {bets.map((row) => (
                    <div
                      key={row.id}
                      className="border border-border rounded-lg p-4 flex flex-wrap justify-between gap-2"
                    >
                      <div>
                        <Link href={`/market/${row.marketId}`}>
                          <a className="font-medium hover:text-accent line-clamp-2">
                            {row.marketTitle || `Market #${row.marketId}`}
                          </a>
                        </Link>
                        <div className="text-sm text-muted-foreground">
                          {(row.side || "buy").toUpperCase()}{" "}
                          {row.outcome.toUpperCase()} · $
                          {parseFloat(String(row.amount)).toFixed(2)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          @ {parseFloat(String(row.priceAtBet)).toFixed(1)}¢
                          {row.shares != null && (
                            <> · {parseFloat(String(row.shares)).toFixed(2)} sh</>
                          )}
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        {row.settledAt ? (
                          <span className="text-muted-foreground">Market settled</span>
                        ) : (
                          <span className="text-accent">Open market</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-card border border-border rounded-lg p-6 lg:sticky lg:top-24 space-y-4">
              <h2 className="text-xl font-semibold">Funds</h2>
              <p className="text-xs text-muted-foreground">
                Demo deposit credits cash for paper trading. Stripe path records
                a pending row only (no real card charge in this template).
              </p>

              <div>
                <label className="text-sm text-muted-foreground block mb-2">
                  Amount (USD)
                </label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="search-input"
                />
              </div>

              <Button
                className="w-full"
                onClick={handleDemoDeposit}
                disabled={depositDemoMutation.isPending || !depositAmount}
              >
                {depositDemoMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin inline" />
                    Crediting…
                  </>
                ) : (
                  "Demo deposit"
                )}
              </Button>

              <Button
                variant="outline"
                className="w-full"
                onClick={handleWithdrawStub}
                disabled={createTransactionMutation.isPending || !depositAmount}
              >
                {createTransactionMutation.isPending
                  ? "Recording…"
                  : "Request withdrawal (stub)"}
              </Button>

              <div className="pt-4 border-t border-border">
                <h3 className="font-semibold mb-3 text-sm">Ledger</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {transactions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No rows yet</p>
                  ) : (
                    transactions.slice(0, 8).map((tx) => (
                      <div
                        key={tx.id}
                        className="flex justify-between items-center text-sm border-b border-border pb-2 last:border-0"
                      >
                        <div>
                          <div className="font-medium capitalize">{tx.type}</div>
                          <div className="text-xs text-muted-foreground">
                            {tx.status}
                          </div>
                        </div>
                        <div className="font-semibold">
                          ${parseFloat(tx.amount || "0").toFixed(2)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
