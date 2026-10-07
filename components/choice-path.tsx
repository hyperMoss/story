"use client";

import { useEffect, useRef, useState } from "react";
import type {
  SceneFrame,
  StoryRoundLimit,
  StoryState,
  TurnProposal,
} from "@/lib/domain";
import type { PendingAction } from "@/components/session";

export function ChoicePath({
  frame,
  storyState,
  roundLimit,
  proposal,
  pendingAction,
}: {
  frame: SceneFrame;
  storyState: StoryState;
  roundLimit: StoryRoundLimit;
  proposal?: TurnProposal;
  pendingAction?: PendingAction;
}) {
  const acceptedCount = storyState.acceptedRounds.length;
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentRound = acceptedCount + 1;
  const currentLabel = proposal ? "当前草案" : "等待选择";
  const currentAction = proposal ? pendingAction?.label ?? "当前行动" : "下一步尚未决定";
  const currentResult = proposal?.resultScene ?? frame.scene;
  const nodes = [
    ...storyState.acceptedRounds.map((round) => ({
      id: `round-${round.round}`,
      round: round.round,
      status: "已接受",
      detailLabel: "已接受结果",
      action: round.action,
      result: round.scene,
      accepted: true,
      proposal: false,
    })),
    ...(acceptedCount < roundLimit
      ? [
          {
            id: `round-${currentRound}`,
            round: currentRound,
            status: currentLabel,
            detailLabel: proposal ? "当前草案" : "当前场景",
            action: currentAction,
            result: currentResult,
            accepted: false,
            proposal: Boolean(proposal),
          },
        ]
      : []),
  ];
  const defaultNodeId = nodes.at(-1)?.id ?? "round-0";
  const [selectedNodeId, setSelectedNodeId] = useState(defaultNodeId);
  const [hoveredNodeId, setHoveredNodeId] = useState<string>();
  const activeNodeId = hoveredNodeId ?? selectedNodeId;
  const activeNode = nodes.find((node) => node.id === activeNodeId) ?? nodes.at(-1);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTo({ left: element.scrollWidth, behavior: "smooth" });
  }, [acceptedCount, proposal]);

  return (
    <section className="choice-path" aria-label="选择轨迹">
      <div className="choice-path-heading">
        <div>
          <span className="panel-index">CHOICE PATH</span>
          <h2>选择轨迹 · 当前路线</h2>
        </div>
        <p>节点仅展示路线摘要；悬停、聚焦或点击节点可查看完整行动与结果。</p>
      </div>
      <div className="choice-path-scroll" ref={scrollRef}>
        <div className="choice-path-flow">
          <div className="choice-path-root" aria-label="剧情分歧点">
            <span>00</span>
            <strong>分歧点</strong>
          </div>
          <ol className="choice-path-list">
            {nodes.map((node) => (
              <li
                className={`choice-path-node${node.accepted ? " is-accepted" : " is-current"}${node.proposal ? " has-proposal" : ""}${activeNode?.id === node.id ? " is-active" : ""}`}
                key={node.id}
              >
                <button
                  type="button"
                  className="choice-path-node-button"
                  aria-label={`查看第 ${node.round} 个选择详情`}
                  aria-pressed={selectedNodeId === node.id}
                  aria-describedby="choice-path-detail"
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId(undefined)}
                  onFocus={() => setHoveredNodeId(node.id)}
                  onBlur={() => setHoveredNodeId(undefined)}
                  onClick={() => setSelectedNodeId(node.id)}
                >
                  <span>{String(node.round).padStart(2, "0")}</span>
                  <em>{node.status}</em>
                  <strong>{node.action}</strong>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>
      {activeNode ? (
        <article
          id="choice-path-detail"
          className={`choice-path-detail${activeNode.proposal ? " has-proposal" : ""}`}
          aria-live="polite"
        >
          <div className="choice-path-detail-topline">
            <span>节点 {String(activeNode.round).padStart(2, "0")}</span>
            <em>{activeNode.detailLabel}</em>
          </div>
          <h3>{activeNode.action}</h3>
          <p>{activeNode.result}</p>
        </article>
      ) : null}
    </section>
  );
}
