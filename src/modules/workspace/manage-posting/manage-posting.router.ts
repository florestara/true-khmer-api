import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import type { AppBindings } from "../../../lib/types";
import { requireAccessToken } from "../../../middlewares/auth.middleware";
import { authProtectedErrorResponseSchema } from "../../auth/auth.schema";
import {
  getManagePostingsQuerySchema,
  managePostingsErrorResponseSchema,
  managePostingsResponseSchema,
} from "./manage-posting.schema";
import { handleGetManagePostings } from "./manage-posting.service";

export const managePostingRouter = new OpenAPIHono<AppBindings>();

const getManagePostingsRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Workspace"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  request: {
    query: getManagePostingsQuerySchema,
  },
  responses: {
    200: {
      description: "Authenticated user's volunteer and launchpad postings",
      content: {
        "application/json": {
          schema: managePostingsResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: authProtectedErrorResponseSchema,
        },
      },
    },
    403: {
      description: "Onboarding required",
      content: {
        "application/json": {
          schema: authProtectedErrorResponseSchema,
        },
      },
    },
    500: {
      description: "Internal server error",
      content: {
        "application/json": {
          schema: managePostingsErrorResponseSchema,
        },
      },
    },
  },
});

managePostingRouter.openapi(getManagePostingsRoute, async (c) => {
  const query = c.req.valid("query");
  return (await handleGetManagePostings(c, query)) as any;
});
