import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { toast } from "sonner";

export default function Portfolio() {
  const { user, isAuthenticated } = useAuth();
  const [depositAmount, setDepositAmount] = useState<string>("");

  // Fetch portfolio
  const { data: portfolio, isLoading: portfolioLoading } = trpc.portfolio.get.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  // Fetch user bets
  const { data: bets = [] } = trpc.bets.getUserBets.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  // Fetch stripe transactions
  const { data: transactions = [] } = trpc.stripe.getTransactions.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  // Create stripe transaction
  const createTransactionMutation = trpc.stripe.createTransaction.useMutation({
    onSuccess: () => {
      toast.success("Deposit initiated! Redirecting to payment...");
      setDepositAmount("");
      // In a real app, you would redirect to Stripe checkout here
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create transaction");
    },
  });

  const handleDeposit = async () => {
    if (!depositAmount) {
      toast.error("Please enter an amount");
      return;
    }

    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    createTransactionMutation.mutate({
      type: "deposit",
      amount,
    });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="container py-8">
          <p className="text-muted-foreground">Please log in to view your portfolio</p>
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

          <h1 className="text-3xl font-bold mb-2">Your Portfolio</h1>
          <p className="text-muted-foreground">{user?.name}</p>
        </div>
      </div>

      <main className="container py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Portfolio Stats */}
          <div className="lg:col-span-2">
            {/* Balance Card */}
            <div className="bg-card border border-border rounded-lg p-6 mb-6">
              <h2 className="text-lg text-muted-foreground mb-2">Available Balance</h2>
              <div className="text-4xl font-bold mb-4">
                ${(parseFloat(portfolio?.balance || "0")).toFixed(2)}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Total Invested</div>
                  <div className="text-2xl font-semibold">
                    ${(parseFloat(portfolio?.totalInvested || "0")).toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Total Returns</div>
                  <div className={`text-2xl font-semibold flex items-center gap-2 ${
                    isPositive ? "text-green-400" : "text-red-400"
                  }`}>
                    {isPositive ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                    ${Math.abs(totalReturns).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            {/* Active Bets */}
            <div className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Active Bets</h2>
              {bets.length === 0 ? (
                <p className="text-muted-foreground">No active bets</p>
              ) : (
                <div className="space-y-4">
                  {bets.map((bet) => (
                    <div
                      key={bet.id}
                      className="border border-border rounded-lg p-4 flex justify-between items-center"
                    >
                      <div>
                        <div className="font-medium">Market #{bet.marketId}</div>
                        <div className="text-sm text-muted-foreground">
                          Bet: {bet.outcome.toUpperCase()} • Amount: ${parseFloat(bet.amount || "0").toFixed(2)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Price at bet: {parseFloat(bet.priceAtBet || "0")}%
                        </div>
                      </div>
                      <div className="text-right">
                        {bet.settledAt ? (
                          <div className="text-sm font-semibold">
                            Payout: ${parseFloat(bet.payout || "0").toFixed(2)}
                          </div>
                        ) : (
                          <div className="text-sm text-accent">Active</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Deposit/Withdraw */}
          <div className="lg:col-span-1">
            {/* Deposit Card */}
            <div className="bg-card border border-border rounded-lg p-6 sticky top-20">
              <h2 className="text-xl font-semibold mb-4">Deposit Funds</h2>

              <div className="mb-4">
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
                className="w-full mb-2"
                onClick={handleDeposit}
                disabled={createTransactionMutation.isPending || !depositAmount}
              >
                {createTransactionMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Deposit with Stripe"
                )}
              </Button>

              <Button variant="outline" className="w-full">
                Withdraw Funds
              </Button>

              {/* Transaction History */}
              <div className="mt-6">
                <h3 className="font-semibold mb-3">Recent Transactions</h3>
                <div className="space-y-2">
                  {transactions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No transactions yet</p>
                  ) : (
                    transactions.slice(0, 5).map((tx) => (
                      <div
                        key={tx.id}
                        className="flex justify-between items-center text-sm border-b border-border pb-2 last:border-b-0"
                      >
                        <div>
                          <div className="font-medium capitalize">{tx.type}</div>
                          <div className="text-xs text-muted-foreground">{tx.status}</div>
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
