import {
  AnalysisResponseSchema,
  StartResponseSchema,
  StoryReviewContentSchema,
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
    schema: StoryReviewContentSchema,
  });

  const acceptedRounds = input.storyState.acceptedRounds;
  const coversAcceptedRoute =
    review.choices.length === acceptedRounds.length &&
    review.choices.every(
      (choice, index) => choice.round === acceptedRounds[index]?.round,
    ) &&
    review.ending.choicePayoffs.length === acceptedRounds.length &&
    review.ending.choicePayoffs.every(
      (payoff, index) => payoff.round === acceptedRounds[index]?.round,
    );

  if (!coversAcceptedRoute) {
    throw new ModelGatewayError(
      "模型返回的回顾或结局没有覆盖全部已接受选择，已阻止它写入剧情，请重试。",
      "invalid_model_response",
    );
  }

  const canonicalReview = {
    ...review,
    choices: review.choices.map((choice, index) => ({
      ...choice,
      action: acceptedRounds[index].action,
    })),
    ending: {
      ...review.ending,
      choicePayoffs: review.ending.choicePayoffs.map((payoff, index) => ({
        ...payoff,
        action: acceptedRounds[index].action,
      })),
    },
  };

  return {
    ...canonicalReview,
    markdown: [
      `# ${canonicalReview.title}`,
      "",
      "## 阶段剧情梗概",
      canonicalReview.synopsis,
      "",
      "## 关键选择",
      ...canonicalReview.choices.map(
        (choice) => `${choice.round}. **${choice.action}**：${choice.result}`,
      ),
      "",
      "## 按当前选择续写的故事结局",
      `### ${canonicalReview.ending.title}`,
      canonicalReview.ending.scene,
      "",
      "### 选择兑现",
      ...canonicalReview.ending.choicePayoffs.map(
        (payoff) => `${payoff.round}. **${payoff.action}**：${payoff.payoff}`,
      ),
      "",
      "## 与原始剧情线的差异",
      ...canonicalReview.differences.map((item) => `- ${item}`),
      "",
      "## 人物与关系变化",
      ...canonicalReview.characterChanges.map((item) => `- ${item}`),
      "",
      "## 仍未解决的冲突",
      ...(canonicalReview.unresolvedConflicts.length
        ? canonicalReview.unresolvedConflicts.map((item) => `- ${item}`)
        : ["- 暂无"]),
      "",
      "## 始终遵守的事实",
      ...canonicalReview.preservedFacts.map((item) => `- ${item}`),
    ].join("\n"),
  };
}
