import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import type { AppBindings } from "../../lib/types";
import { requireAccessToken } from "../../middlewares/auth.middleware";
import { authProtectedErrorResponseSchema } from "../auth/auth.schema";
import {
  getMyApplicationDetailParamSchema,
  getMyApplicationsQuerySchema,
  myApplicationDetailResponseSchema,
  myApplicationsErrorResponseSchema,
  myApplicationsResponseSchema,
} from "./applications.schema";
import {
  handleGetMyApplicationDetail,
  handleGetMyApplications,
} from "./applications.service";

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

const getMyApplicationDetailRoute = createRoute({
  method: "get",
  path: "/{sourceType}/{applicationId}",
  tags: ["My Applications"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  request: {
    params: getMyApplicationDetailParamSchema,
  },
  responses: {
    200: {
      description: "Authenticated user's application detail",
      content: {
        "application/json": {
          schema: myApplicationDetailResponseSchema,
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
    404: {
      description: "Application not found",
      content: {
        "application/json": {
          schema: myApplicationsErrorResponseSchema,
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

myApplicationsRouter.openapi(getMyApplicationDetailRoute, async (c) => {
  const params = c.req.valid("param");
  return (await handleGetMyApplicationDetail(c, params)) as any;
});
