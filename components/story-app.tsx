"use client";

import { useEffect, useState } from "react";
import { AccessGate } from "@/components/access-gate";
import { ImportStage } from "@/components/import-stage";
import { PlayStage } from "@/components/play-stage";
import { ReviewStage } from "@/components/review-stage";
import {
  EMPTY_SESSION,
  isRestorableSession,
  sessionFromStart,
  type PendingAction,
  type StorySession,
} from "@/components/session";
import { StageShell } from "@/components/stage-shell";
import { WorldStage } from "@/components/world-stage";
import type {
  AcceptedRound,
  AnalysisResponse,
  StartResponse,
  StoryReview,
  TurnProposal,
} from "@/lib/domain";

const STORAGE_KEY = "crossroads-story-session-v1";

type ApiFailure = {
  error?: { message?: string };
};

async function postJson<T>(url: string, payload: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await response.json().catch(() => ({}))) as T & ApiFailure;
  if (!response.ok) {
    throw new Error(body.error?.message || "请求失败，请重试。");
  }
  return body;
}

export function StoryApp({ sampleStory }: { sampleStory: string }) {
  const [authorized, setAuthorized] = useState<boolean>();
  const [modelMode, setModelMode] = useState<"fake" | "live">("fake");
  const [session, setSession] = useState<StorySession>(EMPTY_SESSION);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    Promise.all([
      fetch("/api/session", { cache: "no-store" }).then((response) => response.json()),
      Promise.resolve(window.localStorage.getItem(STORAGE_KEY)),
    ])
      .then(([access, saved]) => {
        setAuthorized(Boolean(access.authorized));
        setModelMode(access.modelMode === "live" ? "live" : "fake");
        if (saved) {
          try {
            const parsed = JSON.parse(saved) as unknown;
            if (isRestorableSession(parsed)) setSession(parsed);
          } catch {
            window.localStorage.removeItem(STORAGE_KEY);
          }
        }
      })
      .catch(() => {
        setAuthorized(false);
      })
      .finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }, [hydrated, session]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [session.stage]);

  async function withTask(label: string, task: () => Promise<void>) {
    setLoading(label);
    setError(undefined);
    try {
      await task();
    } catch (taskError) {
      setError(taskError instanceof Error ? taskError.message : "操作失败，请重试。");
    } finally {
      setLoading(undefined);
    }
  }

  async function unlock(code: string) {
    await postJson<{ authorized: boolean }>("/api/access", { code });
    setAuthorized(true);
  }

  function readFile(file: File) {
    setError(undefined);
    const extension = file.name.toLowerCase().split(".").pop();
    if (!extension || !["txt", "md"].includes(extension)) {
      setError("首版只支持 UTF-8 编码的 .txt 和 .md 文件。");
      return;
    }
    if (file.size > 100_000) {
      setError("文件过大，请保留一个章节或短篇后再导入。");
      return;
    }
    file
      .text()
      .then((text) => setSession((current) => ({ ...current, sourceText: text })))
      .catch(() => setError("无法读取这个文件，请确认它是 UTF-8 文本。"));
  }

  function analyze() {
    const sourceText = session.sourceText.trim();
    if (sourceText.length < 400) {
      setError("故事至少需要 400 个字，才能识别人物、规则和分歧点。");
      return;
    }
    if (sourceText.length > 12000) {
      setError("故事超过 12,000 字，请先保留一个短篇或章节。");
      return;
    }
    void withTask("正在理解人物、规则与关键时刻…", async () => {
      const analysis = await postJson<AnalysisResponse>("/api/analyze", { sourceText });
      setSession((current) => ({
        ...current,
        stage: "world",
        sourceText,
        analysis,
        worldCard: analysis.worldCard,
        selectedDivergenceId: undefined,
      }));
    });
  }

  function startStory() {
    if (!session.worldCard || !session.analysis || !session.selectedDivergenceId) return;
    const divergence = session.analysis.divergenceCandidates.find(
      (candidate) => candidate.id === session.selectedDivergenceId,
    );
    if (!divergence) return;
    void withTask("正在打开分歧点…", async () => {
      const response = await postJson<StartResponse>("/api/start", {
        worldCard: session.worldCard,
        divergence,
      });
      setSession((current) => sessionFromStart(current, divergence, response));
    });
  }

  function propose(action: PendingAction) {
    if (!session.worldCard || !session.divergence || !session.storyState || !session.frame) return;
    void withTask("正在推演选择的后果…", async () => {
      const proposal = await postJson<TurnProposal>("/api/turn", {
        worldCard: session.worldCard,
        divergence: session.divergence,
        currentScene: session.frame?.scene,
        storyState: session.storyState,
        action,
      });
      setSession((current) => ({ ...current, pendingAction: action, proposal }));
    });
  }

  function regenerate(correction: string) {
    if (
      !session.worldCard ||
      !session.divergence ||
      !session.storyState ||
      !session.frame ||
      !session.pendingAction
    )
      return;
    void withTask("正在按修正意见重新推演…", async () => {
      const proposal = await postJson<TurnProposal>("/api/turn", {
        worldCard: session.worldCard,
        divergence: session.divergence,
        currentScene: session.frame?.scene,
        storyState: session.storyState,
        action: session.pendingAction,
        correction,
      });
      setSession((current) => ({ ...current, proposal }));
    });
  }

  async function requestReview(nextSession: StorySession) {
    if (!nextSession.worldCard || !nextSession.divergence || !nextSession.storyState) return;
    const review = await postJson<StoryReview>("/api/review", {
      worldCard: nextSession.worldCard,
      divergence: nextSession.divergence,
      storyState: nextSession.storyState,
    });
    setSession({ ...nextSession, stage: "review", review });
  }

  function acceptProposal() {
    if (!session.proposal || !session.storyState || !session.pendingAction || !session.frame) return;
    const roundNumber = session.storyState.acceptedRounds.length + 1;
    const acceptedRound: AcceptedRound = {
      round: roundNumber,
      action: session.pendingAction.label,
      scene: session.proposal.resultScene,
      stateChanges: session.proposal.stateChanges,
    };
    const nextState = {
      ...session.proposal.nextState,
      acceptedRounds: [...session.storyState.acceptedRounds, acceptedRound],
    };
    const nextSession: StorySession = {
      ...session,
      frame: {
        scene: session.proposal.resultScene,
        suggestedActions: session.proposal.nextActions,
      },
      storyState: nextState,
      pendingAction: undefined,
      proposal: undefined,
    };
    setSession(nextSession);
    if (roundNumber === 4) {
      void withTask("正在整理新剧情线…", () => requestReview(nextSession));
    }
  }

  function finishReview() {
    void withTask("正在整理新剧情线…", () => requestReview(session));
  }

  function startOver() {
    if (
      session.sourceText &&
      !window.confirm("清除浏览器中的当前故事与推演记录，重新开始？")
    )
      return;
    window.localStorage.removeItem(STORAGE_KEY);
    setSession(EMPTY_SESSION);
    setError(undefined);
  }

  if (!hydrated || authorized === undefined) {
    return (
      <main className="boot-screen" aria-label="正在加载岔路">
        <span className="brand-mark">Y</span>
        <div className="spinner" />
      </main>
    );
  }

  if (!authorized) return <AccessGate onSubmit={unlock} />;

  return (
    <StageShell stage={session.stage} modelMode={modelMode} onStartOver={startOver}>
      {session.stage === "import" ? (
        <ImportStage
          sourceText={session.sourceText}
          loading={loading}
          error={error}
          onSourceChange={(sourceText) => {
            setSession((current) => ({ ...current, sourceText }));
            setError(undefined);
          }}
          onUseSample={() => {
            setSession((current) => ({ ...current, sourceText: sampleStory }));
            setError(undefined);
          }}
          onFile={readFile}
          onAnalyze={analyze}
        />
      ) : null}

      {session.stage === "world" && session.analysis && session.worldCard ? (
        <WorldStage
          worldCard={session.worldCard}
          candidates={session.analysis.divergenceCandidates}
          selectedId={session.selectedDivergenceId}
          loading={loading}
          error={error}
          onWorldCardChange={(worldCard) =>
            setSession((current) => ({ ...current, worldCard }))
          }
          onSelect={(selectedDivergenceId) =>
            setSession((current) => ({ ...current, selectedDivergenceId }))
          }
          onStart={startStory}
          onBack={() => setSession((current) => ({ ...current, stage: "import" }))}
        />
      ) : null}

      {session.stage === "play" && session.frame && session.storyState ? (
        <PlayStage
          key={session.storyState.acceptedRounds.length}
          frame={session.frame}
          storyState={session.storyState}
          proposal={session.proposal}
          pendingAction={session.pendingAction}
          loading={loading}
          error={error}
          onPropose={propose}
          onRegenerate={regenerate}
          onAccept={acceptProposal}
          onFinishReview={finishReview}
        />
      ) : null}

      {session.stage === "review" && session.review ? (
        <ReviewStage review={session.review} onStartOver={startOver} />
      ) : null}
    </StageShell>
  );
}
