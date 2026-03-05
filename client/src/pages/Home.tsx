import { useState, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, TrendingUp } from "lucide-react";
import { getLoginUrl } from "@/const";
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
];

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string>("Trending");
  const [searchQuery, setSearchQuery] = useState("");
  const [offset, setOffset] = useState(0);

  // Fetch markets based on selected category and search
  const { data: markets = [], isLoading } = trpc.markets.list.useQuery({
    category: selectedCategory !== "Trending" ? selectedCategory : undefined,
    search: searchQuery || undefined,
    limit: 20,
    offset,
  });

  const displayedMarkets = useMemo(() => {
    return markets || [];
  }, [markets]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setOffset(0);
  };

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    setOffset(0);
    setSearchQuery("");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation Header */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
        <div className="container flex items-center justify-between py-4">
          <div className="flex items-center gap-8">
            <Link href="/">
              <a className="text-2xl font-bold gradient-text">Polymarket</a>
            </Link>
            
            {/* Search Bar */}
            <div className="hidden md:flex items-center flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  type="text"
                  placeholder="Search polymarkets..."
                  className="pl-10 search-input"
                  value={searchQuery}
                  onChange={handleSearch}
                />
              </div>
            </div>
          </div>

          {/* Auth Buttons */}
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">
                  {user?.name || "User"}
                </span>
                <Link href="/portfolio">
                  <a>
                    <Button variant="outline" size="sm">
                      Portfolio
                    </Button>
                  </a>
                </Link>
              </div>
            ) : (
              <>
                <Button variant="ghost" size="sm">
                  How it works
                </Button>
                <a href={getLoginUrl()}>
                  <Button variant="outline" size="sm">
                    Log In
                  </Button>
                </a>
                <a href={getLoginUrl()}>
                  <Button size="sm">
                    Sign Up
                  </Button>
                </a>
              </>
            )}
          </div>
        </div>

        {/* Category Filter */}
        <div className="border-t border-border">
          <div className="container overflow-x-auto py-3">
            <div className="flex gap-2 min-w-max">
              {CATEGORIES.map((category) => (
                <button
                  key={category}
                  onClick={() => handleCategoryChange(category)}
                  className={`filter-button ${
                    selectedCategory === category ? "filter-button-active" : ""
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container py-8">
        {/* Search Bar for Mobile */}
        <div className="md:hidden mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              type="text"
              placeholder="Search polymarkets..."
              className="pl-10 search-input"
              value={searchQuery}
              onChange={handleSearch}
            />
          </div>
        </div>

        {/* Markets Grid */}
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
          </div>
        ) : displayedMarkets.length === 0 ? (
          <div className="text-center py-20">
            <TrendingUp className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No markets found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedMarkets.map((market) => (
              <Link key={market.id} href={`/market/${market.id}`}>
                <a className="market-card group">
                  {/* Header */}
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="market-title flex-1">{market.title}</h3>
                    {market.imageUrl && (
                      <img
                        src={market.imageUrl}
                        alt={market.title}
                        className="w-12 h-12 rounded object-cover ml-2"
                      />
                    )}
                  </div>

                  {/* Category */}
                  <div className="mb-3">
                    <span className="market-category">{market.category}</span>
                  </div>

                  {/* Probabilities */}
                  <div className="market-probability mb-3">
                    <div className="probability-item">
                      <div className="probability-label">Yes</div>
                      <div className={`probability-value probability-yes`}>
                        {parseFloat(market.yesPrice || "50")}%
                      </div>
                    </div>
                    <div className="probability-item">
                      <div className="probability-label">No</div>
                      <div className={`probability-value probability-no`}>
                        {parseFloat(market.noPrice || "50")}%
                      </div>
                    </div>
                  </div>

                  {/* Volume */}
                  <div className="market-volume">
                    ${(parseFloat(market.totalVolume || "0") / 1000000).toFixed(1)}M Vol.
                  </div>

                  {/* End Date */}
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

        {/* Pagination */}
        {displayedMarkets.length > 0 && (
          <div className="flex justify-center gap-4 mt-8">
            <Button
              variant="outline"
              onClick={() => setOffset(Math.max(0, offset - 20))}
              disabled={offset === 0}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              onClick={() => setOffset(offset + 20)}
              disabled={displayedMarkets.length < 20}
            >
              Next
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
