import { createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { listDirectoryTool } from "./list-dir.js";
import { readFileTool } from "./read-file.js";
import { searchCodeTool } from "./search-code.js";

export function createDemoMcpServer() {
  return createSdkMcpServer({
    name: "demo",
    version: "1.0.0",
    tools: [readFileTool, listDirectoryTool, searchCodeTool],
  });
}

export const DEMO_ALLOWED_TOOLS = [
  "Read",
  "Grep",
  "mcp__demo__read_file",
  "mcp__demo__list_directory",
  "mcp__demo__search_code",
] as const;
