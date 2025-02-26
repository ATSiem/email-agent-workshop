import { sql } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  subject: text("subject").notNull(),
  from: text("from").notNull(),
  to: text("to").notNull(),
  date: text("date").notNull(),
  body: text("body").notNull(),
  attachments: text("attachments").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  summary: text("summary").notNull(),
  labels: text("labels").notNull(), // SQLite doesn't support arrays, we'll store JSON string
});

export const clients = sqliteTable("clients", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  domains: text("domains").notNull(), // JSON string with domains
  emails: text("emails").notNull(),   // JSON string with specific emails
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const reportTemplates = sqliteTable("report_templates", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  format: text("format").notNull(),
  clientId: text("client_id").references(() => clients.id),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});
