import type { Options } from "@anthropic-ai/claude-agent-sdk";
import { appConfig } from "../config.js";
import { createDemoMcpServer, DEMO_ALLOWED_TOOLS } from "../tools/index.js";

export function buildAgentOptions(sdkSessionId?: string | null): Options {
  const demoServer = createDemoMcpServer();
  const allowBypass = appConfig.allowDangerousPermissions;

  return {
    cwd: appConfig.workspaceRoot,
    model: appConfig.model,
    resume: sdkSessionId ?? undefined,
    mcpServers: { demo: demoServer },
    allowedTools: [...DEMO_ALLOWED_TOOLS],
    tools: { type: "preset", preset: "claude_code" },
    systemPrompt: {
      type: "preset",
      preset: "claude_code",
      append:
        "你是开源演示用的代码助手。仅分析当前工作区（WORKSPACE_ROOT）内的文件，用简体中文回答。不要编造仓库中不存在的内容。",
    },
    permissionMode: allowBypass ? "bypassPermissions" : "default",
    allowDangerouslySkipPermissions: allowBypass,
    includePartialMessages: true,
    maxTurns: 20,
    env: {
      ...process.env,
      CLAUDE_AGENT_SDK_CLIENT_APP: "code-platform-demo",
    },
  };
}
