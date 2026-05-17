import { useCallback, useEffect, useState } from "react";
import type { HealthResponse, SessionSummary } from "./api/client";
import {
  createSession,
  deleteSession,
  fetchHealth,
  getSession,
  listSessions,
} from "./api/client";
import { Chat } from "./components/Chat";
import { SessionSidebar } from "./components/SessionSidebar";
import { useChatStream } from "./hooks/useChatStream";

export default function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const chat = useChatStream();

  const refreshSessions = useCallback(async () => {
    try {
      const list = await listSessions();
      setSessions(list);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void fetchHealth().then(setHealth).catch(() => setHealth(null));
    void refreshSessions();
  }, [refreshSessions]);

  const selectSession = async (id: string) => {
    chat.setSessionId(id);
    try {
      const data = await getSession(id);
      chat.loadHistory(data.messages, data.toolCalls);
    } catch (e) {
      chat.reset();
      chat.setSessionId(id);
    }
  };

  const handleNew = async () => {
    chat.reset();
    try {
      const s = await createSession();
      chat.setSessionId(s.id);
      await refreshSessions();
    } catch {
      /* chat will create on first message */
    }
  };

  const handleDelete = async (id: string) => {
    await deleteSession(id);
    if (chat.sessionId === id) chat.reset();
    await refreshSessions();
  };

  const handleSend = async (prompt: string) => {
    await chat.send(prompt, chat.sessionId);
    await refreshSessions();
  };

  return (
    <div className="app">
      <SessionSidebar
        sessions={sessions}
        activeId={chat.sessionId}
        onSelect={(id) => void selectSession(id)}
        onNew={() => void handleNew()}
        onDelete={(id) => void handleDelete(id)}
      />
      <main className="main">
        <header className="header">
          <strong>code-platform-demo</strong>
          {" · "}
          {health?.model ?? "…"}
          {" · "}
          工作区: {health?.workspaceRoot ?? "…"}
          {health && !health.hasApiKey && (
            <span style={{ color: "#f5a8a8" }}> · 未配置 API Key</span>
          )}
        </header>
        <Chat
          items={chat.items}
          isStreaming={chat.isStreaming}
          error={chat.error}
          onSend={(p) => void handleSend(p)}
          onStop={chat.stop}
        />
      </main>
    </div>
  );
}
