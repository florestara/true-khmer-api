import { z } from "zod";
import { FORUM_UUID_RE } from "../../lib/constants";

const MAX_ANSWER_BODY_LENGTH = 10000;
const answerSortBySchema = z
  .enum(["popular", "newest", "oldest"])
  .openapi({
    description:
      "Answer ordering. Allowed values: popular, newest, oldest.",
    example: "popular",
  });

export type AnswerSortBy = z.infer<typeof answerSortBySchema>;

const answerBodySchema = z
  .string()
  .trim()
  .min(
    1,
    `body is required and must be 1..${MAX_ANSWER_BODY_LENGTH} characters`,
  )
  .max(
    MAX_ANSWER_BODY_LENGTH,
    `body is required and must be 1..${MAX_ANSWER_BODY_LENGTH} characters`,
  );

export const answerIdParamsSchema = z
  .object({
    answerId: z
      .string()
      .trim()
      .regex(FORUM_UUID_RE, "answerId must be a valid UUID"),
  })
  .openapi("AnswerIdParams");

export type AnswerIdParams = z.infer<typeof answerIdParamsSchema>;

export const questionIdParamsSchema = z
  .object({
    questionId: z
      .string()
      .trim()
      .regex(FORUM_UUID_RE, "questionId must be a valid UUID"),
  })
  .openapi("AnswerQuestionIdParams");

export type QuestionIdParams = z.infer<typeof questionIdParamsSchema>;

export const getAnswersQuerySchema = z
  .object({
    sortBy: answerSortBySchema.default("popular"),
  })
  .openapi("GetAnswersQuery");

export type GetAnswersQuery = z.infer<typeof getAnswersQuerySchema>;

export const createAnswerSchema = z
  .object({
    questionId: z
      .string()
      .trim()
      .regex(FORUM_UUID_RE, "questionId is required and must be a valid UUID"),
    replyToAnswer: z
      .string()
      .trim()
      .regex(FORUM_UUID_RE, "replyToAnswer must be a valid UUID")
      .nullable()
      .optional(),
    body: answerBodySchema,
  })
  .strict()
  .transform((value) => ({
    questionId: value.questionId,
    replyToAnswer: value.replyToAnswer ?? null,
    body: value.body,
  }))
  .openapi("CreateAnswerRequest");

export type CreateAnswerInput = z.infer<typeof createAnswerSchema>;

export const updateAnswerSchema = z
  .object({
    body: answerBodySchema,
  })
  .transform((value) => ({
    body: value.body,
  }))
  .openapi("UpdateAnswerRequest");

export type UpdateAnswerInput = z.infer<typeof updateAnswerSchema>;

const voteIntentSchema = z.enum(["UPVOTE", "DOWNVOTE", "NONE"]);

export type VoteIntent = z.infer<typeof voteIntentSchema>;
export type AnswerVoteType = Exclude<VoteIntent, "NONE">;

const normalizedVoteIntentSchema = z
  .string()
  .trim()
  .toUpperCase()
  .pipe(voteIntentSchema);

export const voteAnswerSchema = z
  .object({
    voteType: normalizedVoteIntentSchema,
  })
  .transform((value) => ({
    voteType: value.voteType,
  }))
  .openapi("VoteAnswerRequest");

export type VoteAnswerInput = z.infer<typeof voteAnswerSchema>;
