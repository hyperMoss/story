import { FormEvent, useState } from "react";
import { ErrorNotice, LoadingButton } from "@/components/stage-shell";

export function AccessGate({
  onSubmit,
}: {
  onSubmit: (code: string) => Promise<void>;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await onSubmit(code);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "无法验证访问码。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="gate-shell">
      <div className="gate-glow" />
      <section className="gate-card">
        <span className="kicker">INTERACTIVE STORY LAB</span>
        <div className="gate-symbol" aria-hidden="true">
          Y
        </div>
        <h1>从那个没有发生的选择开始。</h1>
        <p>
          导入一段故事，在保留人物与世界事实的前提下，亲自走出另一条剧情线。
        </p>
        <form onSubmit={submit}>
          <label htmlFor="access-code">演示访问码</label>
          <div className="access-row">
            <input
              id="access-code"
              name="access-code"
              autoComplete="one-time-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="输入访问码"
              autoFocus
            />
            <LoadingButton className="primary-button" busy={busy} type="submit">
              进入岔路
            </LoadingButton>
          </div>
        </form>
        <ErrorNotice message={error} />
        <small>模型密钥不会发送到浏览器。</small>
      </section>
    </main>
  );
}
