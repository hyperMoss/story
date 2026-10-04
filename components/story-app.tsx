"use client";

import { useEffect, useRef, useState } from "react";
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
  StoryWorldCard,
  TurnProposal,
} from "@/lib/domain";

const STORAGE_KEY = "crossroads-story-session-v1";

type ApiFailure = {
  error?: { message?: string };
};

function restoredSession() {
  if (typeof window === "undefined") return EMPTY_SESSION;
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (!saved) return EMPTY_SESSION;
  try {
    const parsed = JSON.parse(saved) as unknown;
    return isRestorableSession(parsed) ? parsed : EMPTY_SESSION;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return EMPTY_SESSION;
  }
}

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

function cleanLines(values: string[]) {
  return values.map((value) => value.trim()).filter(Boolean);
}

function cleanWorldCard(worldCard: StoryWorldCard): StoryWorldCard {
  return {
    ...worldCard,
    title: worldCard.title.trim(),
    characters: worldCard.characters.map((character) => ({
      ...character,
      name: character.name.trim(),
      identity: character.identity.trim(),
      goal: character.goal.trim(),
      relationships: cleanLines(character.relationships),
    })),
    rules: cleanLines(worldCard.rules),
    originalPlot: cleanLines(worldCard.originalPlot),
  };
}

export function StoryApp({ sampleStory }: { sampleStory: string }) {
  const [authorized, setAuthorized] = useState<boolean>();
  const [modelMode, setModelMode] = useState<"fake" | "live">("fake");
  const [session, setSession] = useState<StorySession>(restoredSession);
  const [loading, setLoading] = useState<string>();
  const [error, setError] = useState<string>();
  const taskVersion = useRef(0);

  useEffect(() => {
    void fetch("/api/session", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("无法确认访问状态");
        return response.json();
      })
      .then((access) => {
        setAuthorized(Boolean(access.authorized));
        setModelMode(access.modelMode === "live" ? "live" : "fake");
      })
      .catch(() => {
        setAuthorized(false);
      });
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }, [session]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [session.stage]);

  async function withTask(
    label: string,
    task: (isCurrent: () => boolean) => Promise<void>,
  ) {
    const version = ++taskVersion.current;
    const isCurrent = () => taskVersion.current === version;
    setLoading(label);
    setError(undefined);
    try {
      await task(isCurrent);
    } catch (taskError) {
      if (isCurrent()) {
        setError(taskError instanceof Error ? taskError.message : "操作失败，请重试。");
      }
    } finally {
      if (isCurrent()) setLoading(undefined);
    }
  }

  async function unlock(code: string) {
    await postJson<{ authorized: boolean }>("/api/access", { code });
    setAuthorized(true);
  }

  function readFile(file: File) {
    const version = ++taskVersion.current;
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
      .then((text) => {
        if (taskVersion.current === version) {
          setSession((current) => ({ ...current, sourceText: text }));
        }
      })
      .catch(() => {
        if (taskVersion.current === version) {
          setError("无法读取这个文件，请确认它是 UTF-8 文本。");
        }
      });
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
    void withTask("正在理解人物、规则与关键时刻…", async (isCurrent) => {
      const analysis = await postJson<AnalysisResponse>("/api/analyze", { sourceText });
      if (!isCurrent()) return;
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
    const worldCard = cleanWorldCard(session.worldCard);
    setSession((current) => ({ ...current, worldCard }));
    void withTask("正在打开分歧点…", async (isCurrent) => {
      const response = await postJson<StartResponse>("/api/start", {
        worldCard,
        divergence,
      });
      if (!isCurrent()) return;
      setSession((current) =>
        sessionFromStart({ ...current, worldCard }, divergence, response),
      );
    });
  }

  function propose(action: PendingAction) {
    if (!session.worldCard || !session.divergence || !session.storyState || !session.frame) return;
    void withTask("正在推演选择的后果…", async (isCurrent) => {
      const proposal = await postJson<TurnProposal>("/api/turn", {
        worldCard: session.worldCard,
        divergence: session.divergence,
        currentScene: session.frame?.scene,
        storyState: session.storyState,
        action,
      });
      if (!isCurrent()) return;
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
    void withTask("正在按修正意见重新推演…", async (isCurrent) => {
      const proposal = await postJson<TurnProposal>("/api/turn", {
        worldCard: session.worldCard,
        divergence: session.divergence,
        currentScene: session.frame?.scene,
        storyState: session.storyState,
        action: session.pendingAction,
        correction,
      });
      if (!isCurrent()) return;
      setSession((current) => ({ ...current, proposal }));
    });
  }

  async function requestReview(nextSession: StorySession, isCurrent: () => boolean) {
    if (!nextSession.worldCard || !nextSession.divergence || !nextSession.storyState) return;
    const review = await postJson<StoryReview>("/api/review", {
      worldCard: nextSession.worldCard,
      divergence: nextSession.divergence,
      storyState: nextSession.storyState,
    });
    if (isCurrent()) setSession({ ...nextSession, stage: "review", review });
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
      void withTask("正在整理新剧情线…", (isCurrent) =>
        requestReview(nextSession, isCurrent),
      );
    }
  }

  function finishReview() {
    void withTask("正在整理新剧情线…", (isCurrent) =>
      requestReview(session, isCurrent),
    );
  }

  function startOver() {
    if (
      session.sourceText &&
      !window.confirm("清除浏览器中的当前故事与推演记录，重新开始？")
    )
      return;
    taskVersion.current += 1;
    window.localStorage.removeItem(STORAGE_KEY);
    setSession(EMPTY_SESSION);
    setError(undefined);
    setLoading(undefined);
  }

  if (authorized === undefined) {
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
