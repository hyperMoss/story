import { ChangeEvent, useMemo, useState } from "react";
import { ErrorNotice, LoadingButton } from "@/components/stage-shell";
import {
  CONTEXT_NEIGHBOR_RADIUS,
  type LongStorySource,
} from "@/lib/long-source";

export function ImportStage({
  sourceText,
  loading,
  error,
  longSource,
  focusIndex,
  onSourceChange,
  onUseSample,
  onFile,
  onFocusChange,
  onClearLongSource,
  onAnalyze,
}: {
  sourceText: string;
  loading?: string;
  error?: string;
  longSource?: LongStorySource;
  focusIndex: number;
  onSourceChange: (value: string) => void;
  onUseSample: () => void;
  onFile: (file: File) => void;
  onFocusChange: (index: number) => void;
  onClearLongSource: () => void;
  onAnalyze: () => void;
}) {
  const [chapterQuery, setChapterQuery] = useState("");

  const visibleUnits = useMemo(() => {
    if (!longSource) return [];
    const indexedUnits = longSource.units.map((unit, index) => ({ unit, index }));
    const query = chapterQuery.trim().toLocaleLowerCase("zh-CN");
    if (!query) return indexedUnits;
    const matches = indexedUnits.filter(({ unit }) =>
      unit.label.toLocaleLowerCase("zh-CN").includes(query),
    );
    const selected = indexedUnits[focusIndex];
    return selected && !matches.some(({ index }) => index === focusIndex)
      ? [selected, ...matches]
      : matches;
  }, [chapterQuery, focusIndex, longSource]);

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
          放入短篇、章节或完整长篇。长篇会先在本地整理成章节导航，只有你选中的上下文包会交给 AI。
        </p>
        <div className="promise-list">
          <div>
            <strong>保留</strong>
            <span>人物逻辑与世界事实</span>
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
          <button
            className="sample-button"
            type="button"
            disabled={Boolean(loading)}
            onClick={onUseSample}
          >
            使用原创悬疑示例
          </button>
        </div>
        {longSource ? (
          <section className="long-source-panel" aria-label="长篇蓝本导航">
            <div className="long-source-heading">
              <div>
                <span className="panel-index">LONG-FORM BLUEPRINT</span>
                <h3>{longSource.fileName}</h3>
              </div>
              <button
                className="text-button"
                type="button"
                disabled={Boolean(loading)}
                onClick={onClearLongSource}
              >
                移除蓝本
              </button>
            </div>
            <div className="source-stats" aria-label="长篇蓝本信息">
              <span>{longSource.encoding}</span>
              <span>{longSource.charCount.toLocaleString()} 字符</span>
              <span>
                {longSource.structure === "chapters"
                  ? `${longSource.chapterCount.toLocaleString()} 章`
                  : `${longSource.units.length.toLocaleString()} 个片段`}
              </span>
              <span>{longSource.units.length.toLocaleString()} 个可选位置</span>
            </div>
            <label className="long-source-search">
              搜索章节标题
              <input
                type="search"
                value={chapterQuery}
                disabled={Boolean(loading)}
                placeholder="例如：山边小村"
                onChange={(event) => setChapterQuery(event.target.value)}
              />
            </label>
            <label className="long-source-select">
              焦点章节 / 片段
              <select
                aria-label="焦点章节"
                value={focusIndex}
                disabled={Boolean(loading)}
                onChange={(event) => onFocusChange(Number(event.target.value))}
              >
                {visibleUnits.length ? (
                  visibleUnits.map(({ unit, index }) => (
                    <option key={unit.id} value={index}>
                      {unit.label}
                    </option>
                  ))
                ) : (
                  <option value={focusIndex}>没有匹配章节</option>
                )}
              </select>
            </label>
            <p className="long-source-note">
              选择的是故事锚点，不是唯一发送内容。系统会在 12,000 字预算内自动带入焦点前后各最多
              {CONTEXT_NEIGHBOR_RADIUS} 个相邻片段；下方是实际发送给模型的内容，可继续编辑。
              整本原文只留在当前页面；刷新后如需原文证据，需要重新导入。
            </p>
          </section>
        ) : null}
        <textarea
          className={`story-input${longSource ? " is-context-package" : ""}`}
          value={sourceText}
          disabled={Boolean(loading)}
          onChange={(event) => onSourceChange(event.target.value)}
          placeholder="粘贴一篇短篇故事或一个章节，或者直接导入完整长篇……"
          aria-label="原始故事"
        />
        <div className="input-meta">
          <label className="file-button">
            <input
              type="file"
              accept=".txt,.md,text/plain,text/markdown"
              disabled={Boolean(loading)}
              onChange={chooseFile}
            />
            导入 .txt / .md
          </label>
          <span className={sourceText.length > 12000 ? "is-over" : ""}>
            {sourceText.length.toLocaleString()} / 12,000 字
          </span>
        </div>
        <div className="privacy-note">
          <span aria-hidden="true">◌</span>
          <p>
            {longSource
              ? "继续只会发送上方可见的上下文包；整本长篇不会上传或写入浏览器持久化存储。"
              : "继续即表示你知悉：上方原文会发送至配置的模型服务进行分析。本应用服务端不持久化保存内容。"}
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
