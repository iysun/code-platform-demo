import { useState } from "react";
import type { ChatItem } from "../hooks/useChatStream";

type Props = {
  items: ChatItem[];
  isStreaming: boolean;
  error: string | null;
  onSend: (prompt: string) => void;
  onStop: () => void;
};

export function Chat({ items, isStreaming, error, onSend, onStop }: Props) {
  const [input, setInput] = useState("");

  const submit = () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    onSend(text);
  };

  return (
    <>
      {error && <div className="error-banner">{error}</div>}
      <div className="chat">
        {items.length === 0 && (
          <p className="empty">
            发送消息开始对话。试试：列出项目结构并解释 src/utils.ts
          </p>
        )}
        {items.map((item, i) => {
          if (item.kind === "message") {
            return (
              <div
                key={item.message.id ?? i}
                className={`message ${item.message.role}`}
              >
                {item.message.content}
              </div>
            );
          }
          return (
            <details key={item.toolCallId} className="tool-block" open>
              <summary>
                {item.status === "running" ? "…" : "✓"} {item.toolName}
              </summary>
              <pre>{JSON.stringify(item.input, null, 2)}</pre>
              {item.summary && <pre>{item.summary}</pre>}
            </details>
          );
        })}
      </div>
      <div className="composer">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="输入问题…"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          disabled={isStreaming}
        />
        {isStreaming ? (
          <button type="button" className="btn" onClick={onStop}>
            停止
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={submit}>
            发送
          </button>
        )}
      </div>
    </>
  );
}
