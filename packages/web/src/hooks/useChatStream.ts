import { useCallback, useRef, useState } from "react";
import type { Message, SseEvent, ToolCall } from "../api/client";
import { streamChat } from "../api/client";

export type ChatItem =
  | { kind: "message"; message: Message }
  | {
      kind: "tool";
      toolCallId: string;
      toolName: string;
      input: unknown;
      summary?: string;
      status: "running" | "done" | "error";
    };

export function useChatStream() {
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [items, setItems] = useState<ChatItem[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loadHistory = useCallback(
    (messages: Message[], toolCalls: ToolCall[]) => {
      const merged: ChatItem[] = [];
      const toolsByTime = [...toolCalls].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      let ti = 0;

      for (const msg of messages) {
        merged.push({ kind: "message", message: msg });
        if (msg.role === "assistant") {
          while (
            ti < toolsByTime.length &&
            new Date(toolsByTime[ti]!.createdAt).getTime() <=
              new Date(msg.createdAt).getTime() + 1000
          ) {
            const t = toolsByTime[ti]!;
            merged.push({
              kind: "tool",
              toolCallId: t.id,
              toolName: t.toolName,
              input: safeParseJson(t.inputJson),
              summary: t.outputSummary ?? undefined,
              status: t.status,
            });
            ti++;
          }
        }
      }
      while (ti < toolsByTime.length) {
        const t = toolsByTime[ti]!;
        merged.push({
          kind: "tool",
          toolCallId: t.id,
          toolName: t.toolName,
          input: safeParseJson(t.inputJson),
          summary: t.outputSummary ?? undefined,
          status: t.status,
        });
        ti++;
      }
      setItems(merged);
    },
    []
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setSessionId(undefined);
    setItems([]);
    setError(null);
  }, []);

  const send = useCallback(
    async (prompt: string, existingSessionId?: string) => {
      setError(null);
      setIsStreaming(true);
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      const userMsg: Message = {
        id: `local-user-${Date.now()}`,
        sessionId: existingSessionId ?? "",
        role: "user",
        content: prompt,
        createdAt: Date.now(),
      };
      setItems((prev) => [...prev, { kind: "message", message: userMsg }]);

      let assistantText = "";
      let assistantStarted = false;
      const sid = existingSessionId ?? sessionId;

      try {
        await streamChat(
          prompt,
          sid,
          (event: SseEvent) => {
            if (event.type === "session") {
              setSessionId(event.sessionId);
            } else if (event.type === "delta") {
              assistantText += event.text;
              if (!assistantStarted) {
                assistantStarted = true;
                const msg: Message = {
                  id: `local-asst-${Date.now()}`,
                  sessionId: event.type === "delta" ? sid ?? "" : "",
                  role: "assistant",
                  content: assistantText,
                  createdAt: Date.now(),
                };
                setItems((prev) => [...prev, { kind: "message", message: msg }]);
              } else {
                setItems((prev) => {
                  const next = [...prev];
                  for (let i = next.length - 1; i >= 0; i--) {
                    const it = next[i];
                    if (it?.kind === "message" && it.message.role === "assistant") {
                      next[i] = {
                        kind: "message",
                        message: {
                          ...it.message,
                          content: assistantText,
                        },
                      };
                      break;
                    }
                  }
                  return next;
                });
              }
            } else if (event.type === "tool_start") {
              setItems((prev) => [
                ...prev,
                {
                  kind: "tool",
                  toolCallId: event.toolCallId,
                  toolName: event.toolName,
                  input: event.input,
                  status: "running",
                },
              ]);
            } else if (event.type === "tool_end") {
              setItems((prev) =>
                prev.map((it) =>
                  it.kind === "tool" && it.toolCallId === event.toolCallId
                    ? {
                        ...it,
                        summary: event.summary,
                        status: "done" as const,
                      }
                    : it
                )
              );
            } else if (event.type === "done") {
              setSessionId(event.sessionId);
            } else if (event.type === "error") {
              setError(event.message);
            }
          },
          ac.signal
        );
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [sessionId]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  return {
    sessionId,
    setSessionId,
    items,
    isStreaming,
    error,
    send,
    stop,
    reset,
    loadHistory,
  };
}

function safeParseJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
