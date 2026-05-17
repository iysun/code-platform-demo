export type HealthResponse = {
  ok: boolean;
  model?: string;
  workspaceRoot: string;
  databasePath: string;
  db: string;
  hasApiKey: boolean;
};

export type SessionSummary = {
  id: string;
  title: string;
  workspaceRoot: string;
  updatedAt: string | number;
  createdAt: string | number;
};

export type Message = {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string | number;
};

export type ToolCall = {
  id: string;
  sessionId: string;
  toolName: string;
  inputJson: string;
  outputSummary: string | null;
  status: "running" | "done" | "error";
  createdAt: string | number;
  finishedAt: string | number | null;
};

export type SseEvent =
  | { type: "session"; sessionId: string }
  | { type: "delta"; text: string }
  | {
      type: "tool_start";
      toolCallId: string;
      toolName: string;
      input: unknown;
    }
  | {
      type: "tool_end";
      toolCallId: string;
      toolName: string;
      summary: string;
    }
  | {
      type: "done";
      sessionId: string;
      sdkSessionId?: string;
      result?: string;
    }
  | { type: "error"; message: string };

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch("/api/health");
  if (!res.ok) throw new Error("Health check failed");
  return res.json() as Promise<HealthResponse>;
}

export async function listSessions(): Promise<SessionSummary[]> {
  const res = await fetch("/api/sessions");
  if (!res.ok) throw new Error("Failed to list sessions");
  const data = (await res.json()) as { sessions: SessionSummary[] };
  return data.sessions;
}

export async function createSession(title?: string): Promise<SessionSummary> {
  const res = await fetch("/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(title ? { title } : {}),
  });
  if (!res.ok) throw new Error("Failed to create session");
  const data = (await res.json()) as { session: SessionSummary };
  return data.session;
}

export async function getSession(id: string): Promise<{
  session: SessionSummary;
  messages: Message[];
  toolCalls: ToolCall[];
}> {
  const res = await fetch(`/api/sessions/${id}`);
  if (!res.ok) throw new Error("Session not found");
  return res.json() as Promise<{
    session: SessionSummary;
    messages: Message[];
    toolCalls: ToolCall[];
  }>;
}

export async function deleteSession(id: string): Promise<void> {
  const res = await fetch(`/api/sessions/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete session");
}

export async function streamChat(
  prompt: string,
  sessionId: string | undefined,
  onEvent: (event: SseEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, sessionId }),
    signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { error?: string }).error ?? `Chat failed: ${res.status}`
    );
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith("data: ")) continue;
      try {
        const event = JSON.parse(line.slice(6)) as SseEvent;
        onEvent(event);
      } catch {
        /* ignore malformed */
      }
    }
  }
}
