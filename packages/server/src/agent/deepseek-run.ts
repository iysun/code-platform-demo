import OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import { randomUUID } from "node:crypto";
import { appConfig } from "../config.js";
import { sessionRepo } from "../repositories/session-repo.js";
import { executeDemoTool } from "../tools/executors.js";
import type { RunChatParams } from "./run-query.js";

const DEMO_TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read a text file relative to the workspace root",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "e.g. src/utils.ts" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_directory",
      description: "List files and directories under a workspace-relative path",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Relative directory, default workspace root",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_code",
      description: "Search for a case-insensitive substring in workspace text files",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          path: { type: "string", description: "Directory to search under" },
        },
        required: ["query"],
      },
    },
  },
];

function createClient(): OpenAI {
  return new OpenAI({
    apiKey: appConfig.deepseekApiKey,
    baseURL: appConfig.deepseekBaseUrl,
  });
}

function toOpenAiMessages(
  rows: Awaited<ReturnType<typeof sessionRepo.getMessages>>
): ChatCompletionMessageParam[] {
  return rows.map((m) => ({
    role: m.role as "user" | "assistant" | "system",
    content: m.content,
  }));
}

type AccumulatedToolCall = {
  id: string;
  name: string;
  arguments: string;
};

export async function runDeepSeekChat(params: RunChatParams): Promise<void> {
  const { sessionId, prompt, isFirstUserMessage, onEvent, signal } = params;
  const session = await sessionRepo.getSession(sessionId);
  if (!session) {
    await onEvent({ type: "error", message: "Session not found" });
    return;
  }

  const prior = await sessionRepo.getMessages(sessionId);
  await sessionRepo.appendUserMessage(sessionId, prompt);
  if (isFirstUserMessage) {
    await sessionRepo.updateTitle(sessionId, prompt);
  }

  await onEvent({ type: "session", sessionId });

  const client = createClient();
  const messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `你是开源演示用的代码助手。工作区根目录: ${appConfig.workspaceRoot}。文件路径均相对于该根目录（例如 src/utils.ts，不要加 samples/ 前缀）。仅分析工作区内文件，用简体中文回答。可使用 read_file、list_directory、search_code 工具。`,
    },
    ...toOpenAiMessages(prior),
    { role: "user", content: prompt },
  ];

  const assistantBuffer: string[] = [];
  const maxTurns = 12;

  try {
    for (let turn = 0; turn < maxTurns; turn++) {
      if (signal?.aborted) break;

      const stream = await client.chat.completions.create(
        {
          model: appConfig.deepseekModel,
          messages,
          tools: DEMO_TOOLS,
          stream: true,
        },
        { signal }
      );

      let turnText = "";
      const toolAcc = new Map<number, AccumulatedToolCall>();

      for await (const chunk of stream) {
        if (signal?.aborted) break;
        const choice = chunk.choices[0];
        if (!choice) continue;

        const delta = choice.delta;
        if (delta.content) {
          turnText += delta.content;
          assistantBuffer.push(delta.content);
          await onEvent({ type: "delta", text: delta.content });
        }

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            let acc = toolAcc.get(idx);
            if (!acc) {
              acc = {
                id: tc.id ?? randomUUID(),
                name: tc.function?.name ?? "",
                arguments: "",
              };
              toolAcc.set(idx, acc);
            }
            if (tc.id) acc.id = tc.id;
            if (tc.function?.name) acc.name = tc.function.name;
            if (tc.function?.arguments) acc.arguments += tc.function.arguments;
          }
        }
      }

      const toolCalls = [...toolAcc.values()].filter((t) => t.name);
      if (toolCalls.length === 0) {
        break;
      }

      messages.push({
        role: "assistant",
        content: turnText || null,
        tool_calls: toolCalls.map((t) => ({
          id: t.id,
          type: "function" as const,
          function: { name: t.name, arguments: t.arguments },
        })),
      });

      for (const tc of toolCalls) {
        let input: Record<string, unknown> = {};
        try {
          input = JSON.parse(tc.arguments || "{}") as Record<string, unknown>;
        } catch {
          input = {};
        }

        await sessionRepo.recordToolStart(sessionId, tc.name, input, tc.id);
        await onEvent({
          type: "tool_start",
          toolCallId: tc.id,
          toolName: tc.name,
          input,
        });

        let output: string;
        try {
          output = await executeDemoTool(tc.name, input);
        } catch (err) {
          output = err instanceof Error ? err.message : String(err);
          await sessionRepo.recordToolEnd(tc.id, output, "error");
          await onEvent({
            type: "tool_end",
            toolCallId: tc.id,
            toolName: tc.name,
            summary: output,
          });
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: output,
          });
          continue;
        }

        await sessionRepo.recordToolEnd(tc.id, output);
        await onEvent({
          type: "tool_end",
          toolCallId: tc.id,
          toolName: tc.name,
          summary: output.slice(0, 500),
        });
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: output,
        });
      }
    }

    const fullText = assistantBuffer.join("");
    if (fullText.trim()) {
      await sessionRepo.appendAssistantMessage(sessionId, fullText);
    }
    await sessionRepo.touchSession(sessionId);
    await onEvent({
      type: "done",
      sessionId,
      result: fullText,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") return;
    await onEvent({
      type: "error",
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
