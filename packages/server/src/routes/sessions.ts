import { Hono } from "hono";
import { appConfig } from "../config.js";
import { sessionRepo } from "../repositories/session-repo.js";

export const sessionsRoutes = new Hono();

sessionsRoutes.get("/", async (c) => {
  const list = await sessionRepo.listSessions();
  return c.json({ sessions: list });
});

sessionsRoutes.post("/", async (c) => {
  let title = "新对话";
  try {
    const json = await c.req.json<{ title?: string }>();
    title = json.title ?? title;
  } catch {
    /* empty body */
  }
  const id = await sessionRepo.createSession(appConfig.workspaceRoot, title);
  const session = await sessionRepo.getSession(id);
  return c.json({ session }, 201);
});

sessionsRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const session = await sessionRepo.getSession(id);
  if (!session) return c.json({ error: "Not found" }, 404);
  const msgs = await sessionRepo.getMessages(id);
  const tools = await sessionRepo.getToolCalls(id);
  return c.json({ session, messages: msgs, toolCalls: tools });
});

sessionsRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const session = await sessionRepo.getSession(id);
  if (!session) return c.json({ error: "Not found" }, 404);
  await sessionRepo.deleteSession(id);
  return c.json({ ok: true });
});
