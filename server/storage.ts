import {
  type NewsItem, type InsertNewsItem,
  type CalendarEvent, type InsertCalendarEvent,
  type AlertSettings, type InsertAlertSettings,
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // News
  getNewsItems(limit?: number): Promise<NewsItem[]>;
  getNewsItem(id: string): Promise<NewsItem | undefined>;
  upsertNewsItem(item: InsertNewsItem): Promise<NewsItem>;
  markNewsRead(id: string): Promise<void>;
  markAllNewsRead(): Promise<void>;
  clearOldNews(olderThanHours: number): Promise<void>;
  getUnalertedNews(): Promise<NewsItem[]>;
  markNewsAlerted(id: string): Promise<void>;

  // Calendar
  getCalendarEvents(fromTs?: number): Promise<CalendarEvent[]>;
  upsertCalendarEvent(event: InsertCalendarEvent): Promise<CalendarEvent>;
  markCalendarAnnounced(id: string): Promise<void>;
  getUpcomingCalendarEvents(withinMinutes: number): Promise<CalendarEvent[]>;

  // Settings
  getSettings(): Promise<AlertSettings>;
  updateSettings(settings: Partial<InsertAlertSettings>): Promise<AlertSettings>;
}

export class MemStorage implements IStorage {
  private news: Map<string, NewsItem> = new Map();
  private calendar: Map<string, CalendarEvent> = new Map();
  private settings: AlertSettings = {
    id: "default",
    finnhubApiKey: "",
    alertSound: true,
    alertHighOnly: false,
    keywords: ["fed", "fomc", "cpi", "inflation", "jobs", "gdp", "tariff", "nvidia", "microsoft", "apple", "nasdaq", "tech", "rate hike", "interest rate"],
    pollingIntervalSeconds: 15,
  };

  // --- News ---
  async getNewsItems(limit = 200): Promise<NewsItem[]> {
    return Array.from(this.news.values())
      .sort((a, b) => b.publishedAt - a.publishedAt)
      .slice(0, limit);
  }

  async getNewsItem(id: string): Promise<NewsItem | undefined> {
    return this.news.get(id);
  }

  async upsertNewsItem(item: InsertNewsItem): Promise<NewsItem> {
    const existing = this.news.get(item.id);
    const newsItem: NewsItem = {
      ...item,
      isRead: existing?.isRead ?? false,
      isAlerted: existing?.isAlerted ?? false,
    };
    this.news.set(item.id, newsItem);
    return newsItem;
  }

  async markNewsRead(id: string): Promise<void> {
    const item = this.news.get(id);
    if (item) this.news.set(id, { ...item, isRead: true });
  }

  async markAllNewsRead(): Promise<void> {
    for (const [id, item] of this.news.entries()) {
      this.news.set(id, { ...item, isRead: true });
    }
  }

  async clearOldNews(olderThanHours: number): Promise<void> {
    const cutoff = Math.floor(Date.now() / 1000) - olderThanHours * 3600;
    for (const [id, item] of this.news.entries()) {
      if (item.publishedAt < cutoff) this.news.delete(id);
    }
  }

  async getUnalertedNews(): Promise<NewsItem[]> {
    return Array.from(this.news.values()).filter(n => !n.isAlerted);
  }

  async markNewsAlerted(id: string): Promise<void> {
    const item = this.news.get(id);
    if (item) this.news.set(id, { ...item, isAlerted: true });
  }

  // --- Calendar ---
  async getCalendarEvents(fromTs?: number): Promise<CalendarEvent[]> {
    const events = Array.from(this.calendar.values())
      .sort((a, b) => a.scheduledAt - b.scheduledAt);
    if (fromTs) return events.filter(e => e.scheduledAt >= fromTs);
    return events;
  }

  async upsertCalendarEvent(event: InsertCalendarEvent): Promise<CalendarEvent> {
    const existing = this.calendar.get(event.id);
    const calEvent: CalendarEvent = {
      ...event,
      isAnnounced: existing?.isAnnounced ?? false,
    };
    this.calendar.set(event.id, calEvent);
    return calEvent;
  }

  async markCalendarAnnounced(id: string): Promise<void> {
    const item = this.calendar.get(id);
    if (item) this.calendar.set(id, { ...item, isAnnounced: true });
  }

  async getUpcomingCalendarEvents(withinMinutes: number): Promise<CalendarEvent[]> {
    const now = Math.floor(Date.now() / 1000);
    const cutoff = now + withinMinutes * 60;
    return Array.from(this.calendar.values())
      .filter(e => e.scheduledAt >= now && e.scheduledAt <= cutoff && !e.isAnnounced)
      .sort((a, b) => a.scheduledAt - b.scheduledAt);
  }

  // --- Settings ---
  async getSettings(): Promise<AlertSettings> {
    const envKey = process.env.FINNHUB_API_KEY;
    const effectiveKey =
      this.settings.finnhubApiKey || (envKey ? envKey.trim() : "") || "";
    return { ...this.settings, finnhubApiKey: effectiveKey };
  }

  async updateSettings(partial: Partial<InsertAlertSettings>): Promise<AlertSettings> {
    this.settings = { ...this.settings, ...partial, id: "default" };
    return this.settings;
  }
}

export const storage = new MemStorage();
