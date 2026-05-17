import { query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { sessionRepo } from "../repositories/session-repo.js";
import { buildAgentOptions } from "./options.js";
import type { SseEvent } from "./sse-events.js";

function extractTextFromAssistant(msg: Extract<SDKMessage, { type: "assistant" }>): string {
  const parts: string[] = [];
  for (const block of msg.message.content) {
    if (block.type === "text") {
      parts.push(block.text);
    }
  }
  return parts.join("");
}

function extractToolUses(msg: Extract<SDKMessage, { type: "assistant" }>) {
  const uses: Array<{ id: string; name: string; input: unknown }> = [];
  for (const block of msg.message.content) {
    if (block.type === "tool_use") {
      uses.push({ id: block.id, name: block.name, input: block.input });
    }
  }
  return uses;
}

function summarizeToolResult(msg: Extract<SDKMessage, { type: "user" }>): string {
  const blocks = msg.message.content;
  if (!Array.isArray(blocks)) return "";
  const parts: string[] = [];
  for (const block of blocks) {
    if (typeof block === "object" && block !== null && "type" in block) {
      if (block.type === "tool_result") {
        const content = (block as { content?: unknown }).content;
        if (typeof content === "string") {
          parts.push(content.slice(0, 500));
        } else if (Array.isArray(content)) {
          for (const c of content) {
            if (
              typeof c === "object" &&
              c !== null &&
              "type" in c &&
              c.type === "text" &&
              "text" in c
            ) {
              parts.push(String((c as { text: string }).text).slice(0, 500));
            }
          }
        }
      }
    }
  }
  return parts.join("\n").slice(0, 2000) || "(no output)";
}

function getToolResultId(msg: Extract<SDKMessage, { type: "user" }>): string | undefined {
  const blocks = msg.message.content;
  if (!Array.isArray(blocks)) return undefined;
  for (const block of blocks) {
    if (
      typeof block === "object" &&
      block !== null &&
      "type" in block &&
      block.type === "tool_result" &&
      "tool_use_id" in block
    ) {
      return String((block as { tool_use_id: string }).tool_use_id);
    }
  }
  return undefined;
}

export type RunChatParams = {
  sessionId: string;
  prompt: string;
  isFirstUserMessage: boolean;
  onEvent: (event: SseEvent) => void | Promise<void>;
  signal?: AbortSignal;
};

export async function runChat(params: RunChatParams): Promise<void> {
  const { sessionId, prompt, isFirstUserMessage, onEvent, signal } = params;
  const session = await sessionRepo.getSession(sessionId);
  if (!session) {
    await onEvent({ type: "error", message: "Session not found" });
    return;
  }

  await sessionRepo.appendUserMessage(sessionId, prompt);
  if (isFirstUserMessage) {
    await sessionRepo.updateTitle(sessionId, prompt);
  }

  await onEvent({ type: "session", sessionId });

  const assistantBuffer: string[] = [];
  const pendingTools = new Map<string, string>();

  let q: ReturnType<typeof query> | undefined;

  const abortHandler = () => {
    void q?.interrupt();
  };
  signal?.addEventListener("abort", abortHandler);

  try {
    q = query({
      prompt,
      options: buildAgentOptions(session.sdkSessionId),
    });

    for await (const message of q) {
      if (signal?.aborted) break;

      switch (message.type) {
        case "stream_event": {
          const event = message.event;
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            const text = event.delta.text;
            assistantBuffer.push(text);
            await onEvent({ type: "delta", text });
          }
          break;
        }
        case "assistant": {
          const text = extractTextFromAssistant(message);
          if (text && !message.parent_tool_use_id) {
            assistantBuffer.length = 0;
            assistantBuffer.push(text);
          }
          for (const tu of extractToolUses(message)) {
            pendingTools.set(tu.id, tu.name);
            await sessionRepo.recordToolStart(
              sessionId,
              tu.name,
              tu.input,
              tu.id
            );
            await onEvent({
              type: "tool_start",
              toolCallId: tu.id,
              toolName: tu.name,
              input: tu.input,
            });
          }
          break;
        }
        case "user": {
          const toolUseId = getToolResultId(message);
          const summary = summarizeToolResult(message);
          if (toolUseId) {
            const toolName = pendingTools.get(toolUseId) ?? "tool";
            await sessionRepo.recordToolEnd(toolUseId, summary);
            await onEvent({
              type: "tool_end",
              toolCallId: toolUseId,
              toolName,
              summary,
            });
          }
          break;
        }
        case "result": {
          if (message.subtype === "success") {
            const fullText =
              assistantBuffer.join("") ||
              (typeof message.result === "string" ? message.result : "");
            if (fullText.trim()) {
              await sessionRepo.appendAssistantMessage(sessionId, fullText);
            }
            const sdkSessionId =
              "session_id" in message
                ? (message as { session_id?: string }).session_id
                : undefined;
            if (sdkSessionId) {
              await sessionRepo.upsertSdkSessionId(sessionId, sdkSessionId);
            }
            await sessionRepo.touchSession(sessionId);
            await onEvent({
              type: "done",
              sessionId,
              sdkSessionId,
              result:
                typeof message.result === "string" ? message.result : fullText,
            });
          } else {
            const errText =
              "errors" in message && Array.isArray(message.errors)
                ? message.errors.join("; ")
                : "Agent run failed";
            await onEvent({ type: "error", message: errText });
          }
          break;
        }
        default:
          break;
      }
    }
  } catch (err) {
    await onEvent({
      type: "error",
      message: err instanceof Error ? err.message : String(err),
    });
  } finally {
    signal?.removeEventListener("abort", abortHandler);
    if (q && "close" in q && typeof q.close === "function") {
      q.close();
    }
  }
}
