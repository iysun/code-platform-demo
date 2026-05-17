import type { SessionSummary } from "../api/client";

type Props = {
  sessions: SessionSummary[];
  activeId?: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
};

export function SessionSidebar({
  sessions,
  activeId,
  onSelect,
  onNew,
  onDelete,
}: Props) {
  return (
    <aside className="sidebar">
      <h2>会话</h2>
      <button type="button" className="btn btn-primary" onClick={onNew}>
        新建对话
      </button>
      <div className="session-list">
        {sessions.map((s) => (
          <div key={s.id} style={{ display: "flex", gap: 4 }}>
            <button
              type="button"
              className={`session-item ${s.id === activeId ? "active" : ""}`}
              onClick={() => onSelect(s.id)}
              style={{ flex: 1 }}
            >
              {s.title}
              <span className="meta">
                {formatTime(s.updatedAt)}
              </span>
            </button>
            <button
              type="button"
              className="btn"
              title="删除"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(s.id);
              }}
              style={{ padding: "4px 8px" }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}

function formatTime(v: string | number): string {
  const d = new Date(v);
  return d.toLocaleString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
