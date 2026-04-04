import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import type { AppBindings } from "../../../lib/types";
import {
  handleGetQuestion,
  handleGetQuestions,
  handleGetTrendingTags,
} from "./questions.service";
import {
  getQuestionsResponseSchema,
  getQuestionResponseSchema,
  getQuestionsQuerySchema,
  getQuestionParamsSchema,
  getTrendingTagsQuerySchema,
  getTrendingTagsResponseSchema,
} from "./questions.schema";

export const publicQuestionsRouter = new OpenAPIHono<AppBindings>();

const listPublicRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Public", "Public Forum Question"],
  security: [],
  request: {
    query: getQuestionsQuerySchema,
  },
  responses: {
    200: {
      description: "List of questions",
      content: {
        "application/json": {
          schema: getQuestionsResponseSchema,
        },
      },
    },
  },
});

const getPublicRoute = createRoute({
  method: "get",
  path: "/{questionId}",
  tags: ["Public", "Public Forum Question"],
  security: [],
  request: {
    params: getQuestionParamsSchema,
  },
  responses: {
    200: {
      description: "Question details",
      content: {
        "application/json": {
          schema: getQuestionResponseSchema,
        },
      },
    },
    404: { description: "Question not found" },
  },
});

const publicTrendingTagsRoute = createRoute({
  method: "get",
  path: "/trending-tags",
  tags: ["Public", "Public Forum Question"],
  security: [],
  request: {
    query: getTrendingTagsQuerySchema,
  },
  responses: {
    200: {
      description: "Trending tags",
      content: {
        "application/json": {
          schema: getTrendingTagsResponseSchema,
        },
      },
    },
    404: { description: "Category not found" },
  },
});

publicQuestionsRouter.openapi(listPublicRoute, async (c) => {
  const query = c.req.valid("query");
  return handleGetQuestions(c, query, true) as any;
});

publicQuestionsRouter.openapi(publicTrendingTagsRoute, async (c) => {
  const query = c.req.valid("query");
  return handleGetTrendingTags(c, query, true) as any;
});

publicQuestionsRouter.openapi(getPublicRoute, async (c) => {
  const params = c.req.valid("param");
  return handleGetQuestion(c, params, true) as any;
});