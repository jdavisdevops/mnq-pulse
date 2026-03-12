import { Link, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { useTheme } from "@/components/ThemeProvider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { Sun, Moon, Activity, Settings, Bell } from "lucide-react";
import PerplexityAttribution from "@/components/PerplexityAttribution";

interface MarketStatus {
  isRTH: boolean;
  isPreMarket: boolean;
  isWeekend: boolean;
  alertZone: boolean;
  ctTime: string;
  message: string;
}

interface UnreadCount {
  count: number;
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { theme, toggleTheme } = useTheme();
  const [location] = useHashLocation();

  const { data: marketStatus } = useQuery<MarketStatus>({
    queryKey: ["/api/market-status"],
    refetchInterval: 15000,
  });

  const { data: unreadData } = useQuery<UnreadCount>({
    queryKey: ["/api/news/unread-count"],
    refetchInterval: 5000,
  });

  const unreadCount = unreadData?.count ?? 0;

  const statusColor = marketStatus?.isRTH
    ? "bg-green-500"
    : marketStatus?.isPreMarket
    ? "bg-yellow-500"
    : "bg-zinc-500";

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground font-sans">
      {/* Top nav */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-sm">
        <div className="max-w-screen-2xl mx-auto px-4 h-12 flex items-center gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 mr-2">
            <svg aria-label="MNQ Pulse" viewBox="0 0 32 24" fill="none" width="32" height="24" className="shrink-0">
              <polyline points="0,20 6,20 9,4 13,16 17,10 21,14 25,6 29,14 32,14" stroke="hsl(214 84% 55%)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="font-bold text-sm tracking-wider uppercase text-foreground">MNQ Pulse</span>
          </Link>

          {/* Market status pill */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-xs font-mono" data-testid="market-status">
            <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${statusColor}`} />
            <span className="text-muted-foreground">{marketStatus?.ctTime ?? "--:-- CT"}</span>
            <span className="hidden sm:inline text-muted-foreground/70">·</span>
            <span className="hidden sm:inline">{marketStatus?.message ?? "Loading..."}</span>
          </div>

          <div className="flex-1" />

          {/* Unread badge */}
          {unreadCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="unread-count">
              <Bell className="w-3.5 h-3.5" />
              <Badge variant="destructive" className="text-xs px-1.5 py-0 h-5">{unreadCount}</Badge>
            </div>
          )}

          {/* Nav links */}
          <nav className="flex items-center gap-1">
            <Link href="/">
              <Button
                variant={location === "/" ? "secondary" : "ghost"}
                size="sm"
                className="gap-1.5 text-xs h-8"
                data-testid="nav-dashboard"
              >
                <Activity className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Feed</span>
              </Button>
            </Link>
            <Link href="/settings">
              <Button
                variant={location === "/settings" ? "secondary" : "ghost"}
                size="sm"
                className="gap-1.5 text-xs h-8"
                data-testid="nav-settings"
              >
                <Settings className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Settings</span>
              </Button>
            </Link>
          </nav>

          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            data-testid="theme-toggle"
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-3 px-4 text-xs text-muted-foreground/60 flex items-center justify-between max-w-screen-2xl mx-auto w-full">
        <span>MNQ Pulse — for educational/informational use only. Not financial advice.</span>
        <a href="https://www.perplexity.ai/computer" target="_blank" rel="noopener noreferrer" className="hover:text-muted-foreground transition-colors">
          Created with Perplexity Computer
        </a>
      </footer>
    </div>
  );
}
