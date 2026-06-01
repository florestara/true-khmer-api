import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import type { AppBindings } from "../../lib/types";
import { requireAccessToken } from "../../middlewares/auth.middleware";
import { authProtectedErrorResponseSchema } from "../auth/auth.schema";
import { handleGetPostedItems } from "./posted.service";
import {
  getMyPostedQuerySchema,
  getPublicProfileParamsSchema,
  profileErrorResponseSchema,
  publicProfileResponseSchema,
} from "./profile.schema";
import { handleGetPublicProfile } from "./profile.service";
import {
  getMyPostedResponseSchema,
  myPostedErrorResponseSchema,
} from "./schema/posted.schema";

export const publicProfileRouter = new OpenAPIHono<AppBindings>();

const getPublicProfileRoute = createRoute({
  method: "get",
  path: "/{userId}",
  tags: ["Profile"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  request: {
    params: getPublicProfileParamsSchema,
  },
  responses: {
    200: {
      description: "Public profile fields for the requested user",
      content: {
        "application/json": {
          schema: publicProfileResponseSchema,
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
      description: "Profile is private or onboarding is required",
      content: {
        "application/json": {
          schema: profileErrorResponseSchema,
        },
      },
    },
    404: {
      description: "User not found",
      content: {
        "application/json": {
          schema: profileErrorResponseSchema,
        },
      },
    },
    500: {
      description: "Internal server error",
      content: {
        "application/json": {
          schema: profileErrorResponseSchema,
        },
      },
    },
  },
});

const getMyPostedRoute = createRoute({
  method: "get",
  path: "/{userId}/posted",
  tags: ["Profile"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  request: {
    params: getPublicProfileParamsSchema,
    query: getMyPostedQuerySchema,
  },
  responses: {
    200: {
      description:
        "Cursor-paginated forum questions, volunteer opportunities, or projects posted by the requested user",
      content: {
        "application/json": {
          schema: getMyPostedResponseSchema,
        },
      },
    },
    400: {
      description: "Validation failed",
      content: {
        "application/json": {
          schema: myPostedErrorResponseSchema,
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
      description: "Contributions are private or onboarding is required",
      content: {
        "application/json": {
          schema: myPostedErrorResponseSchema,
        },
      },
    },
    404: {
      description: "User not found",
      content: {
        "application/json": {
          schema: myPostedErrorResponseSchema,
        },
      },
    },
    500: {
      description: "Internal server error",
      content: {
        "application/json": {
          schema: myPostedErrorResponseSchema,
        },
      },
    },
  },
});

publicProfileRouter.openapi(getPublicProfileRoute, async (c) => {
  const params = c.req.valid("param");
  return (await handleGetPublicProfile(c, params)) as any;
});

publicProfileRouter.openapi(getMyPostedRoute, async (c) => {
  const params = c.req.valid("param");
  const query = c.req.valid("query");
  return (await handleGetPostedItems(c, params, query)) as any;
});
