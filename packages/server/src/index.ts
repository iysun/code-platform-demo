import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { appConfig, hasLlmCredentials, validateConfig } from "./config.js";
import { runMigrations } from "./db/migrate.js";
import { sessionRepo } from "./repositories/session-repo.js";
import { chatRoutes } from "./routes/chat.js";
import { sessionsRoutes } from "./routes/sessions.js";

validateConfig();
await runMigrations();

const app = new Hono();

app.use(
  "*",
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  })
);

app.get("/api/health", async (c) => {
  let dbOk = false;
  try {
    await sessionRepo.countSessions();
    dbOk = true;
  } catch {
    dbOk = false;
  }
  return c.json({
    ok: true,
    agentProvider: appConfig.agentProvider,
    workspaceRoot: appConfig.workspaceRoot,
    databasePath: appConfig.databasePath,
    db: dbOk ? "ok" : "error",
    hasApiKey: hasLlmCredentials(),
    model:
      appConfig.agentProvider === "deepseek"
        ? appConfig.deepseekModel
        : appConfig.claudeModel,
  });
});

app.route("/api/sessions", sessionsRoutes);
app.route("/api/chat", chatRoutes);

serve(
  {
    fetch: app.fetch,
    port: appConfig.port,
  },
  (info) => {
    console.log(
      `code-platform-demo server listening on http://localhost:${info.port}`
    );
    console.log(`  provider:  ${appConfig.agentProvider}`);
    console.log(`  workspace: ${appConfig.workspaceRoot}`);
    console.log(`  database:  ${appConfig.databasePath}`);
  }
);
