import { z } from "zod";

export const answerResponseSchema = z
  .object({
    id: z.string(),
    body: z.string(),
    authorId: z.string(),
    upvoteCount: z.number(),
    downvoteCount: z.number(),
    score: z.number(),
    viewerVote: z.enum(["UPVOTE", "DOWNVOTE"]).nullable(),
  })
  .openapi("AnswerResponse");

export const getAnswersResponseSchema = z
  .object({
    ok: z.boolean(),
    answers: z.array(answerResponseSchema),
  })
  .openapi("GetAnswersResponse");

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
