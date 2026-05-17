import { appConfig } from "../config.js";
import { runDeepSeekChat } from "./deepseek-run.js";
import { runChat as runClaudeChat, type RunChatParams } from "./run-query.js";

export type { RunChatParams } from "./run-query.js";

export async function runAgentChat(params: RunChatParams): Promise<void> {
  if (appConfig.agentProvider === "deepseek") {
    return runDeepSeekChat(params);
  }
  return runClaudeChat(params);
}
