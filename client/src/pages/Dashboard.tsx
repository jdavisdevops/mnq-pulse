import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState, useEffect, useRef, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  RefreshCw, ExternalLink, CheckCheck, Filter,
  Clock, AlertTriangle, Zap, TrendingUp, Bell,
  Calendar, ChevronRight
} from "lucide-react";
import type { NewsItem, CalendarEvent } from "@shared/schema";

// ---- Impact badge ----
function ImpactBadge({ impact }: { impact: string }) {
  if (impact === "critical") return (
    <Badge className="text-xs px-1.5 py-0 h-4 bg-red-600 text-white border-0 animate-pulse">CRITICAL</Badge>
  );
  if (impact === "high") return (
    <Badge className="text-xs px-1.5 py-0 h-4 bg-orange-500 text-white border-0">HIGH</Badge>
  );
  if (impact === "medium") return (
    <Badge className="text-xs px-1.5 py-0 h-4 bg-yellow-500 text-black border-0">MED</Badge>
  );
  return (
    <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4">LOW</Badge>
  );
}

// ---- Category badge ----
function CategoryBadge({ category }: { category: string }) {
  const colors: Record<string, string> = {
    fed: "bg-purple-600/20 text-purple-300 border-purple-600/30",
    macro: "bg-blue-600/20 text-blue-300 border-blue-600/30",
    earnings: "bg-emerald-600/20 text-emerald-300 border-emerald-600/30",
    geopolitical: "bg-rose-600/20 text-rose-300 border-rose-600/30",
    general: "bg-zinc-600/20 text-zinc-300 border-zinc-600/30",
  };
  const labels: Record<string, string> = {
    fed: "FED", macro: "MACRO", earnings: "EARNINGS", geopolitical: "GEO", general: "GEN"
  };
  return (
    <span className={`text-xs px-1.5 py-0 rounded border font-mono font-medium ${colors[category] ?? colors.general}`}>
      {labels[category] ?? category.toUpperCase()}
    </span>
  );
}

// ---- Time ago ----
function timeAgo(unixTs: number): string {
  const diffSec = Math.floor(Date.now() / 1000 - unixTs);
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

// ---- Format CT time ----
function formatCT(unixTs: number): string {
  const d = new Date(unixTs * 1000);
  return d.toLocaleTimeString("en-US", {
    timeZone: "America/Chicago",
    hour: "2-digit", minute: "2-digit", hour12: true
  });
}

// ---- News card ----
function NewsCard({ item, onRead }: { item: NewsItem; onRead: (id: string) => void }) {
  const isNew = !item.isRead;

  return (
    <div
      className={`group relative border rounded-lg p-3 transition-all cursor-pointer hover:border-primary/40 ${
        isNew
          ? item.impact === "critical"
            ? "border-red-500/60 bg-red-500/5"
            : item.impact === "high"
            ? "border-orange-500/50 bg-orange-500/5"
            : "border-border bg-card/60"
          : "border-border/50 bg-card/30 opacity-70"
      }`}
      onClick={() => { onRead(item.id); window.open(item.url, "_blank"); }}
      data-testid={`news-card-${item.id}`}
    >
      {/* Unread indicator */}
      {isNew && (
        <span className={`absolute left-0 top-2 bottom-2 w-0.5 rounded-full ${
          item.impact === "critical" ? "bg-red-500" :
          item.impact === "high" ? "bg-orange-500" :
          item.impact === "medium" ? "bg-yellow-500" : "bg-primary"
        }`} />
      )}

      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0 pl-2">
          {/* Header row */}
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <ImpactBadge impact={item.impact} />
            <CategoryBadge category={item.category} />
            <span className="text-xs text-muted-foreground font-mono ml-auto">{timeAgo(item.publishedAt)}</span>
          </div>

          {/* Headline */}
          <p className={`text-sm leading-snug mb-1 font-medium ${isNew ? "text-foreground" : "text-muted-foreground"}`}>
            {item.headline}
          </p>

          {/* Summary */}
          {item.summary && (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{item.summary}</p>
          )}

          {/* Footer */}
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-xs text-muted-foreground/70 font-mono">{item.source}</span>
            <ExternalLink className="w-3 h-3 text-muted-foreground/40 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Calendar event row ----
function CalendarRow({ event }: { event: CalendarEvent }) {
  const impactColors = {
    high: "text-orange-400",
    medium: "text-yellow-400",
    low: "text-muted-foreground",
  };

  const isPast = event.scheduledAt < Math.floor(Date.now() / 1000);

  return (
    <div className={`flex items-center gap-3 py-2 border-b border-border/40 last:border-0 text-xs ${isPast ? "opacity-50" : ""}`}
      data-testid={`cal-event-${event.id}`}>
      <div className="w-14 shrink-0 text-muted-foreground font-mono text-right">{formatCT(event.scheduledAt)}</div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{event.eventName}</p>
        {(event.forecast || event.previous) && (
          <p className="text-muted-foreground font-mono mt-0.5">
            {event.forecast && <span>Est: <span className="text-foreground">{event.forecast}</span></span>}
            {event.forecast && event.previous && " · "}
            {event.previous && <span>Prev: {event.previous}</span>}
            {event.actual && <span className={`ml-2 font-semibold ${parseFloat(event.actual) > parseFloat(event.forecast ?? "0") ? "text-green-400" : "text-red-400"}`}>
              Act: {event.actual}
            </span>}
          </p>
        )}
      </div>
      <div className={`shrink-0 font-semibold uppercase text-xs ${impactColors[event.impact as keyof typeof impactColors] ?? "text-muted-foreground"}`}>
        {event.impact === "high" ? "●●●" : event.impact === "medium" ? "●●○" : "●○○"}
      </div>
    </div>
  );
}

// ---- Main Dashboard ----
export default function Dashboard() {
  const { toast } = useToast();
  const [filterImpact, setFilterImpact] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [isPolling, setIsPolling] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const initialFetchDoneRef = useRef(false);

  const { data: settings } = useQuery({
    queryKey: ["/api/settings"],
    refetchInterval: 30000,
  });

  const { data: marketStatus } = useQuery<{
    isRTH: boolean; isPreMarket: boolean; alertZone: boolean; isWeekend: boolean;
    ctTime: string; message: string;
  }>({
    queryKey: ["/api/market-status"],
    refetchInterval: 15000,
  });

  const { data: newsItems = [], isLoading: newsLoading } = useQuery<NewsItem[]>({
    queryKey: ["/api/news"],
    refetchInterval: 10000,
    queryFn: async () => {
      const res = await fetch("/api/news?limit=100");
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      const data = await res.json();
      if (Array.isArray(data) && data.length === 0) {
        const prev = queryClient.getQueryData<NewsItem[]>(["/api/news"]);
        if (Array.isArray(prev) && prev.length > 0) return prev;
      }
      return data;
    },
  });

  const { data: calendarEvents = [], isLoading: calLoading } = useQuery<CalendarEvent[]>({
    queryKey: ["/api/calendar"],
    refetchInterval: 60000,
  });

  const fetchNewsMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/news/fetch"),
    onSuccess: async (res: Response) => {
      const data = await res.json();
      if (Array.isArray(data.items)) {
        queryClient.setQueryData(["/api/news"], data.items);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/news/unread-count"] });
      if (data.fetched > 0) {
        toast({ title: `${data.fetched} new articles`, description: "News feed updated." });
        playAlertSound();
      }
    },
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/news/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/news"] });
      queryClient.invalidateQueries({ queryKey: ["/api/news/unread-count"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/news/read-all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/news"] });
      queryClient.invalidateQueries({ queryKey: ["/api/news/unread-count"] });
    },
  });

  // Beep alert sound using Web Audio API
  const playAlertSound = useCallback(() => {
    if (!(settings as any)?.alertSound) return;
    try {
      if (!audioRef.current) audioRef.current = new AudioContext();
      const ctx = audioRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } catch { /* no audio support */ }
  }, [settings]);

  // Initial fetch on load when we have API key and feed is empty (e.g. GET /api/news hit another instance)
  const hasApiKeyForEffects = !!(settings as any)?.finnhubApiKey;
  useEffect(() => {
    if (!hasApiKeyForEffects || newsItems.length > 0 || newsLoading) return;
    if (initialFetchDoneRef.current) return;
    initialFetchDoneRef.current = true;
    fetchNewsMutation.mutate();
  }, [hasApiKeyForEffects, newsItems.length, newsLoading]);

  // Auto-polling whenever API key is set (not only during market hours)
  useEffect(() => {
    if (!(settings as any)?.finnhubApiKey) {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
      setIsPolling(false);
      return;
    }

    const interval = ((settings as any)?.pollingIntervalSeconds ?? 15) * 1000;
    setIsPolling(true);
    fetchNewsMutation.mutate();

    pollingRef.current = setInterval(() => {
      fetchNewsMutation.mutate();
    }, interval);

    return () => {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    };
  }, [(settings as any)?.finnhubApiKey, (settings as any)?.pollingIntervalSeconds]);

  // Filter news
  const filteredNews = newsItems
    .filter(n => filterImpact === "all" ? true : n.impact === filterImpact)
    .filter(n => filterCategory === "all" ? true : n.category === filterCategory);

  const unreadCount = newsItems.filter(n => !n.isRead).length;
  const criticalCount = newsItems.filter(n => n.impact === "critical" && !n.isRead).length;
  const highCount = newsItems.filter(n => n.impact === "high" && !n.isRead).length;

  // Today's calendar events (CT)
  const nowTs = Math.floor(Date.now() / 1000);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayTs = Math.floor(todayStart.getTime() / 1000);
  const tomorrowTs = todayTs + 86400;

  const todayEvents = calendarEvents.filter(e => e.scheduledAt >= todayTs && e.scheduledAt < tomorrowTs);
  const upcomingEvents = calendarEvents.filter(e => e.scheduledAt > nowTs).slice(0, 5);

  const hasApiKey = !!(settings as any)?.finnhubApiKey;

  return (
    <div className="max-w-screen-2xl mx-auto px-4 py-4">

      {/* === API Key warning === */}
      {!hasApiKey && (
        <div className="mb-4 p-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 flex items-center gap-3 text-sm">
          <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />
          <div>
            <span className="font-medium text-yellow-400">No Finnhub API key set.</span>
            <span className="text-muted-foreground ml-2">The calendar is seeded with demo data. Add your free key in{" "}
              <a href="/#/settings" className="underline text-primary">Settings</a> to enable live news polling.
            </span>
          </div>
        </div>
      )}

      {/* === Auto-polling banner === */}
      {isPolling && (
        <div className="mb-4 p-2 rounded-lg border border-green-500/40 bg-green-500/10 flex items-center gap-2 text-xs text-green-400">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span>Live polling active — refreshing every {(settings as any)?.pollingIntervalSeconds ?? 15}s</span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">

        {/* === LEFT: News Feed === */}
        <div className="min-w-0">
          {/* Feed header */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <h1 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">News Feed</h1>

            {/* Stats */}
            {unreadCount > 0 && (
              <div className="flex items-center gap-2">
                {criticalCount > 0 && (
                  <Badge className="gap-1 text-xs h-5 bg-red-600 text-white border-0 animate-pulse">
                    <Zap className="w-3 h-3" />{criticalCount} critical
                  </Badge>
                )}
                {highCount > 0 && (
                  <Badge className="gap-1 text-xs h-5 bg-orange-500 text-white border-0">
                    <Bell className="w-3 h-3" />{highCount} high
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">{unreadCount} unread</span>
              </div>
            )}

            <div className="flex-1" />

            {/* Actions */}
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={() => markAllReadMutation.mutate()}
                disabled={unreadCount === 0}
                data-testid="button-mark-all-read"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={() => fetchNewsMutation.mutate()}
                disabled={fetchNewsMutation.isPending || !hasApiKey}
                data-testid="button-refresh"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${fetchNewsMutation.isPending ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {/* Impact filter */}
            <div className="flex gap-1">
              {["all", "critical", "high", "medium", "low"].map(f => (
                <button
                  key={f}
                  className={`text-xs px-2 py-0.5 rounded font-mono transition-colors ${
                    filterImpact === f
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                  onClick={() => setFilterImpact(f)}
                  data-testid={`filter-impact-${f}`}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
            <div className="w-px bg-border mx-0.5" />
            {/* Category filter */}
            <div className="flex gap-1">
              {["all", "fed", "macro", "earnings", "geopolitical", "general"].map(f => (
                <button
                  key={f}
                  className={`text-xs px-2 py-0.5 rounded font-mono transition-colors ${
                    filterCategory === f
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                  onClick={() => setFilterCategory(f)}
                  data-testid={`filter-cat-${f}`}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* News list */}
          <div className="space-y-1.5">
            {newsLoading && (
              Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-lg" />
              ))
            )}

            {!newsLoading && filteredNews.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <TrendingUp className="w-8 h-8 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">
                  {hasApiKey ? "No news yet. Click Refresh or wait for auto-polling." : "Add your Finnhub API key in Settings to load live news."}
                </p>
                {!hasApiKey && (
                  <a href="/#/settings" className="text-xs text-primary mt-1 underline">Go to Settings →</a>
                )}
              </div>
            )}

            {filteredNews.map(item => (
              <NewsCard
                key={item.id}
                item={item}
                onRead={(id) => markReadMutation.mutate(id)}
              />
            ))}
          </div>
        </div>

        {/* === RIGHT: Sidebar === */}
        <div className="space-y-4">

          {/* Market session card */}
          <Card className="border-border">
            <CardHeader className="py-3 px-4 pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Session Status</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              {/* Big status indicator */}
              <div className={`rounded-lg p-3 text-center ${
                marketStatus?.isRTH
                  ? "bg-green-500/10 border border-green-500/30"
                  : marketStatus?.isPreMarket
                  ? "bg-yellow-500/10 border border-yellow-500/30"
                  : "bg-muted/50 border border-border"
              }`}>
                <div className="flex items-center justify-center gap-2 mb-1">
                  <span className={`w-2 h-2 rounded-full ${
                    marketStatus?.isRTH ? "bg-green-500 animate-pulse" :
                    marketStatus?.isPreMarket ? "bg-yellow-500 animate-pulse" : "bg-zinc-500"
                  }`} />
                  <span className={`text-sm font-bold font-mono ${
                    marketStatus?.isRTH ? "text-green-400" :
                    marketStatus?.isPreMarket ? "text-yellow-400" : "text-muted-foreground"
                  }`}>
                    {marketStatus?.isRTH ? "RTH ACTIVE" : marketStatus?.isPreMarket ? "PRE-MARKET" : "CLOSED"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{marketStatus?.message}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-muted/50 rounded p-2">
                  <p className="text-muted-foreground mb-0.5">CT Time</p>
                  <p className="font-mono font-bold">{marketStatus?.ctTime ?? "--:--"}</p>
                </div>
                <div className="bg-muted/50 rounded p-2">
                  <p className="text-muted-foreground mb-0.5">Your Time (PT)</p>
                  <p className="font-mono font-bold">{new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "America/Los_Angeles" })}</p>
                </div>
              </div>

              <div className="text-xs space-y-1 text-muted-foreground border-t border-border pt-2">
                <div className="flex justify-between"><span>Pre-Market</span><span className="font-mono text-foreground">8:00 CT (6:00 PT)</span></div>
                <div className="flex justify-between"><span>RTH Open</span><span className="font-mono text-foreground">8:30 CT (6:30 PT)</span></div>
                <div className="flex justify-between"><span>RTH Close</span><span className="font-mono text-foreground">15:00 CT (13:00 PT)</span></div>
              </div>
            </CardContent>
          </Card>

          {/* Economic Calendar */}
          <Card className="border-border">
            <CardHeader className="py-3 px-4 pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Economic Calendar
              </CardTitle>
              <span className="text-xs text-muted-foreground font-mono">CT</span>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {calLoading && (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
                </div>
              )}

              {!calLoading && todayEvents.length === 0 && (
                <p className="text-xs text-muted-foreground py-4 text-center">No events for today.</p>
              )}

              {!calLoading && todayEvents.map(event => (
                <CalendarRow key={event.id} event={event} />
              ))}

              {/* Upcoming beyond today */}
              {upcomingEvents.filter(e => e.scheduledAt >= tomorrowTs).length > 0 && (
                <>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest font-mono mt-3 mb-1 border-t border-border pt-2">
                    Upcoming
                  </p>
                  {upcomingEvents.filter(e => e.scheduledAt >= tomorrowTs).slice(0, 3).map(event => (
                    <CalendarRow key={event.id} event={event} />
                  ))}
                </>
              )}
            </CardContent>
          </Card>

          {/* Stats card */}
          <Card className="border-border">
            <CardHeader className="py-3 px-4 pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Session Stats</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-muted/50 rounded p-2">
                  <p className="text-muted-foreground mb-0.5">Total Articles</p>
                  <p className="font-mono font-bold text-base">{newsItems.length}</p>
                </div>
                <div className="bg-muted/50 rounded p-2">
                  <p className="text-muted-foreground mb-0.5">Unread</p>
                  <p className={`font-mono font-bold text-base ${unreadCount > 0 ? "text-yellow-400" : ""}`}>{unreadCount}</p>
                </div>
                <div className="bg-red-500/10 border border-red-500/20 rounded p-2">
                  <p className="text-red-400/70 mb-0.5">Critical</p>
                  <p className={`font-mono font-bold text-base ${criticalCount > 0 ? "text-red-400 animate-pulse" : ""}`}>{criticalCount}</p>
                </div>
                <div className="bg-orange-500/10 border border-orange-500/20 rounded p-2">
                  <p className="text-orange-400/70 mb-0.5">High Impact</p>
                  <p className={`font-mono font-bold text-base ${highCount > 0 ? "text-orange-400" : ""}`}>{highCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
