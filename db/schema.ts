import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const websiteVisits = sqliteTable(
  "website_visits",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sessionId: text("session_id").notNull(),
    page: text("page").notNull(),
    referrerHost: text("referrer_host").notNull(),
    utmSource: text("utm_source").notNull().default(""),
    utmMedium: text("utm_medium").notNull().default(""),
    utmCampaign: text("utm_campaign").notNull().default(""),
    device: text("device").notNull(),
    browser: text("browser").notNull(),
    language: text("language").notNull(),
    country: text("country").notNull().default(""),
    consent: text("consent").notNull().default("analytics"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("website_visits_session_id_unique").on(table.sessionId)]
);
