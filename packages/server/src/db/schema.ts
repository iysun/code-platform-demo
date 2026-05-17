import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    sdkSessionId: text("sdk_session_id"),
    title: text("title").notNull().default("新对话"),
    workspaceRoot: text("workspace_root").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("sessions_updated_idx").on(t.updatedAt)]
);

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["user", "assistant", "system"] }).notNull(),
    content: text("content").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("messages_session_idx").on(t.sessionId, t.createdAt)]
);

export const toolCalls = sqliteTable(
  "tool_calls",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    messageId: text("message_id").references(() => messages.id, {
      onDelete: "set null",
    }),
    toolName: text("tool_name").notNull(),
    inputJson: text("input_json").notNull().default("{}"),
    outputSummary: text("output_summary"),
    status: text("status", { enum: ["running", "done", "error"] })
      .notNull()
      .default("running"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    finishedAt: integer("finished_at", { mode: "timestamp_ms" }),
  },
  (t) => [index("tool_calls_session_idx").on(t.sessionId, t.createdAt)]
);

export const sessionsRelations = relations(sessions, ({ many }) => ({
  messages: many(messages),
  toolCalls: many(toolCalls),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  session: one(sessions, {
    fields: [messages.sessionId],
    references: [sessions.id],
  }),
}));

export const toolCallsRelations = relations(toolCalls, ({ one }) => ({
  session: one(sessions, {
    fields: [toolCalls.sessionId],
    references: [sessions.id],
  }),
}));
