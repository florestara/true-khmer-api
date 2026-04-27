import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import type { AppBindings } from "../../../lib/types";
import { handleGetAnswers } from "./answers.service";
import {
  getAnswersQuerySchema,
  getAnswersResponseSchema,
  questionIdParamsSchema,
} from "./answers.schema";

export const publicAnswersRouter = new OpenAPIHono<AppBindings>();

const getPublicAnswersRoute = createRoute({
  method: "get",
  path: "/get-answers/{questionId}",
  tags: ["Public", "Public Forum Answer"],
  security: [],
  request: {
    params: questionIdParamsSchema,
    query: getAnswersQuerySchema,
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

publicAnswersRouter.openapi(getPublicAnswersRoute, async (c) => {
  const params = c.req.valid("param");
  const query = c.req.valid("query");
  return handleGetAnswers(c, params, query, true) as any;
});
