import { useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { AppNav } from "@/components/AppNav";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, TrendingUp } from "lucide-react";
import { Link } from "wouter";

const CATEGORIES = [
  "Trending",
  "Breaking",
  "New",
  "Politics",
  "Sports",
  "Crypto",
  "Iran",
  "Finance",
  "Geopolitics",
  "Tech",
  "Culture",
  "Economy",
  "Climate & Science",
] as const;

function categoryToQuery(selected: string): {
  category?: string;
  sort?: "new" | "trending" | "ending" | "volume24h";
} {
  if (selected === "Trending") return { sort: "trending" };
  if (selected === "Breaking") return { sort: "volume24h" };
  if (selected === "New") return { sort: "new" };
  return { category: selected, sort: "new" };
}

export default function Home() {
  const { isAuthenticated } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string>("Trending");
  const [searchQuery, setSearchQuery] = useState("");
  const [offset, setOffset] = useState(0);

  const { category, sort } = useMemo(
    () => categoryToQuery(selectedCategory),
    [selectedCategory]
  );

  const { data: markets = [], isLoading } = trpc.markets.list.useQuery({
    category,
    search: searchQuery || undefined,
    limit: 20,
    offset,
    sort,
    liveOnly: true,
  });

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setOffset(0);
  };

  const handleCategoryChange = (c: string) => {
    setSelectedCategory(c);
    setOffset(0);
    setSearchQuery("");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppNav
        showSearch
        searchQuery={searchQuery}
        onSearchChange={(v) => {
          setSearchQuery(v);
          setOffset(0);
        }}
      />

      <div className="border-t border-border">
        <div className="container overflow-x-auto py-3">
          <div className="flex gap-2 min-w-max">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => handleCategoryChange(c)}
                className={`filter-button ${
                  selectedCategory === c ? "filter-button-active" : ""
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="container py-8">
        <div className="md:hidden mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              type="search"
              placeholder="Search markets..."
              className="pl-10 search-input"
              value={searchQuery}
              onChange={handleSearch}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
          </div>
        ) : markets.length === 0 ? (
          <div className="text-center py-20">
            <TrendingUp className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No markets found</p>
            {isAuthenticated && (
              <p className="text-xs text-muted-foreground mt-2">
                Ask an admin to seed markets or run migrations.
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {markets.map((market) => (
              <Link key={market.id} href={`/market/${market.id}`}>
                <a className="market-card group">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="market-title flex-1">{market.title}</h3>
                    {market.imageUrl && (
                      <img
                        src={market.imageUrl}
                        alt=""
                        className="w-12 h-12 rounded object-cover ml-2"
                      />
                    )}
                  </div>
                  <div className="mb-3">
                    <span className="market-category">{market.category}</span>
                  </div>
                  <div className="market-probability mb-3">
                    <div className="probability-item">
                      <div className="probability-label">Yes</div>
                      <div className="probability-value probability-yes">
                        {parseFloat(market.yesPrice || "50")}%
                      </div>
                    </div>
                    <div className="probability-item">
                      <div className="probability-label">No</div>
                      <div className="probability-value probability-no">
                        {parseFloat(market.noPrice || "50")}%
                      </div>
                    </div>
                  </div>
                  <div className="market-volume">
                    ${Number.parseFloat(market.totalVolume || "0").toLocaleString()}{" "}
                    vol.
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">
                    {market.endsAt
                      ? new Date(market.endsAt).toLocaleDateString()
                      : "Ongoing"}
                  </div>
                </a>
              </Link>
            ))}
          </div>
        )}

        {markets.length > 0 && (
          <div className="flex justify-center gap-4 mt-8">
            <Button
              variant="outline"
              type="button"
              onClick={() => setOffset(Math.max(0, offset - 20))}
              disabled={offset === 0}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              type="button"
              onClick={() => setOffset(offset + 20)}
              disabled={markets.length < 20}
            >
              Next
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
