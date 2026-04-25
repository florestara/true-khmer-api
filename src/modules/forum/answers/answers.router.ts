import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import type { AppBindings } from "../../../lib/types";
import { requireAccessToken } from "../../../middlewares/auth.middleware";
import {
  handleCreateAnswer,
  handleDeleteAnswer,
  handleEditAnswer,
  handleGetAnswers,
  handleGetMyAnswers,
  handleMarkBestAnswer,
  handleVoteAnswer,
} from "./answers.service";
import {
  answerErrorResponseSchema,
  answerIdParamsSchema,
  createAnswerResponseSchema,
  createAnswerSchema,
  deleteAnswerResponseSchema,
  editAnswerResponseSchema,
  getAnswersResponseSchema,
  markBestAnswerResponseSchema,
  questionIdParamsSchema,
  updateAnswerSchema,
  voteAnswerResponseSchema,
  voteAnswerSchema,
} from "./answers.schema";

export const answersRouter = new OpenAPIHono<AppBindings>();

const getAnswersRoute = createRoute({
  method: "get",
  path: "/get-answers/{questionId}",
  tags: ["Forum Answer"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  request: {
    params: questionIdParamsSchema,
  },
  responses: {
    200: {
      description: "List of answers for a question",
      content: {
        "application/json": {
          schema: getAnswersResponseSchema,
        },
      },
    },
  },
});

const getMyAnswersRoute = createRoute({
  method: "get",
  path: "/my-answers",
  tags: ["Forum Answer"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: "List of answers created by the authenticated user",
      content: {
        "application/json": {
          schema: getAnswersResponseSchema,
        },
      },
    },
  },
});

const createAnswerRoute = createRoute({
  method: "post",
  path: "/create-answer",
  tags: ["Forum Answer"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: { "application/json": { schema: createAnswerSchema } },
    },
  },
  responses: {
    201: {
      description: "Answer created",
      content: {
        "application/json": {
          schema: createAnswerResponseSchema,
        },
      },
    },
  },
});

const editAnswerRoute = createRoute({
  method: "patch",
  path: "/edit-answer/{answerId}",
  tags: ["Forum Answer"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  request: {
    params: answerIdParamsSchema,
    body: {
      content: { "application/json": { schema: updateAnswerSchema } },
    },
  },
  responses: {
    200: {
      description: "Answer updated",
      content: {
        "application/json": {
          schema: editAnswerResponseSchema,
        },
      },
    },
    403: {
      description: "Not authorized",
      content: {
        "application/json": {
          schema: answerErrorResponseSchema,
        },
      },
    },
  },
});

const deleteAnswerRoute = createRoute({
  method: "delete",
  path: "/delete-answer/{answerId}",
  tags: ["Forum Answer"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  request: {
    params: answerIdParamsSchema,
  },
  responses: {
    200: {
      description: "Answer deleted",
      content: {
        "application/json": {
          schema: deleteAnswerResponseSchema,
        },
      },
    },
    403: {
      description: "Not authorized",
      content: {
        "application/json": {
          schema: answerErrorResponseSchema,
        },
      },
    },
  },
});

const voteAnswerRoute = createRoute({
  method: "post",
  path: "/vote-answer/{answerId}",
  tags: ["Forum Answer"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  request: {
    params: answerIdParamsSchema,
    body: {
      content: { "application/json": { schema: voteAnswerSchema } },
    },
  },
  responses: {
    200: {
      description: "Vote recorded",
      content: {
        "application/json": {
          schema: voteAnswerResponseSchema,
        },
      },
    },
  },
});

const markBestAnswerRoute = createRoute({
  method: "post",
  path: "/mark-best-answer/{answerId}",
  tags: ["Forum Answer"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  request: {
    params: answerIdParamsSchema,
  },
  responses: {
    200: {
      description: "Best answer marked",
      content: {
        "application/json": {
          schema: markBestAnswerResponseSchema,
        },
      },
    },
    403: {
      description: "Not authorized",
      content: {
        "application/json": {
          schema: answerErrorResponseSchema,
        },
      },
    },
  },
});

answersRouter.openapi(getAnswersRoute, async (c) => {
  const params = c.req.valid("param");
  return handleGetAnswers(c, params) as any;
});

answersRouter.openapi(getMyAnswersRoute, async (c) => {
  return handleGetMyAnswers(c) as any;
});

answersRouter.openapi(createAnswerRoute, async (c) => {
  const data = c.req.valid("json");
  return handleCreateAnswer(c, data) as any;
});

answersRouter.openapi(editAnswerRoute, async (c) => {
  const params = c.req.valid("param");
  const data = c.req.valid("json");
  return handleEditAnswer(c, params, data) as any;
});

answersRouter.openapi(deleteAnswerRoute, async (c) => {
  const params = c.req.valid("param");
  return handleDeleteAnswer(c, params) as any;
});

answersRouter.openapi(voteAnswerRoute, async (c) => {
  const params = c.req.valid("param");
  const data = c.req.valid("json");
  return handleVoteAnswer(c, params, data) as any;
});

answersRouter.openapi(markBestAnswerRoute, async (c) => {
  const params = c.req.valid("param");
  return handleMarkBestAnswer(c, params) as any;
});
