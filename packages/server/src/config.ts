import { config } from "dotenv";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../../..");

config({ path: path.join(projectRoot, ".env") });

function resolvePath(maybeRelative: string): string {
  if (path.isAbsolute(maybeRelative)) return maybeRelative;
  return path.resolve(projectRoot, maybeRelative);
}

const defaultWorkspace = path.join(projectRoot, "samples");
const workspaceRoot = resolvePath(
  process.env.WORKSPACE_ROOT?.trim() || defaultWorkspace
);

const dbUrl = process.env.DATABASE_URL?.trim() || "file:./data/app.db";
let databasePath: string;
if (dbUrl.startsWith("file:")) {
  const raw = dbUrl.slice("file:".length);
  databasePath = resolvePath(raw.startsWith("./") ? raw : raw);
} else {
  databasePath = resolvePath("./data/app.db");
}

const agentProviderRaw = process.env.AGENT_PROVIDER?.trim().toLowerCase();
const agentProvider =
  agentProviderRaw === "claude" ? "claude" : ("deepseek" as const);

export const appConfig = {
  projectRoot,
  workspaceRoot,
  databasePath,
  port: Number(process.env.PORT ?? 8787),
  agentProvider,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY?.trim() ?? "",
  claudeModel: process.env.CLAUDE_MODEL?.trim() ?? "claude-sonnet-4-20250514",
  deepseekApiKey: process.env.DEEPSEEK_API_KEY?.trim() ?? "",
  deepseekBaseUrl:
    process.env.DEEPSEEK_BASE_URL?.trim() ?? "https://api.deepseek.com",
  deepseekModel: process.env.DEEPSEEK_MODEL?.trim() ?? "deepseek-chat",
  allowDangerousPermissions:
    process.env.ALLOW_DANGEROUS_PERMISSIONS === "true",
};

export function hasLlmCredentials(): boolean {
  if (appConfig.agentProvider === "deepseek") {
    return Boolean(appConfig.deepseekApiKey);
  }
  return Boolean(appConfig.anthropicApiKey);
}

export function validateConfig(): void {
  if (!existsSync(appConfig.workspaceRoot)) {
    throw new Error(
      `WORKSPACE_ROOT does not exist: ${appConfig.workspaceRoot}`
    );
  }
  if (appConfig.agentProvider === "deepseek") {
    if (!appConfig.deepseekApiKey) {
      console.warn(
        "[warn] DEEPSEEK_API_KEY is not set — chat requests will fail."
      );
    } else {
      console.log(
        `[info] Agent provider: deepseek (${appConfig.deepseekModel})`
      );
    }
  } else if (!appConfig.anthropicApiKey) {
    console.warn(
      "[warn] ANTHROPIC_API_KEY is not set — chat requests will fail."
    );
  } else {
    console.log(`[info] Agent provider: claude (${appConfig.claudeModel})`);
  }
}
