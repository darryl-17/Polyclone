import { AppNav } from "@/components/AppNav";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

export default function HowItWorks() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppNav />
      <main className="container max-w-3xl py-12">
        <Link href="/">
          <a className="inline-flex items-center gap-2 text-accent hover:underline mb-8 text-sm">
            <ArrowLeft className="w-4 h-4" />
            Back to markets
          </a>
        </Link>

        <h1 className="text-3xl font-bold mb-2">How Polyclone works</h1>
        <p className="text-muted-foreground mb-10">
          Polyclone is a paper-trading prediction market inspired by Polymarket.
          You trade outcome shares with virtual USDC—no blockchain wallet required
          for this demo.
        </p>

        <section className="space-y-8 text-sm leading-relaxed">
          <div>
            <h2 className="text-lg font-semibold mb-2">Markets & outcomes</h2>
            <p className="text-muted-foreground">
              Each market asks a yes/no question. Prices are shown in cents and
              approximate the market&apos;s view of probability. Yes and No prices
              move with buys and sells using a simple liquidity model.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-2">Buying & selling</h2>
            <p className="text-muted-foreground">
              When you buy, you spend balance to receive shares. If the market
              resolves in your favor, each share pays about $1.00. You can sell
              shares before resolution to take profits or cut losses. After
              resolution, positions are settled automatically.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-2">Balance & demo deposits</h2>
            <p className="text-muted-foreground">
              Use{" "}
              <Link href="/portfolio">
                <a className="text-accent underline">Portfolio</a>
              </Link>{" "}
              to add demo funds for testing. Production deployments would connect
              real payments (e.g. card or stablecoin) and compliance flows.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-2">Resolution</h2>
            <p className="text-muted-foreground">
              Admins can resolve markets to Yes, No, or Invalid. Invalid refunds
              your cost basis. On the real Polymarket, resolution uses oracle
              infrastructure; here it is manual for the demo.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-2">What is not replicated</h2>
            <p className="text-muted-foreground">
              Polymarket runs on-chain conditional tokens, USDC on Polygon, and a
              central limit order book. This app uses a database and simulated
              liquidity so you can explore the product surface without wallets
              or gas.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
