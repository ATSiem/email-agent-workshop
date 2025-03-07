import { pgTable, text, timestamp, integer } from 'drizzle-orm/pg-core';

// Define the clients table
export const clients = pgTable("clients", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  domains: text("domains").notNull(), // JSON string with domains
  emails: text("emails").notNull(),   // JSON string with specific emails
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Define the report_templates table
export const reportTemplates = pgTable("report_templates", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  format: text("format").notNull(),
  clientId: text("client_id").references(() => clients.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  // Track examples provided for this template
  examplePrompt: text("example_prompt"),
});

// Define the messages table
export const messages = pgTable("messages", {
  id: text("id").primaryKey(),
  subject: text("subject").notNull(),
  from: text("from").notNull(),
  to: text("to").notNull(),
  date: text("date").notNull(),
  body: text("body").notNull(),
  attachments: text("attachments").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  summary: text("summary"),
  labels: text("labels").notNull(),
  cc: text("cc").default(""),
  bcc: text("bcc").default(""),
});

// Define the report_feedback table
export const reportFeedback = pgTable("report_feedback", {
  id: text("id").primaryKey(),
  reportId: text("report_id").notNull(),
  clientId: text("client_id").references(() => clients.id),
  rating: integer("rating"),
  feedbackText: text("feedback_text"),
  actionsTaken: text("actions_taken"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  vectorSearchUsed: integer("vector_search_used"),
  searchQuery: text("search_query"),
  emailCount: integer("email_count"),
  copiedToClipboard: integer("copied_to_clipboard"),
  generationTimeMs: integer("generation_time_ms"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
}); 