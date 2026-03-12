import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import type { InsertNewsItem, InsertCalendarEvent } from "@shared/schema";
import { randomUUID } from "crypto";

// -------------------------
// Impact classification
// -------------------------
const HIGH_IMPACT_KEYWORDS = [
  "fomc", "federal reserve", "fed rate", "interest rate", "rate decision",
  "cpi", "inflation", "pce", "core inflation",
  "nfp", "nonfarm payroll", "jobs report", "unemployment",
  "gdp", "recession", "yield curve",
  "nvidia", "nvda", "microsoft", "msft", "apple", "aapl", "meta", "google", "alphabet",
  "tariff", "trade war", "china", "sanctions",
  "earnings miss", "earnings beat", "guidance cut", "downgrade", "upgrade",
  "sec", "doj", "antitrust", "regulation",
  "ai", "artificial intelligence", "semiconductor",
];

const MEDIUM_IMPACT_KEYWORDS = [
  "nasdaq", "tech", "big tech", "ism", "pmi", "retail sales",
  "housing", "consumer confidence", "producer price", "ppi",
  "treasury", "bond", "yield", "debt ceiling",
  "earnings", "revenue", "guidance", "forecast",
  "bank", "credit", "liquidity",
];

function classifyImpact(text: string): "low" | "medium" | "high" | "critical" {
  const lower = text.toLowerCase();
  const highHits = HIGH_IMPACT_KEYWORDS.filter(k => lower.includes(k));
  if (highHits.length >= 3) return "critical";
  if (highHits.length >= 1) return "high";
  const medHits = MEDIUM_IMPACT_KEYWORDS.filter(k => lower.includes(k));
  if (medHits.length >= 1) return "medium";
  return "low";
}

function classifyCategory(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("fomc") || lower.includes("federal reserve") || lower.includes("fed rate") || lower.includes("powell")) return "fed";
  if (lower.includes("cpi") || lower.includes("inflation") || lower.includes("pce") || lower.includes("gdp") || lower.includes("nfp") || lower.includes("payroll") || lower.includes("unemployment") || lower.includes("pmi") || lower.includes("ism")) return "macro";
  if (lower.includes("earnings") || lower.includes("revenue") || lower.includes("eps") || lower.includes("guidance")) return "earnings";
  if (lower.includes("tariff") || lower.includes("trade war") || lower.includes("china") || lower.includes("sanction") || lower.includes("geopolit")) return "geopolitical";
  return "general";
}

// -------------------------
// Economic Calendar (investing.com widget parsing)
// -------------------------
const HIGH_IMPACT_EVENTS = [
  "FOMC", "Federal Reserve", "CPI", "Core CPI", "PCE", "Core PCE",
  "Nonfarm Payroll", "NFP", "Unemployment Rate", "GDP", "ISM",
  "Retail Sales", "PPI", "JOLTS", "Consumer Confidence",
];

async function fetchEconomicCalendar(): Promise<InsertCalendarEvent[]> {
  // Use Finnhub economic calendar endpoint (free)
  const settings = await storage.getSettings();
  const apiKey = settings.finnhubApiKey;

  const today = new Date();
  const from = today.toISOString().split("T")[0];
  const endDate = new Date(today.getTime() + 7 * 24 * 3600 * 1000);
  const to = endDate.toISOString().split("T")[0];

  // Fallback seed data for when no API key is set
  const seedEvents: InsertCalendarEvent[] = [];

  if (!apiKey) {
    // Return seeded upcoming events based on current time (simulated)
    const now = Math.floor(Date.now() / 1000);
    const todayBase = new Date();
    todayBase.setHours(0, 0, 0, 0);
    const todayTs = Math.floor(todayBase.getTime() / 1000);

    // Simulate realistic economic calendar for today and tomorrow
    const events = [
      { name: "Initial Jobless Claims", hour: 7, min: 30, impact: "high", forecast: "215K", previous: "211K" },
      { name: "ISM Manufacturing PMI", hour: 9, min: 0, impact: "high", forecast: "49.5", previous: "49.0" },
      { name: "Crude Oil Inventories", hour: 9, min: 30, impact: "medium", forecast: "-1.2M", previous: "-2.1M" },
      { name: "Fed Chair Powell Speaks", hour: 10, min: 0, impact: "high", forecast: "", previous: "" },
      { name: "30-Year Bond Auction", hour: 12, min: 0, impact: "medium", forecast: "", previous: "4.52%" },
    ];

    // CST offset: UTC-6 standard, UTC-5 daylight
    const cstOffset = 6 * 3600; // simplify to CST

    events.forEach((ev, idx) => {
      const ts = todayTs + ev.hour * 3600 + ev.min * 60 + cstOffset;
      seedEvents.push({
        id: `seed-${idx}`,
        eventName: ev.name,
        country: "US",
        scheduledAt: ts,
        impact: ev.impact as "low" | "medium" | "high",
        forecast: ev.forecast || null,
        previous: ev.previous || null,
        actual: null,
        unit: null,
      });
    });
    return seedEvents;
  }

  try {
    const url = `https://finnhub.io/api/v1/calendar/economic?from=${from}&to=${to}&token=${apiKey}`;
    const resp = await fetch(url);
    if (!resp.ok) return seedEvents;
    const data = await resp.json() as { economicCalendar?: Array<{
      event: string; country: string; time: string; impact: string;
      estimate?: string; prev?: string; actual?: string; unit?: string;
    }> };
    
    if (!data.economicCalendar) return seedEvents;

    return data.economicCalendar
      .filter(e => e.country === "US" || e.country === "")
      .map((e, idx) => {
        const dt = new Date(e.time);
        return {
          id: `cal-${dt.toISOString()}-${idx}`,
          eventName: e.event,
          country: e.country || "US",
          scheduledAt: Math.floor(dt.getTime() / 1000),
          impact: (e.impact === "3" ? "high" : e.impact === "2" ? "medium" : "low") as "low" | "medium" | "high",
          forecast: e.estimate || null,
          previous: e.prev || null,
          actual: e.actual || null,
          unit: e.unit || null,
        };
      });
  } catch {
    return seedEvents;
  }
}

// -------------------------
// News Fetching
// -------------------------
async function fetchFinnhubNews(apiKey: string): Promise<InsertNewsItem[]> {
  const categories = ["general", "forex", "crypto", "merger"];
  const allNews: InsertNewsItem[] = [];

  for (const category of categories.slice(0, 2)) { // limit to general + forex for rate limits
    try {
      const url = `https://finnhub.io/api/v1/news?category=${category}&token=${apiKey}`;
      const resp = await fetch(url);
      if (!resp.ok) continue;
      const articles = await resp.json() as Array<{
        id: number; headline: string; summary: string; source: string;
        url: string; datetime: number; category: string; image?: string;
      }>;

      for (const a of articles) {
        const text = `${a.headline} ${a.summary || ""}`;
        const impact = classifyImpact(text);
        const cat = classifyCategory(text);
        allNews.push({
          id: `fn-${a.id}`,
          headline: a.headline,
          summary: a.summary || null,
          source: a.source,
          url: a.url,
          publishedAt: a.datetime,
          category: cat,
          impact,
        });
      }
    } catch {
      // ignore individual category errors
    }
  }

  // Also fetch key stock news for MNQ-relevant tickers
  const tickers = ["QQQ", "NVDA", "MSFT", "AAPL", "AMZN", "GOOGL", "META"];
  const today = new Date();
  const from = today.toISOString().split("T")[0];
  const to = today.toISOString().split("T")[0];

  for (const ticker of tickers.slice(0, 3)) { // conserve rate limit
    try {
      const url = `https://finnhub.io/api/v1/company-news?symbol=${ticker}&from=${from}&to=${to}&token=${apiKey}`;
      const resp = await fetch(url);
      if (!resp.ok) continue;
      const articles = await resp.json() as Array<{
        id: number; headline: string; summary: string; source: string;
        url: string; datetime: number;
      }>;

      for (const a of articles.slice(0, 5)) {
        const text = `${a.headline} ${a.summary || ""}`;
        const impact = classifyImpact(text);
        allNews.push({
          id: `fn-${ticker}-${a.id}`,
          headline: a.headline,
          summary: a.summary || null,
          source: a.source,
          url: a.url,
          publishedAt: a.datetime,
          category: "earnings",
          impact,
        });
      }
    } catch {
      // ignore
    }
    await new Promise(r => setTimeout(r, 200)); // small delay between calls
  }

  return allNews;
}

// -------------------------
// Register Routes
// -------------------------
export async function registerRoutes(httpServer: Server, app: Express) {
  // Seed calendar on startup
  const calEvents = await fetchEconomicCalendar();
  for (const ev of calEvents) {
    await storage.upsertCalendarEvent(ev);
  }

  // ---- GET /api/news ----
  app.get("/api/news", async (req, res) => {
    const limit = parseInt(req.query.limit as string) || 100;
    const items = await storage.getNewsItems(limit);
    res.json(items);
  });

  // ---- GET /api/news/unread-count ----
  app.get("/api/news/unread-count", async (req, res) => {
    const items = await storage.getNewsItems(500);
    const count = items.filter(n => !n.isRead).length;
    res.json({ count });
  });

  // ---- POST /api/news/:id/read ----
  app.post("/api/news/:id/read", async (req, res) => {
    await storage.markNewsRead(req.params.id);
    res.json({ ok: true });
  });

  // ---- POST /api/news/read-all ----
  app.post("/api/news/read-all", async (req, res) => {
    await storage.markAllNewsRead();
    res.json({ ok: true });
  });

  // ---- POST /api/news/fetch ----
  // Manual or polling-triggered fetch. Returns items so the client can show the feed
  // even when GET /api/news hits a different serverless instance (in-memory not shared).
  app.post("/api/news/fetch", async (req, res) => {
    const settings = await storage.getSettings();
    if (!settings.finnhubApiKey) {
      return res.json({ fetched: 0, total: 0, items: [], message: "No API key configured. Add your Finnhub API key in Settings." });
    }

    const articles = await fetchFinnhubNews(settings.finnhubApiKey);
    let newCount = 0;
    for (const a of articles) {
      const existing = await storage.getNewsItem(a.id);
      if (!existing) {
        await storage.upsertNewsItem(a);
        newCount++;
      }
    }

    // Clean articles older than 24h
    await storage.clearOldNews(24);

    const items = await storage.getNewsItems(100);
    res.json({ fetched: newCount, total: articles.length, items });
  });

  // ---- GET /api/calendar ----
  app.get("/api/calendar", async (req, res) => {
    const fromTs = req.query.from ? parseInt(req.query.from as string) : undefined;
    const events = await storage.getCalendarEvents(fromTs);
    res.json(events);
  });

  // ---- POST /api/calendar/refresh ----
  app.post("/api/calendar/refresh", async (req, res) => {
    const events = await fetchEconomicCalendar();
    for (const ev of events) {
      await storage.upsertCalendarEvent(ev);
    }
    res.json({ count: events.length });
  });

  // ---- GET /api/calendar/upcoming ----
  app.get("/api/calendar/upcoming", async (req, res) => {
    const within = parseInt(req.query.within as string) || 30;
    const events = await storage.getUpcomingCalendarEvents(within);
    res.json(events);
  });

  // ---- GET /api/settings ----
  app.get("/api/settings", async (req, res) => {
    const settings = await storage.getSettings();
    // Mask API key for display
    const masked = settings.finnhubApiKey
      ? settings.finnhubApiKey.slice(0, 4) + "****" + settings.finnhubApiKey.slice(-4)
      : "";
    res.json({ ...settings, finnhubApiKeyMasked: masked });
  });

  // ---- POST /api/settings ----
  app.post("/api/settings", async (req, res) => {
    const { finnhubApiKey, alertSound, alertHighOnly, keywords, pollingIntervalSeconds } = req.body;
    const updated = await storage.updateSettings({
      ...(finnhubApiKey !== undefined && { finnhubApiKey }),
      ...(alertSound !== undefined && { alertSound }),
      ...(alertHighOnly !== undefined && { alertHighOnly }),
      ...(keywords !== undefined && { keywords }),
      ...(pollingIntervalSeconds !== undefined && { pollingIntervalSeconds }),
    });
    res.json({ ok: true, settings: updated });
  });

  // ---- GET /api/market-status ----
  app.get("/api/market-status", async (req, res) => {
    const now = new Date();
    // Convert to CT (CST = UTC-6, CDT = UTC-5)
    const utcHour = now.getUTCHours();
    const utcMin = now.getUTCMinutes();
    const utcDay = now.getUTCDay(); // 0=Sun, 6=Sat

    // Approximate CDT (UTC-5) — most of trading year is CDT
    const ctHour = (utcHour - 5 + 24) % 24;
    const ctMin = utcMin;
    const ctTotalMin = ctHour * 60 + ctMin;

    const isWeekend = utcDay === 0 || utcDay === 6;

    // Regular Trading Hours: 8:30 CT - 15:00 CT
    const rthOpen = 8 * 60 + 30;   // 8:30 CT
    const rthClose = 15 * 60;       // 15:00 CT
    // Pre-market starts 8:00 CT (30 min before)
    const preMarketStart = 8 * 60;

    // CME MNQ trades 5:00 PM CT Sunday - 4:00 PM CT Friday
    // Globex break: 3:15 PM - 3:30 PM CT
    const isRTH = !isWeekend && ctTotalMin >= rthOpen && ctTotalMin < rthClose;
    const isPreMarket = !isWeekend && ctTotalMin >= preMarketStart && ctTotalMin < rthOpen;
    const isGlobexBreak = !isWeekend && ctTotalMin >= (15 * 60 + 15) && ctTotalMin < (15 * 60 + 30);

    const alertZone = isRTH || isPreMarket;

    res.json({
      isRTH,
      isPreMarket,
      isGlobexBreak,
      isWeekend,
      alertZone,
      ctTime: `${String(ctHour).padStart(2, "0")}:${String(ctMin).padStart(2, "0")} CT`,
      message: isWeekend
        ? "Weekend — Markets Closed"
        : isGlobexBreak
        ? "Globex Break (3:15-3:30 CT)"
        : isRTH
        ? "RTH Active — 8:30-15:00 CT"
        : isPreMarket
        ? "Pre-Market — 8:00-8:30 CT"
        : "Extended Hours (Globex)",
    });
  });
}
