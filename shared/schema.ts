import { pgTable, text, varchar, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

// --- News Articles ---
export const newsItems = pgTable("news_items", {
  id: varchar("id").primaryKey(),
  headline: text("headline").notNull(),
  summary: text("summary"),
  source: text("source").notNull(),
  url: text("url").notNull(),
  publishedAt: integer("published_at").notNull(), // unix timestamp
  category: text("category").notNull().default("general"), // general | earnings | fed | macro | geopolitical
  impact: text("impact").notNull().default("medium"), // low | medium | high | critical
  isRead: boolean("is_read").notNull().default(false),
  isAlerted: boolean("is_alerted").notNull().default(false),
});

export const insertNewsItemSchema = createInsertSchema(newsItems).omit({ isRead: true, isAlerted: true });
export type InsertNewsItem = z.infer<typeof insertNewsItemSchema>;
export type NewsItem = typeof newsItems.$inferSelect;

// --- Economic Calendar Events ---
export const calendarEvents = pgTable("calendar_events", {
  id: varchar("id").primaryKey(),
  eventName: text("event_name").notNull(),
  country: text("country").notNull().default("US"),
  scheduledAt: integer("scheduled_at").notNull(), // unix timestamp (CT)
  impact: text("impact").notNull().default("medium"), // low | medium | high
  forecast: text("forecast"),
  previous: text("previous"),
  actual: text("actual"),
  unit: text("unit"),
  isAnnounced: boolean("is_announced").notNull().default(false),
});

export const insertCalendarEventSchema = createInsertSchema(calendarEvents).omit({ isAnnounced: true });
export type InsertCalendarEvent = z.infer<typeof insertCalendarEventSchema>;
export type CalendarEvent = typeof calendarEvents.$inferSelect;

// --- Alert Settings ---
export const alertSettings = pgTable("alert_settings", {
  id: varchar("id").primaryKey().default("default"),
  finnhubApiKey: text("finnhub_api_key").notNull().default(""),
  alertSound: boolean("alert_sound").notNull().default(true),
  alertHighOnly: boolean("alert_high_only").notNull().default(false),
  keywords: text("keywords").array().notNull().default(sql`'{}'`),
  pollingIntervalSeconds: integer("polling_interval_seconds").notNull().default(15),
});

export const insertAlertSettingsSchema = createInsertSchema(alertSettings);
export type InsertAlertSettings = z.infer<typeof insertAlertSettingsSchema>;
export type AlertSettings = typeof alertSettings.$inferSelect;
