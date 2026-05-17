import { Hono } from "hono";
import { stream } from "hono/streaming";
import { z } from "zod";
import { runAgentChat } from "../agent/run-chat.js";
import { formatSse } from "../agent/sse-events.js";
import { appConfig, hasLlmCredentials } from "../config.js";
import { sessionRepo } from "../repositories/session-repo.js";

const chatBodySchema = z.object({
  prompt: z.string().min(1),
  sessionId: z.string().uuid().optional(),
});

export const chatRoutes = new Hono();

chatRoutes.post("/", async (c) => {
  if (!hasLlmCredentials()) {
    const keyName =
      appConfig.agentProvider === "deepseek"
        ? "DEEPSEEK_API_KEY"
        : "ANTHROPIC_API_KEY";
    return c.json({ error: `${keyName} is not configured` }, 503);
  }

  const parsed = chatBodySchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const { prompt, sessionId: existingId } = parsed.data;
  let sessionId = existingId;
  let isFirstUserMessage = false;

  if (sessionId) {
    const session = await sessionRepo.getSession(sessionId);
    if (!session) {
      return c.json({ error: "Session not found" }, 404);
    }
    const msgs = await sessionRepo.getMessages(sessionId);
    isFirstUserMessage = msgs.length === 0;
  } else {
    sessionId = await sessionRepo.createSession(appConfig.workspaceRoot);
    isFirstUserMessage = true;
  }

  const abortController = new AbortController();
  c.req.raw.signal.addEventListener("abort", () => abortController.abort());

  return stream(c, async (streamWriter) => {
    await streamWriter.write(
      formatSse({ type: "session", sessionId: sessionId! })
    );

    await runAgentChat({
      sessionId: sessionId!,
      prompt,
      isFirstUserMessage,
      signal: abortController.signal,
      onEvent: async (event) => {
        await streamWriter.write(formatSse(event));
      },
    });
  });
});
