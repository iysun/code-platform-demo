import { tool } from "@anthropic-ai/claude-agent-sdk";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
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

export const searchCodeTool = tool(
  "search_code",
  "Search for a case-insensitive substring in workspace text files",
  {
    query: z.string().describe("Substring to search for"),
    path: z
      .string()
      .optional()
      .describe("Directory to search under, relative to workspace"),
  },
  async ({ query: q, path: relPath }) => {
    const rel = relPath ?? ".";
    try {
      const root = resolveWithinWorkspace(rel);
      const files: string[] = [];
      await walk(root, appConfig.workspaceRoot, files, 0);

      const needle = q.toLowerCase();
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

      return {
        content: [
          {
            type: "text",
            text: hits.length
              ? hits.join("\n")
              : `No matches for "${q}" under ${rel}`,
          },
        ],
      };
    } catch (err) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: err instanceof Error ? err.message : String(err),
          },
        ],
      };
    }
  }
);
