import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import type { AppBindings } from "../../lib/types";
import { requireAccessToken } from "../../middlewares/auth.middleware";
import { authProtectedErrorResponseSchema } from "../auth/auth.schema";
import {
  profileErrorResponseSchema,
  profileResponseSchema,
  updateProfileResponseSchema,
  updateProfileSchema,
} from "./profile.schema";
import { handleGetProfile, handleUpdateProfile } from "./profile.service";
import {
  getRecentActivitiesResponseSchema,
  recentActivityErrorResponseSchema,
} from "../recent-activity/recent-activity.schema";
import { handleGetRecentActivities } from "../recent-activity/recent-activity.service";

export const myspaceRouter = new OpenAPIHono<AppBindings>();

const getProfileRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["My Space"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: "Authenticated user's profile",
      content: {
        "application/json": {
          schema: profileResponseSchema,
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

const updateProfileRoute = createRoute({
  method: "patch",
  path: "/",
  tags: ["My Space"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: updateProfileSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Authenticated user's profile updated",
      content: {
        "application/json": {
          schema: updateProfileResponseSchema,
        },
      },
    },
    400: {
      description: "Validation failed",
      content: {
        "application/json": {
          schema: profileErrorResponseSchema,
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

const getRecentActivitiesRoute = createRoute({
  method: "get",
  path: "/recent-activity",
  tags: ["My Space"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: "Authenticated user's recent activity",
      content: {
        "application/json": {
          schema: getRecentActivitiesResponseSchema,
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
    500: {
      description: "Internal server error",
      content: {
        "application/json": {
          schema: recentActivityErrorResponseSchema,
        },
      },
    },
  },
});

myspaceRouter.openapi(getProfileRoute, async (c) => {
  return (await handleGetProfile(c)) as any;
});

myspaceRouter.openapi(updateProfileRoute, async (c) => {
  const payload = c.req.valid("json");
  return (await handleUpdateProfile(c, payload)) as any;
});

myspaceRouter.openapi(getRecentActivitiesRoute, async (c) => {
  return (await handleGetRecentActivities(c)) as any;
});
