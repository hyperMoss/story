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
import { ModelGatewayError } from "@/lib/model-gateway";
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

export async function reviewStory(input: ReviewRequest) {
  const review = await requestStructured({
    task: "review",
    instruction: REVIEW_INSTRUCTION,
    payload: input,
    schema: StoryReviewSchema,
  });

  const acceptedRounds = input.storyState.acceptedRounds;
  const coversAcceptedRoute =
    review.choices.length === acceptedRounds.length &&
    review.choices.every(
      (choice, index) => choice.round === acceptedRounds[index]?.round,
    );

  if (!coversAcceptedRoute) {
    throw new ModelGatewayError(
      "模型返回的回顾没有覆盖全部已接受选择，已阻止它写入剧情，请重试。",
      "invalid_model_response",
    );
  }

  return {
    ...review,
    choices: review.choices.map((choice, index) => ({
      ...choice,
      action: acceptedRounds[index].action,
    })),
  };
}
