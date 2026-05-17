import { readFile } from "node:fs/promises";
import path from "node:path";
import { readdir, stat } from "node:fs/promises";
import { appConfig } from "../config.js";
import { resolveWithinWorkspace } from "./path-utils.js";

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "data",
]);

export async function executeReadFile(relPath: string): Promise<string> {
  const abs = resolveWithinWorkspace(relPath);
  const content = await readFile(abs, "utf8");
  return content.length > 32_000
    ? `${content.slice(0, 32_000)}\n…(truncated)`
    : content;
}

export async function executeListDirectory(relPath?: string): Promise<string> {
  const abs = resolveWithinWorkspace(relPath ?? ".");
  const entries = await readdir(abs, { withFileTypes: true });
  const lines: string[] = [];
  for (const ent of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const kind = ent.isDirectory() ? "dir" : "file";
    if (ent.isFile()) {
      const st = await stat(path.join(abs, ent.name));
      lines.push(`${kind}\t${ent.name}\t${st.size} bytes`);
    } else {
      lines.push(`${kind}\t${ent.name}`);
    }
  }
  return lines.length ? lines.join("\n") : "(empty directory)";
}

async function walk(
  dir: string,
  root: string,
  files: string[],
  depth: number
): Promise<void> {
  if (depth > 6) return;
  const entries = await readdir(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (!SKIP_DIRS.has(ent.name)) {
        await walk(full, root, files, depth + 1);
      }
    } else if (ent.isFile() && files.length < 200) {
      files.push(path.relative(root, full));
    }
  }
}

export async function executeSearchCode(
  query: string,
  relPath?: string
): Promise<string> {
  const root = resolveWithinWorkspace(relPath ?? ".");
  const files: string[] = [];
  await walk(root, appConfig.workspaceRoot, files, 0);

  const needle = query.toLowerCase();
  const hits: string[] = [];
  const maxHits = 40;

  for (const rel of files) {
    if (hits.length >= maxHits) break;
    const ext = path.extname(rel).toLowerCase();
    if (
      ![
        ".ts",
        ".tsx",
        ".js",
        ".jsx",
        ".json",
        ".md",
        ".css",
        ".html",
        ".py",
        ".go",
        ".rs",
        "",
      ].includes(ext) &&
      ext !== ".txt"
    ) {
      continue;
    }
    const abs = path.join(appConfig.workspaceRoot, rel);
    let text: string;
    try {
      text = await readFile(abs, "utf8");
    } catch {
      continue;
    }
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (lines[i]!.toLowerCase().includes(needle)) {
        hits.push(`${rel}:${i + 1}: ${lines[i]!.trim().slice(0, 120)}`);
        if (hits.length >= maxHits) break;
      }
    }
  }

  return hits.length
    ? hits.join("\n")
    : `No matches for "${query}" under ${relPath ?? "."}`;
}

export async function executeDemoTool(
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  switch (name) {
    case "read_file":
      return executeReadFile(String(args.path ?? ""));
    case "list_directory":
      return executeListDirectory(
        args.path !== undefined ? String(args.path) : undefined
      );
    case "search_code":
      return executeSearchCode(
        String(args.query ?? ""),
        args.path !== undefined ? String(args.path) : undefined
      );
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
