import { tool } from "@anthropic-ai/claude-agent-sdk";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { resolveWithinWorkspace } from "./path-utils.js";

export const listDirectoryTool = tool(
  "list_directory",
  "List files and directories under a workspace-relative path (non-recursive)",
  {
    path: z
      .string()
      .optional()
      .describe("Relative directory path, default is workspace root"),
  },
  async ({ path: relPath }) => {
    const rel = relPath ?? ".";
    try {
      const abs = resolveWithinWorkspace(rel);
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
      return {
        content: [
          {
            type: "text",
            text: lines.length ? lines.join("\n") : "(empty directory)",
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
