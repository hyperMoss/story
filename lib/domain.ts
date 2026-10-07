import { z } from "zod";

export const MIN_REVIEW_ROUNDS = 4;
export const MAX_STORY_ROUNDS = 12;

const ShortText = z.string().trim().min(1).max(240);
const Paragraph = z.string().trim().min(1).max(2400);

export const CharacterSchema = z.object({
  name: z.string().trim().min(1).max(40),
  identity: ShortText,
  goal: ShortText,
  relationships: z.array(ShortText).max(8),
});

export const StoryWorldCardSchema = z.object({
  title: z.string().trim().min(1).max(80),
  characters: z.array(CharacterSchema).min(1).max(8),
  rules: z.array(ShortText).min(1).max(12),
  originalPlot: z.array(ShortText).min(1).max(12),
});

export const DivergenceCandidateSchema = z.object({
  id: z.string().trim().min(1).max(60),
  title: z.string().trim().min(1).max(80),
  moment: Paragraph,
  originalAction: ShortText,
  reason: Paragraph,
});

export const SuggestedActionSchema = z.object({
  id: z.string().trim().min(1).max(60),
  label: z.string().trim().min(1).max(120),
  intent: z.string().trim().min(1).max(240),
});

export const StateChangeSchema = z.object({
  area: z.enum(["goal", "relationship", "risk", "conflict", "character"]),
  summary: ShortText,
});

export const AcceptedRoundSchema = z.object({
  round: z.number().int().min(1).max(MAX_STORY_ROUNDS),
  action: z.string().trim().min(1).max(240),
  scene: Paragraph,
  stateChanges: z.array(StateChangeSchema).min(1).max(8),
});

export const StoryStateSchema = z.object({
  protagonistName: z.string().trim().min(1).max(40),
  protagonistGoal: ShortText,
  situation: Paragraph,
  characterStates: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(40),
        status: ShortText,
      }),
    )
    .min(1)
    .max(8),
  relationships: z
    .array(
      z.object({
        between: z.string().trim().min(1).max(100),
        status: ShortText,
      }),
    )
    .max(12),
  risks: z.array(ShortText).max(12),
  unresolvedConflicts: z.array(ShortText).max(12),
  acceptedRounds: z.array(AcceptedRoundSchema).max(MAX_STORY_ROUNDS),
});

export const AnalysisResponseSchema = z.object({
  worldCard: StoryWorldCardSchema,
  divergenceCandidates: z.array(DivergenceCandidateSchema).length(3),
});

export const SceneFrameSchema = z.object({
  scene: Paragraph,
  suggestedActions: z.array(SuggestedActionSchema).length(3),
});

export const StartResponseSchema = z.object({
  frame: SceneFrameSchema,
  storyState: StoryStateSchema,
});

export const TurnProposalSchema = z.object({
  resultScene: Paragraph,
  nextActions: z.array(SuggestedActionSchema).length(3),
  stateChanges: z.array(StateChangeSchema).min(1).max(8),
  rationale: z.array(ShortText).min(1).max(4),
  nextState: StoryStateSchema,
});

export const StoryReviewSchema = z.object({
  title: z.string().trim().min(1).max(100),
  synopsis: Paragraph,
  choices: z
    .array(
      z.object({
        round: z.number().int().min(1).max(MAX_STORY_ROUNDS),
        action: ShortText,
        result: ShortText,
      }),
    )
    .min(MIN_REVIEW_ROUNDS)
    .max(MAX_STORY_ROUNDS),
  differences: z.array(ShortText).min(1).max(8),
  characterChanges: z.array(ShortText).min(1).max(8),
  unresolvedConflicts: z.array(ShortText).max(8),
  preservedFacts: z.array(ShortText).min(1).max(8),
  markdown: z.string().trim().min(1).max(12000),
});

export const AnalyzeRequestSchema = z.object({
  sourceText: z.string().trim().min(400).max(12000),
});

export const SourceEvidenceSchema = z.object({
  label: z.string().trim().min(1).max(120),
  excerpt: z.string().trim().min(1).max(1800),
});

const SourceEvidenceListSchema = z.array(SourceEvidenceSchema).max(3).optional();

export const StartRequestSchema = z.object({
  worldCard: StoryWorldCardSchema,
  divergence: DivergenceCandidateSchema,
  sourceEvidence: SourceEvidenceListSchema,
});

export const TurnRequestSchema = z.object({
  worldCard: StoryWorldCardSchema,
  divergence: DivergenceCandidateSchema,
  currentScene: Paragraph,
  storyState: StoryStateSchema,
  action: z.object({
    label: z.string().trim().min(1).max(240),
    intent: z.string().trim().min(1).max(300),
  }),
  correction: z.string().trim().max(300).optional(),
  sourceEvidence: SourceEvidenceListSchema,
});

export const ReviewRequestSchema = z.object({
  worldCard: StoryWorldCardSchema,
  divergence: DivergenceCandidateSchema,
  storyState: StoryStateSchema.refine(
    (state) => state.acceptedRounds.length >= MIN_REVIEW_ROUNDS,
    `至少需要 ${MIN_REVIEW_ROUNDS} 个已接受回合才能生成阶段回顾`,
  ),
});

export type StoryWorldCard = z.infer<typeof StoryWorldCardSchema>;
export type DivergenceCandidate = z.infer<typeof DivergenceCandidateSchema>;
export type SuggestedAction = z.infer<typeof SuggestedActionSchema>;
export type StateChange = z.infer<typeof StateChangeSchema>;
export type AcceptedRound = z.infer<typeof AcceptedRoundSchema>;
export type StoryState = z.infer<typeof StoryStateSchema>;
export type AnalysisResponse = z.infer<typeof AnalysisResponseSchema>;
export type SceneFrame = z.infer<typeof SceneFrameSchema>;
export type StartResponse = z.infer<typeof StartResponseSchema>;
export type TurnProposal = z.infer<typeof TurnProposalSchema>;
export type StoryReview = z.infer<typeof StoryReviewSchema>;
export type SourceEvidence = z.infer<typeof SourceEvidenceSchema>;
export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;
export type StartRequest = z.infer<typeof StartRequestSchema>;
export type TurnRequest = z.infer<typeof TurnRequestSchema>;
export type ReviewRequest = z.infer<typeof ReviewRequestSchema>;
