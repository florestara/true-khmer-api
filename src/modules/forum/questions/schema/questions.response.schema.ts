import { z } from "zod";

export const questionResponseSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    body: z.string(),
    status: z.enum(["PUBLISHED", "CLOSED", "DELETED"]),
    upvoteCount: z.number().int().nonnegative(),
    downvoteCount: z.number().int().nonnegative(),
    answerCount: z.number().int().nonnegative(),
    score: z.number().int(),
    viewerVote: z.enum(["UPVOTE", "DOWNVOTE"]).nullable(),
    category: z.object({
      id: z.string(),
      name: z.string(),
    }),
    author: z.object({
      id: z.string(),
      name: z.string(),
      avatarKey: z.string().nullable(),
    }),
    tags: z.array(z.string()),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .openapi("QuestionResponse");

export const getQuestionsResponseSchema = z
  .object({
    ok: z.boolean(),
    questions: z.array(questionResponseSchema),
    pagination: z.object({
      limit: z.number(),
      hasMore: z.boolean(),
      nextCursor: z.string().nullable(),
    }),
  })
  .openapi("GetQuestionsResponse");

export const getQuestionResponseSchema = z
  .object({
    ok: z.boolean(),
    question: questionResponseSchema,
  })
  .openapi("GetQuestionResponse");

export const createQuestionResponseSchema = z
  .object({
    ok: z.boolean(),
    question: questionResponseSchema,
  })
  .openapi("CreateQuestionResponse");
