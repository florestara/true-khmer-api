import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import type { AppBindings } from "../../lib/types";
import { requireAccessToken } from "../../middlewares/auth.middleware";
import { authProtectedErrorResponseSchema } from "../auth/auth.schema";
import {
  getMyApplicationsQuerySchema,
  myApplicationsErrorResponseSchema,
  myApplicationsResponseSchema,
} from "./applications.schema";
import { handleGetMyApplications } from "./applications.service";

export const myApplicationsRouter = new OpenAPIHono<AppBindings>();

const getMyApplicationsRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["My Applications"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  request: {
    query: getMyApplicationsQuerySchema,
  },
  responses: {
    200: {
      description: "Authenticated user's volunteer applications and launchpad projects",
      content: {
        "application/json": {
          schema: myApplicationsResponseSchema,
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
          schema: myApplicationsErrorResponseSchema,
        },
      },
    },
  },
});

myApplicationsRouter.openapi(getMyApplicationsRoute, async (c) => {
  const query = c.req.valid("query");
  return (await handleGetMyApplications(c, query)) as any;
});
