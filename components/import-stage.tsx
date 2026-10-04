import { ChangeEvent } from "react";
import { ErrorNotice, LoadingButton } from "@/components/stage-shell";

export function ImportStage({
  sourceText,
  loading,
  error,
  onSourceChange,
  onUseSample,
  onFile,
  onAnalyze,
}: {
  sourceText: string;
  loading?: string;
  error?: string;
  onSourceChange: (value: string) => void;
  onUseSample: () => void;
  onFile: (file: File) => void;
  onAnalyze: () => void;
}) {
  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) onFile(file);
    event.target.value = "";
  }

  return (
    <section className="stage-grid import-stage">
      <div className="stage-intro">
        <span className="kicker">01 / 原始故事</span>
        <h1>
          一段写完的故事，
          <br />
          也可能只是一个开始。
        </h1>
        <p>
          放入你的短篇或章节。AI 会先提炼人物、规则与关键事件，再把决定权交还给你。
        </p>
        <div className="promise-list">
          <div>
            <strong>保留</strong>
            <span>人物与世界事实</span>
          </div>
          <div>
            <strong>改变</strong>
            <span>分歧点之后的剧情</span>
          </div>
          <div>
            <strong>产出</strong>
            <span>可继续写作的新剧情线</span>
          </div>
        </div>
      </div>

      <div className="paper-panel">
        <div className="panel-heading">
          <div>
            <span className="panel-index">STORY INPUT</span>
            <h2>放入原始故事</h2>
          </div>
          <button className="sample-button" type="button" onClick={onUseSample}>
            使用原创悬疑示例
          </button>
        </div>
        <textarea
          className="story-input"
          value={sourceText}
          onChange={(event) => onSourceChange(event.target.value)}
          placeholder="粘贴一篇短篇故事或一个章节……"
          aria-label="原始故事"
        />
        <div className="input-meta">
          <label className="file-button">
            <input type="file" accept=".txt,.md,text/plain,text/markdown" onChange={chooseFile} />
            导入 .txt / .md
          </label>
          <span className={sourceText.length > 12000 ? "is-over" : ""}>
            {sourceText.length.toLocaleString()} / 12,000 字
          </span>
        </div>
        <div className="privacy-note">
          <span aria-hidden="true">◌</span>
          <p>
            继续即表示你知悉：原文会发送至配置的模型服务进行分析。本应用服务端不持久化保存内容。
          </p>
        </div>
        <ErrorNotice message={error} />
        <LoadingButton
          className="primary-button wide-button"
          type="button"
          busy={Boolean(loading)}
          onClick={onAnalyze}
        >
          {loading || "提炼故事世界"}
        </LoadingButton>
      </div>
    </section>
  );
}
