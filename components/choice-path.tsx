"use client";

import { useEffect, useRef } from "react";
import type {
  SceneFrame,
  StoryState,
  TurnProposal,
} from "@/lib/domain";
import { MAX_STORY_ROUNDS } from "@/lib/domain";
import type { PendingAction } from "@/components/session";

export function ChoicePath({
  frame,
  storyState,
  proposal,
  pendingAction,
}: {
  frame: SceneFrame;
  storyState: StoryState;
  proposal?: TurnProposal;
  pendingAction?: PendingAction;
}) {
  const acceptedCount = storyState.acceptedRounds.length;
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentRound = acceptedCount + 1;
  const currentLabel = proposal ? "当前草案" : "等待选择";
  const currentAction = proposal ? pendingAction?.label ?? "当前行动" : "下一步尚未决定";
  const currentResult = proposal?.resultScene ?? frame.scene;

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
        <p>保留已接受行动及结果；当前草案只有接受后才会写入路线。</p>
      </div>
      <div className="choice-path-scroll" ref={scrollRef}>
        <div className="choice-path-flow">
          <article className="choice-path-root">
            <span>00</span>
            <strong>分歧点</strong>
            <p>新剧情线从这里开始</p>
          </article>
          <ol className="choice-path-list">
            {storyState.acceptedRounds.map((round) => (
              <li className="choice-path-node is-accepted" key={round.round}>
                <div className="choice-path-node-topline">
                  <span>{String(round.round).padStart(2, "0")}</span>
                  <em>已接受</em>
                </div>
                <strong>{round.action}</strong>
                <p>{round.scene}</p>
              </li>
            ))}
            {acceptedCount < MAX_STORY_ROUNDS ? (
              <li className={`choice-path-node is-current${proposal ? " has-proposal" : ""}`}>
                <div className="choice-path-node-topline">
                  <span>{String(currentRound).padStart(2, "0")}</span>
                  <em>{currentLabel}</em>
                </div>
                <strong>{currentAction}</strong>
                <p>{currentResult}</p>
              </li>
            ) : null}
          </ol>
        </div>
      </div>
    </section>
  );
}
