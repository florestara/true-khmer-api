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

const answerQuestionResponseSchema = z
  .object({
    id: z.string(),
    categoryId: z.string(),
    title: z.string(),
    body: z.string(),
    status: z.enum(["PUBLISHED", "CLOSED", "DELETED"]),
    answerCount: z.number().int().nonnegative(),
    upvoteCount: z.number().int().nonnegative(),
    downvoteCount: z.number().int().nonnegative(),
    bestAnswerId: z.string().nullable(),
    bestAnswerSelectedAt: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi("AnswerQuestionResponse");

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

export const myAnswerResponseSchema = answerResponseSchema
  .omit({
    questionId: true,
  })
  .extend({
    question: answerQuestionResponseSchema,
  })
  .openapi("MyAnswerResponse");

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
    answers: z.array(myAnswerResponseSchema),
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
