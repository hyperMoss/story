import {
  AnalysisResponseSchema,
  StartResponseSchema,
  StoryReviewSchema,
  TurnProposalSchema,
  type AnalyzeRequest,
  type ReviewRequest,
  type StartRequest,
  type TurnRequest,
} from "@/lib/domain";
import { requestStructured } from "@/lib/model-gateway";
import {
  ANALYZE_INSTRUCTION,
  REVIEW_INSTRUCTION,
  START_INSTRUCTION,
  TURN_INSTRUCTION,
} from "@/lib/prompts";

export function analyzeStory(input: AnalyzeRequest) {
  return requestStructured({
    task: "analyze",
    instruction: ANALYZE_INSTRUCTION,
    payload: input,
    schema: AnalysisResponseSchema,
  });
}

export function startStory(input: StartRequest) {
  return requestStructured({
    task: "start",
    instruction: START_INSTRUCTION,
    payload: input,
    schema: StartResponseSchema,
  });
}

export async function proposeTurn(input: TurnRequest) {
  const proposal = await requestStructured({
    task: "turn",
    instruction: TURN_INSTRUCTION,
    payload: input,
    schema: TurnProposalSchema,
  });

  return {
    ...proposal,
    nextState: {
      ...proposal.nextState,
      acceptedRounds: input.storyState.acceptedRounds,
    },
  };
}

export function reviewStory(input: ReviewRequest) {
  return requestStructured({
    task: "review",
    instruction: REVIEW_INSTRUCTION,
    payload: input,
    schema: StoryReviewSchema,
  });
}
