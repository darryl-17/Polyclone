import { trpc } from "@/lib/trpc";
import { Loader2, ArrowLeft, Trophy } from "lucide-react";
import { Link } from "wouter";

export default function Leaderboard() {
  const { data: leaderboard = [], isLoading } = trpc.leaderboard.getTop.useQuery(50);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

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

          <div className="flex items-center gap-3 mb-2">
            <Trophy className="w-8 h-8 text-accent" />
            <h1 className="text-3xl font-bold">Leaderboard</h1>
          </div>
          <p className="text-muted-foreground">Top traders by returns</p>
        </div>
      </div>

      <main className="container py-8">
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-background">
                  <th className="px-6 py-4 text-left text-sm font-semibold">Rank</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Trader</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold">Total Returns</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold">Balance</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold">Invested</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                      No traders yet
                    </td>
                  </tr>
                ) : (
                  leaderboard.map((trader, index) => (
                    <tr key={trader.userId} className="border-b border-border hover:bg-background transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {index < 3 && (
                            <span className="text-lg">
                              {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}
                            </span>
                          )}
                          <span className="font-semibold text-sm">#{index + 1}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {trader.userAvatar && (
                            <img
                              src={trader.userAvatar}
                              alt={trader.userName || "User"}
                              className="w-8 h-8 rounded-full"
                            />
                          )}
                          <span className="font-medium">
                            {trader.userName || `User #${trader.userId}`}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`font-semibold ${
                          parseFloat(trader.totalReturns || "0") >= 0
                            ? "text-green-400"
                            : "text-red-400"
                        }`}>
                          ${parseFloat(trader.totalReturns || "0").toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-sm">
                        ${parseFloat(trader.balance || "0").toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-muted-foreground">
                        ${parseFloat(trader.totalInvested || "0").toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
