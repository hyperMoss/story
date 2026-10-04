import type { AppStage } from "@/components/session";

const stages: Array<{ id: AppStage; label: string; eyebrow: string }> = [
  { id: "import", label: "导入故事", eyebrow: "01" },
  { id: "world", label: "确认世界", eyebrow: "02" },
  { id: "play", label: "走入岔路", eyebrow: "03" },
  { id: "review", label: "带走结果", eyebrow: "04" },
];

export function StageShell({
  stage,
  modelMode,
  missingSourceFile,
  sourceLoading,
  children,
  onStartOver,
  onRestoreSource,
}: {
  stage: AppStage;
  modelMode: "fake" | "live";
  missingSourceFile?: string;
  sourceLoading?: boolean;
  children: React.ReactNode;
  onStartOver: () => void;
  onRestoreSource: (file: File) => void;
}) {
  const currentIndex = stages.findIndex((item) => item.id === stage);
  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#main" aria-label="岔路首页">
          <span className="brand-mark" aria-hidden="true">
            Y
          </span>
          <span>
            <strong>岔路</strong>
            <small>动态故事推演</small>
          </span>
        </a>
        <nav className="stage-nav" aria-label="创作进度">
          {stages.map((item, index) => (
            <div
              className={`stage-nav-item ${index === currentIndex ? "is-current" : ""} ${index < currentIndex ? "is-done" : ""}`}
              key={item.id}
              aria-current={index === currentIndex ? "step" : undefined}
            >
              <span>{item.eyebrow}</span>
              <em>{item.label}</em>
            </div>
          ))}
        </nav>
        <div className="topbar-actions">
          {modelMode === "fake" ? <span className="mode-badge">本地假模型</span> : null}
          <button className="text-button" type="button" onClick={onStartOver}>
            重新开始
          </button>
        </div>
      </header>
      {missingSourceFile ? (
        <aside className="source-evidence-banner" role="status">
          <div>
            <strong>原文证据需重新导入</strong>
            <p>
              已恢复世界卡与剧情状态，但“{missingSourceFile}”的全文索引不会持久化。重新选择原文件后，后续推演才会继续引用焦点之前的原文证据。
            </p>
          </div>
          <label className="secondary-button file-button">
            <input
              type="file"
              aria-label="重新载入长篇蓝本"
              accept=".txt,.md,text/plain,text/markdown"
              disabled={sourceLoading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onRestoreSource(file);
                event.target.value = "";
              }}
            />
            {sourceLoading ? "正在恢复原文…" : "重新载入原文件"}
          </label>
        </aside>
      ) : null}
      <div id="main" className="stage-container">
        {children}
      </div>
      <footer className="footer-note">
        原文仅发送至你配置的模型服务；本应用服务端不保存故事内容。
      </footer>
    </main>
  );
}

export function ErrorNotice({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="error-notice" role="alert">
      <span aria-hidden="true">!</span>
      <p>{message}</p>
    </div>
  );
}

export function LoadingButton({
  busy,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean }) {
  return (
    <button {...props} disabled={busy || props.disabled}>
      {busy ? <span className="spinner" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
