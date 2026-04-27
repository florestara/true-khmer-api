import { z } from "zod";

const answerAuthorSchema = z.object({
  id: z.string(),
  name: z.string(),
  avatarKey: z.string().nullable(),
});

const repliedAnswerSchema = z
  .object({
    id: z.string(),
    body: z.string(),
    author: answerAuthorSchema,
    upvoteCount: z.number(),
    downvoteCount: z.number(),
    replyCount: z.number(),
    score: z.number(),
    viewerVote: z.enum(["UPVOTE", "DOWNVOTE"]).nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
    questionId: z.string(),
    status: z.literal("PUBLISHED"),
    replyTo: z.string().nullable(),
  })
  .openapi("RepliedAnswerResponse");

export const answerResponseSchema = z
  .object({
    id: z.string(),
    body: z.string(),
    author: answerAuthorSchema,
    upvoteCount: z.number(),
    downvoteCount: z.number(),
    replyCount: z.number(),
    score: z.number(),
    viewerVote: z.enum(["UPVOTE", "DOWNVOTE"]).nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
    questionId: z.string(),
    status: z.literal("PUBLISHED"),
    replyTo: z.string().nullable(),
    repliedAnswers: z.array(repliedAnswerSchema).nullable(),
  })
  .openapi("AnswerResponse");

export const getAnswersResponseSchema = z
  .object({
    ok: z.boolean(),
    answers: z.object({
      bestAnswer: z.array(answerResponseSchema),
      answers: z.array(answerResponseSchema),
    }),
  })
  .openapi("GetAnswersResponse");

export const getMyAnswersResponseSchema = z
  .object({
    ok: z.boolean(),
    answers: z.array(answerResponseSchema),
  })
  .openapi("GetMyAnswersResponse");

export const createAnswerResponseSchema = z
  .object({
    ok: z.boolean(),
    answer: answerResponseSchema,
  })
  .openapi("CreateAnswerResponse");

export const voteAnswerResponseSchema = z
  .object({
    ok: z.boolean(),
    answer: answerResponseSchema,
  })
  .openapi("VoteAnswerResponse");

export const markBestAnswerResponseSchema = z
  .object({
    ok: z.boolean(),
    answer: answerResponseSchema,
  })
  .openapi("MarkBestAnswerResponse");

export const editAnswerResponseSchema = z
  .object({
    ok: z.boolean(),
    answer: answerResponseSchema,
  })
  .openapi("EditAnswerResponse");

export const deleteAnswerResponseSchema = z
  .object({
    ok: z.boolean(),
  })
  .openapi("DeleteAnswerResponse");

export const answerErrorResponseSchema = z
  .object({
    ok: z.literal(false),
    error: z.string(),
  })
  .openapi("AnswerErrorResponse");
