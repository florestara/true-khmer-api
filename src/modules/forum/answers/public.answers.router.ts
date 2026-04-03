import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import type { AppBindings } from "../../../lib/types";
import { handleGetAnswers } from "./answers.service";
import { getAnswersResponseSchema, questionIdParamsSchema } from "./answers.schema";

export const publicAnswersRouter = new OpenAPIHono<AppBindings>();

const getPublicAnswersRoute = createRoute({
    method: "get",
    path: "/get-answers/{questionId}",
    tags: ["Public", "Public Forum Answer"],
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

publicAnswersRouter.openapi(getPublicAnswersRoute, async (c) => {
    const params = c.req.valid("param");
    return handleGetAnswers(c, params, true) as any;
});
