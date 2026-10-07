import type {
  AnalysisResponse,
  DivergenceCandidate,
  SceneFrame,
  StartResponse,
  StoryReview,
  StoryState,
  StoryWorldCard,
  TurnProposal,
} from "@/lib/domain";
import {
  DEFAULT_STORY_ROUND_LIMIT,
  StoryRoundLimitSchema,
  type StoryRoundLimit,
} from "@/lib/domain";

export type AppStage = "import" | "world" | "play" | "review";

export type PendingAction = {
  label: string;
  intent: string;
};

export type LongSourceReference = {
  kind: "long-form";
  fileName: string;
  focusLabel: string;
  byteSize: number;
};

export type StorySession = {
  stage: AppStage;
  sourceText: string;
  roundLimit?: StoryRoundLimit;
  sourceReference?: LongSourceReference;
  analysis?: AnalysisResponse;
  worldCard?: StoryWorldCard;
  selectedDivergenceId?: string;
  divergence?: DivergenceCandidate;
  frame?: SceneFrame;
  storyState?: StoryState;
  pendingAction?: PendingAction;
  proposal?: TurnProposal;
  review?: StoryReview;
};

export const EMPTY_SESSION: StorySession = {
  stage: "import",
  sourceText: "",
  roundLimit: DEFAULT_STORY_ROUND_LIMIT,
};

export function isRestorableSession(value: unknown): value is StorySession {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StorySession>;
  const sourceReference = candidate.sourceReference;
  const validSourceReference =
    sourceReference === undefined ||
    (sourceReference.kind === "long-form" &&
      typeof sourceReference.fileName === "string" &&
      typeof sourceReference.focusLabel === "string" &&
      typeof sourceReference.byteSize === "number");
  const validRoundLimit =
    candidate.roundLimit === undefined ||
    StoryRoundLimitSchema.safeParse(candidate.roundLimit).success;
  return (
    ["import", "world", "play", "review"].includes(candidate.stage ?? "") &&
    typeof candidate.sourceText === "string" &&
    validSourceReference &&
    validRoundLimit
  );
}

export function sessionFromStart(
  previous: StorySession,
  divergence: DivergenceCandidate,
  response: StartResponse,
): StorySession {
  return {
    ...previous,
    stage: "play",
    divergence,
    frame: response.frame,
    storyState: response.storyState,
    proposal: undefined,
    pendingAction: undefined,
    review: undefined,
  };
}
