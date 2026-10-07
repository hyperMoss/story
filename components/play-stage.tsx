import { useMemo, useState } from "react";
import { ChoicePath } from "@/components/choice-path";
import type {
  SceneFrame,
  StoryRoundLimit,
  StoryState,
  TurnProposal,
} from "@/lib/domain";
import { MIN_REVIEW_ROUNDS } from "@/lib/domain";
import type { PendingAction } from "@/components/session";
import { ErrorNotice, LoadingButton } from "@/components/stage-shell";

const areaLabels = {
  goal: "目标",
  relationship: "关系",
  risk: "风险",
  conflict: "冲突",
  character: "人物",
};

export function PlayStage({
  frame,
  storyState,
  roundLimit,
  proposal,
  pendingAction,
  loading,
  error,
  onPropose,
  onRegenerate,
  onAccept,
  onFinishReview,
}: {
  frame: SceneFrame;
  storyState: StoryState;
  roundLimit: StoryRoundLimit;
  proposal?: TurnProposal;
  pendingAction?: PendingAction;
  loading?: string;
  error?: string;
  onPropose: (action: PendingAction) => void;
  onRegenerate: (correction: string) => void;
  onAccept: () => void;
  onFinishReview: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string>();
  const [customAction, setCustomAction] = useState("");
  const [correction, setCorrection] = useState("");
  const acceptedCount = storyState.acceptedRounds.length;

  const activeAction = useMemo(() => {
    if (selectedId === "custom") {
      const value = customAction.trim();
      return value ? { label: value, intent: "作者提出的自定义行动" } : undefined;
    }
    const selected = frame.suggestedActions.find((action) => action.id === selectedId);
    return selected ? { label: selected.label, intent: selected.intent } : undefined;
  }, [customAction, frame.suggestedActions, selectedId]);

  return (
    <section className="play-stage">
      <div className="play-header">
        <div>
          <span className="kicker">03 / 新剧情线</span>
          <h1>
            {acceptedCount >= roundLimit
              ? "当前阶段已经完成"
              : `第 ${acceptedCount + 1} 个选择`}
          </h1>
        </div>
        <div className="round-summary" aria-label={`已接受 ${acceptedCount} / ${roundLimit} 个回合`}>
          <strong>{String(acceptedCount).padStart(2, "0")}</strong>
          <span>/ {roundLimit} 已接受</span>
        </div>
      </div>

      <ChoicePath
        frame={frame}
        storyState={storyState}
        roundLimit={roundLimit}
        proposal={proposal}
        pendingAction={pendingAction}
      />

      <div className="play-layout">
        <div className="scene-column">
          <article className="scene-card">
            <div className="scene-topline">
              <span>
                SCENE {String(Math.min(acceptedCount + 1, roundLimit)).padStart(2, "0")}
              </span>
              <em>当前已接受剧情</em>
            </div>
            <p>{frame.scene}</p>
          </article>

          {proposal ? (
            <article className="proposal-card" data-testid="turn-proposal">
              <div className="proposal-heading">
                <span className="kicker">推演草案 · 尚未写入剧情</span>
                <h2>如果选择“{pendingAction?.label}”</h2>
              </div>
              <p className="proposal-scene">{proposal.resultScene}</p>
              <div className="proposal-columns">
                <div>
                  <h3>状态变化</h3>
                  <ul className="change-list">
                    {proposal.stateChanges.map((change, index) => (
                      <li key={`${change.area}-${index}`}>
                        <span>{areaLabels[change.area]}</span>
                        <p>{change.summary}</p>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3>推演依据</h3>
                  <ul className="rationale-list">
                    {proposal.rationale.map((reason, index) => (
                      <li key={`${reason}-${index}`}>{reason}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="proposal-actions">
                <div className="correction-box">
                  <label htmlFor="correction">不符合角色？留一句修正意见</label>
                  <input
                    id="correction"
                    value={correction}
                    onChange={(event) => setCorrection(event.target.value)}
                    placeholder="例如：他不会主动撒谎，请保持这个底线"
                    maxLength={300}
                  />
                  <LoadingButton
                    type="button"
                    className="secondary-button"
                    busy={Boolean(loading)}
                    disabled={!correction.trim()}
                    onClick={() => onRegenerate(correction.trim())}
                  >
                    {loading || "带修正重新推演"}
                  </LoadingButton>
                </div>
                <LoadingButton
                  type="button"
                  className="primary-button accept-button"
                  busy={Boolean(loading)}
                  onClick={onAccept}
                >
                  {loading ||
                    (acceptedCount + 1 === roundLimit
                      ? "接受，完成本阶段"
                      : "接受，进入下一幕")}
                </LoadingButton>
              </div>
              {acceptedCount >= MIN_REVIEW_ROUNDS ? (
                <LoadingButton
                  type="button"
                  className="secondary-button proposal-review-button"
                  busy={Boolean(loading)}
                  onClick={onFinishReview}
                >
                  {loading || "回顾已接受路线并生成结局"}
                </LoadingButton>
              ) : null}
            </article>
          ) : acceptedCount >= roundLimit ? (
            <div className="finalize-panel">
              <span className="kicker">{roundLimit} CHOICES COMPLETE</span>
              <h2>当前阶段已经走完。</h2>
              <p>{roundLimit} 个选择已经成为已接受事实。生成阶段回顾与路线结局，带走这次推演。</p>
              <ErrorNotice message={error} />
              <LoadingButton
                className="primary-button"
                busy={Boolean(loading)}
                onClick={onFinishReview}
              >
                {loading || "生成阶段回顾与结局"}
              </LoadingButton>
            </div>
          ) : (
            <div className="action-section">
              <div className="section-title-row">
                <span className="number-chip">?</span>
                <div>
                  <h2>{storyState.protagonistName}接下来怎么做？</h2>
                  <p>三个建议不是答案，也可以写下你自己的行动。</p>
                </div>
              </div>
              <div className="action-grid">
                {frame.suggestedActions.map((action, index) => (
                  <button
                    type="button"
                    key={action.id}
                    className={`action-card ${selectedId === action.id ? "is-selected" : ""}`}
                    onClick={() => setSelectedId(action.id)}
                  >
                    <span>0{index + 1}</span>
                    <strong>{action.label}</strong>
                    <em>{action.intent}</em>
                  </button>
                ))}
                <label className={`action-card custom-action ${selectedId === "custom" ? "is-selected" : ""}`}>
                  <span>04</span>
                  <strong>自定义行动</strong>
                  <textarea
                    value={customAction}
                    onFocus={() => setSelectedId("custom")}
                    onChange={(event) => {
                      setSelectedId("custom");
                      setCustomAction(event.target.value);
                    }}
                    placeholder="写下主角真正会做的事……"
                    maxLength={240}
                  />
                </label>
              </div>
              <ErrorNotice message={error} />
              <div className="play-action-buttons">
                <LoadingButton
                  type="button"
                  className="primary-button"
                  busy={Boolean(loading)}
                  disabled={!activeAction}
                  onClick={() => activeAction && onPropose(activeAction)}
                >
                  {loading || "推演这个选择"}
                </LoadingButton>
                {acceptedCount >= MIN_REVIEW_ROUNDS ? (
                  <LoadingButton
                    type="button"
                    className="secondary-button"
                    busy={Boolean(loading)}
                    onClick={onFinishReview}
                  >
                    {loading || "生成阶段回顾与结局"}
                  </LoadingButton>
                ) : null}
              </div>
            </div>
          )}
          {proposal ? <ErrorNotice message={error} /> : null}
        </div>

        <aside className="state-panel">
          <span className="panel-index">STORY STATE</span>
          <h2>当前剧情状态</h2>
          <section>
            <small>主角目标</small>
            <p>{storyState.protagonistGoal}</p>
          </section>
          <section>
            <small>当前处境</small>
            <p>{storyState.situation}</p>
          </section>
          <section>
            <small>人物关系</small>
            <ul>
              {storyState.relationships.map((relationship) => (
                <li key={relationship.between}>
                  <strong>{relationship.between}</strong>
                  <span>{relationship.status}</span>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <small>现有风险</small>
            <ul className="dot-list">
              {storyState.risks.map((risk) => (
                <li key={risk}>{risk}</li>
              ))}
            </ul>
          </section>
          <section>
            <small>未解决冲突</small>
            <ul className="dot-list">
              {storyState.unresolvedConflicts.map((conflict) => (
                <li key={conflict}>{conflict}</li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </section>
  );
}
