import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Bell, Loader2, Search, Star, Trophy } from "lucide-react";
import { Link } from "wouter";

type AppNavProps = {
  searchQuery?: string;
  onSearchChange?: (value: string) => void;
  showSearch?: boolean;
};

export function AppNav({
  searchQuery = "",
  onSearchChange,
  showSearch = false,
}: AppNavProps) {
  const { user, isAuthenticated } = useAuth();
  const { data: notifs = [], isLoading: notifsLoading } =
    trpc.notifications.list.useQuery(15, { enabled: isAuthenticated });

  const unread = notifs.filter((n) => !n.isRead).length;
  const markRead = trpc.notifications.markAsRead.useMutation();

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
      <div className="container flex items-center justify-between gap-4 py-4">
        <div className="flex items-center gap-6 min-w-0 flex-1">
          <Link href="/">
            <a className="text-xl font-bold gradient-text shrink-0">Polyclone</a>
          </Link>

          <div className="hidden sm:flex items-center gap-4 text-sm">
            <Link href="/leaderboard">
              <a className="text-muted-foreground hover:text-foreground flex items-center gap-1">
                <Trophy className="w-4 h-4" />
                Leaderboard
              </a>
            </Link>
            <Link href="/how-it-works">
              <a className="text-muted-foreground hover:text-foreground">
                How it works
              </a>
            </Link>
          </div>

          {showSearch && onSearchChange && (
            <div className="hidden md:flex flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  type="search"
                  placeholder="Search markets..."
                  className="pl-10 search-input"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isAuthenticated && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="w-5 h-5" />
                  {unread > 0 && (
                    <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-emerald-500" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
                {notifsLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : notifs.length === 0 ? (
                  <div className="px-3 py-6 text-sm text-muted-foreground text-center">
                    No notifications yet
                  </div>
                ) : (
                  notifs.map((n) => (
                    <DropdownMenuItem
                      key={n.id}
                      className="flex flex-col items-start gap-1 cursor-pointer"
                      onClick={() => {
                        if (!n.isRead) markRead.mutate(n.id);
                      }}
                    >
                      <span className="font-medium text-sm">{n.title}</span>
                      {n.message && (
                        <span className="text-xs text-muted-foreground line-clamp-2">
                          {n.message}
                        </span>
                      )}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {isAuthenticated ? (
            <>
              <span className="hidden sm:inline text-sm text-muted-foreground truncate max-w-[8rem]">
                {user?.name || "User"}
              </span>
              <Link href="/portfolio">
                <a>
                  <Button variant="outline" size="sm">
                    Portfolio
                  </Button>
                </a>
              </Link>
            </>
          ) : (
            <>
              <Link href="/how-it-works">
                <a className="hidden sm:block">
                  <Button variant="ghost" size="sm">
                    How it works
                  </Button>
                </a>
              </Link>
              <a href={getLoginUrl()}>
                <Button variant="outline" size="sm">
                  Log In
                </Button>
              </a>
              <a href={getLoginUrl()}>
                <Button size="sm">Sign Up</Button>
              </a>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

export function WatchlistStar({
  marketId,
  isWatched,
  disabled,
}: {
  marketId: number;
  isWatched: boolean;
  disabled?: boolean;
}) {
  const utils = trpc.useUtils();
  const add = trpc.watchlist.add.useMutation({
    onSuccess: () => utils.watchlist.ids.invalidate(),
  });
  const remove = trpc.watchlist.remove.useMutation({
    onSuccess: () => utils.watchlist.ids.invalidate(),
  });

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      disabled={disabled || add.isPending || remove.isPending}
      aria-label={isWatched ? "Remove from watchlist" : "Add to watchlist"}
      onClick={() => {
        if (isWatched) remove.mutate(marketId);
        else add.mutate(marketId);
      }}
    >
      <Star
        className={`w-5 h-5 ${isWatched ? "fill-amber-400 text-amber-400" : ""}`}
      />
    </Button>
  );
}
