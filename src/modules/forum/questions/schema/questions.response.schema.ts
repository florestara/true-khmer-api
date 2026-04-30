import { z } from "zod";

export const questionTagResponseSchema = z
  .object({
    id: z.string(),
    name: z.string(),
  })
  .openapi("QuestionTagResponse");

export const questionResponseSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    body: z.string(),
    status: z.enum(["PUBLISHED", "CLOSED", "DELETED"]),
    upvoteCount: z.number().int().nonnegative(),
    downvoteCount: z.number().int().nonnegative(),
    answerCount: z.number().int().nonnegative(),
    bestAnswerId: z.string().nullable(),
    bestAnswerSelectedAt: z.iso.datetime({ offset: true }).nullable(),
    score: z.number().int(),
    viewerVote: z.enum(["UPVOTE", "DOWNVOTE"]).nullable(),
    viewerSave: z.boolean(),
    category: z.object({
      id: z.string(),
      name: z.string(),
    }),
    author: z.object({
      id: z.string(),
      name: z.string(),
      avatarKey: z.string().nullable(),
    }),
    tags: z.array(questionTagResponseSchema),
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
      total: z.number().int().nonnegative(),
    }),
  })
  .openapi("GetQuestionsResponse");

export const getMyQuestionsResponseSchema = z
  .object({
    ok: z.boolean(),
    questions: z.array(questionResponseSchema),
  })
  .openapi("GetMyQuestionsResponse");

export const getSavedQuestionsResponseSchema = z
  .object({
    ok: z.boolean(),
    questions: z.array(questionResponseSchema),
    pagination: z.object({
      limit: z.number(),
      hasMore: z.boolean(),
      nextCursor: z.string().nullable(),
      total: z.number().int().nonnegative(),
    }),
  })
  .openapi("GetSavedQuestionsResponse");

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

export const saveQuestionResponseSchema = z
  .object({
    ok: z.literal(true),
  })
  .openapi("SaveQuestionResponse");

export const trendingTagResponseSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    count: z.number(),
  })
  .openapi("TrendingTagResponse");

export const getTrendingTagsResponseSchema = z
  .object({
    ok: z.boolean(),
    tags: z.array(trendingTagResponseSchema),
  })
  .openapi("GetTrendingTagsResponse");
