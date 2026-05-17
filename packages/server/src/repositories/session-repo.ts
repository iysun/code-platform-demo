import { desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "../db/index.js";
import { messages, sessions, toolCalls } from "../db/schema.js";

function truncateTitle(text: string, max = 48): string {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

export const sessionRepo = {
  async createSession(workspaceRoot: string, title = "新对话") {
    const id = randomUUID();
    const now = new Date();
    await db.insert(sessions).values({
      id,
      title,
      workspaceRoot,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  },

  async getSession(id: string) {
    const rows = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, id))
      .limit(1);
    return rows[0];
  },

  async listSessions(limit = 50) {
    return db
      .select({
        id: sessions.id,
        title: sessions.title,
        workspaceRoot: sessions.workspaceRoot,
        updatedAt: sessions.updatedAt,
        createdAt: sessions.createdAt,
      })
      .from(sessions)
      .orderBy(desc(sessions.updatedAt))
      .limit(limit);
  },

  async touchSession(id: string) {
    await db
      .update(sessions)
      .set({ updatedAt: new Date() })
      .where(eq(sessions.id, id));
  },

  async updateTitle(id: string, title: string) {
    await db
      .update(sessions)
      .set({ title: truncateTitle(title), updatedAt: new Date() })
      .where(eq(sessions.id, id));
  },

  async upsertSdkSessionId(id: string, sdkSessionId: string) {
    await db
      .update(sessions)
      .set({ sdkSessionId, updatedAt: new Date() })
      .where(eq(sessions.id, id));
  },

  async appendUserMessage(sessionId: string, content: string) {
    const id = randomUUID();
    await db.insert(messages).values({
      id,
      sessionId,
      role: "user",
      content,
      createdAt: new Date(),
    });
    await this.touchSession(sessionId);
    return id;
  },

  async appendAssistantMessage(sessionId: string, content: string) {
    const id = randomUUID();
    await db.insert(messages).values({
      id,
      sessionId,
      role: "assistant",
      content,
      createdAt: new Date(),
    });
    await this.touchSession(sessionId);
    return id;
  },

  async getMessages(sessionId: string) {
    return db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, sessionId))
      .orderBy(messages.createdAt);
  },

  async getToolCalls(sessionId: string) {
    return db
      .select()
      .from(toolCalls)
      .where(eq(toolCalls.sessionId, sessionId))
      .orderBy(toolCalls.createdAt);
  },

  async recordToolStart(
    sessionId: string,
    toolName: string,
    input: unknown,
    toolUseId?: string
  ) {
    const id = toolUseId ?? randomUUID();
    await db.insert(toolCalls).values({
      id,
      sessionId,
      toolName,
      inputJson: JSON.stringify(input ?? {}),
      status: "running",
      createdAt: new Date(),
    });
    return id;
  },

  async recordToolEnd(
    toolCallId: string,
    outputSummary: string,
    status: "done" | "error" = "done"
  ) {
    await db
      .update(toolCalls)
      .set({
        outputSummary: outputSummary.slice(0, 4000),
        status,
        finishedAt: new Date(),
      })
      .where(eq(toolCalls.id, toolCallId));
  },

  async deleteSession(id: string) {
    await db.delete(sessions).where(eq(sessions.id, id));
  },

  async countSessions(): Promise<number> {
    const rows = await db.select().from(sessions);
    return rows.length;
  },
};
