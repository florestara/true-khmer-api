import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppBindings } from "../../../lib/types";
import { requireAccessToken } from "../../../middlewares/auth.middleware";
import {
  handleCreateQuestion,
  handleGetQuestion,
  handleGetQuestions,
} from "./questions.service";
import {
  createQuestionResponseSchema,
  createQuestionSchema,
  getQuestionResponseSchema,
  getQuestionsResponseSchema,
  getQuestionsQuerySchema,
  getQuestionParamsSchema,
} from "./questions.schema";

export const questionsRouter = new OpenAPIHono<AppBindings>();

const listRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Forum Question"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
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

const getRoute = createRoute({
  method: "get",
  path: "/{questionId}",
  tags: ["Forum Question"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
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

const createQuestionRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["Forum Question"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: { "application/json": { schema: createQuestionSchema } },
    },
  },
  responses: {
    201: {
      description: "Question created",
      content: {
        "application/json": {
          schema: createQuestionResponseSchema,
        },
      },
    },
    400: { description: "Validation failed" },
    404: { description: "Category not found" },
  },
});

questionsRouter.openapi(listRoute, async (c) => {
  const query = c.req.valid("query");
  return (await handleGetQuestions(c, query)) as any;
});

questionsRouter.openapi(getRoute, async (c) => {
  const params = c.req.valid("param");
  return handleGetQuestion(c, params) as any;
});

questionsRouter.openapi(createQuestionRoute, async (c) => {
  const data = c.req.valid("json");
  return (await handleCreateQuestion(c, data)) as any;
});
