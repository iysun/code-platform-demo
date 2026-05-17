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

export const appConfig = {
  projectRoot,
  workspaceRoot,
  databasePath,
  port: Number(process.env.PORT ?? 8787),
  model: process.env.CLAUDE_MODEL?.trim() ?? "claude-sonnet-4-20250514",
  allowDangerousPermissions:
    process.env.ALLOW_DANGEROUS_PERMISSIONS === "true",
};

export function hasLlmCredentials(): boolean {
  return Boolean(
    process.env.ANTHROPIC_API_KEY?.trim() ||
      process.env.ANTHROPIC_AUTH_TOKEN?.trim()
  );
}

export function validateConfig(): void {
  if (!existsSync(appConfig.workspaceRoot)) {
    throw new Error(
      `WORKSPACE_ROOT does not exist: ${appConfig.workspaceRoot}`
    );
  }
  if (!hasLlmCredentials()) {
    console.warn(
      "[warn] ANTHROPIC_API_KEY (or ANTHROPIC_AUTH_TOKEN) is not set — chat requests will fail."
    );
  } else {
    const base = process.env.ANTHROPIC_BASE_URL?.trim();
    console.log(`[info] Agent model: ${appConfig.model}`);
    if (base) {
      console.log(`[info] ANTHROPIC_BASE_URL: ${base}`);
    }
  }
}
