import { tool } from "@anthropic-ai/claude-agent-sdk";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { resolveWithinWorkspace } from "./path-utils.js";

export const readFileTool = tool(
  "read_file",
  "Read a text file relative to the workspace root",
  {
    path: z.string().describe("Relative file path, e.g. src/utils.ts"),
  },
  async ({ path: relPath }) => {
    try {
      const abs = resolveWithinWorkspace(relPath);
      const content = await readFile(abs, "utf8");
      const preview =
        content.length > 32_000
          ? `${content.slice(0, 32_000)}\n…(truncated)`
          : content;
      return {
        content: [{ type: "text", text: preview }],
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
