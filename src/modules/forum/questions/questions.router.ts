import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppBindings } from "../../../lib/types";
import { requireAccessToken } from "../../../middlewares/auth.middleware";
import {
  handleCreateQuestion,
  handleDeleteQuestion,
  handleEditQuestion,
  handleGetQuestion,
  handleGetMyQuestions,
  handleGetSavedQuestions,
  handleGetQuestions,
  handleSaveQuestion,
  handleGetTrendingTags,
  handlePresignForumQuestionImageUpload,
  handleUnsaveQuestion,
  handleVoteQuestion,
} from "./questions.service";
import {
  createQuestionResponseSchema,
  createQuestionSchema,
  getSavedQuestionsQuerySchema,
  getSavedQuestionsResponseSchema,
  getTrendingTagsQuerySchema,
  getTrendingTagsResponseSchema,
  editQuestionSchema,
  getQuestionResponseSchema,
  getMyQuestionsResponseSchema,
  getQuestionsResponseSchema,
  getQuestionsQuerySchema,
  getQuestionParamsSchema,
  saveQuestionResponseSchema,
  presignForumQuestionImageUploadResponseSchema,
  presignForumQuestionImageUploadSchema,
  voteQuestionSchema,
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

const getMyQuestionsRoute = createRoute({
  method: "get",
  path: "/my-questions",
  tags: ["Forum Question"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: "List of questions created by the authenticated user",
      content: {
        "application/json": {
          schema: getMyQuestionsResponseSchema,
        },
      },
    },
  },
});

const getSavedQuestionsRoute = createRoute({
  method: "get",
  path: "/saved",
  tags: ["Forum Question"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  request: {
    query: getSavedQuestionsQuerySchema,
  },
  responses: {
    200: {
      description: "List of questions saved by the authenticated user",
      content: {
        "application/json": {
          schema: getSavedQuestionsResponseSchema,
        },
      },
    },
  },
});

const trendingTagsRoute = createRoute({
  method: "get",
  path: "/trending-tags",
  tags: ["Forum Question"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
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

const presignForumQuestionImageUploadRoute = createRoute({
  method: "post",
  path: "/image/presign",
  tags: ["Forum Question"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": { schema: presignForumQuestionImageUploadSchema },
      },
    },
  },
  responses: {
    200: {
      description: "Presigned forum image upload URL generated",
      content: {
        "application/json": {
          schema: presignForumQuestionImageUploadResponseSchema,
        },
      },
    },
    400: { description: "Validation failed" },
  },
});

const editQuestionRoute = createRoute({
  method: "patch",
  path: "/edit-question/{questionId}",
  tags: ["Forum Question"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  request: {
    params: getQuestionParamsSchema,
    body: {
      content: { "application/json": { schema: editQuestionSchema } },
    },
  },
  responses: {
    200: {
      description: "Question updated",
      content: {
        "application/json": {
          schema: createQuestionResponseSchema,
        },
      },
    },
    404: { description: "Question not found" },
  },
});

const deleteQuestionRoute = createRoute({
  method: "delete",
  path: "/delete-question/{questionId}",
  tags: ["Forum Question"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  request: {
    params: getQuestionParamsSchema,
  },
  responses: {
    200: {
      description: "Question deleted",
      content: {
        "application/json": {
          schema: z.object({ ok: z.boolean() }),
        },
      },
    },
    404: { description: "Question not found" },
  },
});

const voteQuestionRoute = createRoute({
  method: "post",
  path: "/vote-question/{questionId}",
  tags: ["Forum Question"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  request: {
    params: getQuestionParamsSchema,
    body: {
      content: { "application/json": { schema: voteQuestionSchema } },
    },
  },
  responses: {
    200: {
      description: "Vote applied",
      content: {
        "application/json": {
          schema: createQuestionResponseSchema,
        },
      },
    },
    404: { description: "Question not found" },
  },
});

const saveQuestionRoute = createRoute({
  method: "post",
  path: "/save-question/{questionId}",
  tags: ["Forum Question"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  request: {
    params: getQuestionParamsSchema,
  },
  responses: {
    200: {
      description: "Question saved",
      content: {
        "application/json": {
          schema: saveQuestionResponseSchema,
        },
      },
    },
    404: { description: "Question not found" },
  },
});

const unsaveQuestionRoute = createRoute({
  method: "delete",
  path: "/save-question/{questionId}",
  tags: ["Forum Question"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  request: {
    params: getQuestionParamsSchema,
  },
  responses: {
    200: {
      description: "Question unsaved",
      content: {
        "application/json": {
          schema: saveQuestionResponseSchema,
        },
      },
    },
    404: { description: "Question not found" },
  },
});

questionsRouter.openapi(listRoute, async (c) => {
  const query = c.req.valid("query");
  return handleGetQuestions(c, query) as any;
});

questionsRouter.openapi(trendingTagsRoute, async (c) => {
  const query = c.req.valid("query");
  return handleGetTrendingTags(c, query) as any;
});

questionsRouter.openapi(getMyQuestionsRoute, async (c) => {
  return handleGetMyQuestions(c) as any;
});

questionsRouter.openapi(getSavedQuestionsRoute, async (c) => {
  const query = c.req.valid("query");
  return handleGetSavedQuestions(c, query) as any;
});

questionsRouter.openapi(getRoute, async (c) => {
  const params = c.req.valid("param");
  return handleGetQuestion(c, params) as any;
});

questionsRouter.openapi(createQuestionRoute, async (c) => {
  const data = c.req.valid("json");
  return handleCreateQuestion(c, data) as any;
});

questionsRouter.openapi(presignForumQuestionImageUploadRoute, async (c) => {
  const data = c.req.valid("json");
  return handlePresignForumQuestionImageUpload(c, data) as any;
});

questionsRouter.openapi(editQuestionRoute, async (c) => {
  const params = c.req.valid("param");
  const data = c.req.valid("json");
  return handleEditQuestion(c, params, data) as any;
});

questionsRouter.openapi(deleteQuestionRoute, async (c) => {
  const params = c.req.valid("param");
  return handleDeleteQuestion(c, params) as any;
});

questionsRouter.openapi(voteQuestionRoute, async (c) => {
  const params = c.req.valid("param");
  const data = c.req.valid("json");
  return handleVoteQuestion(c, params, data) as any;
});

questionsRouter.openapi(saveQuestionRoute, async (c) => {
  const params = c.req.valid("param");
  return handleSaveQuestion(c, params) as any;
});

questionsRouter.openapi(unsaveQuestionRoute, async (c) => {
  const params = c.req.valid("param");
  return handleUnsaveQuestion(c, params) as any;
});
