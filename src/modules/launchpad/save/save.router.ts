import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "../../../lib/types";
import { requireAccessToken } from "../../../middlewares/auth.middleware";
import { authProtectedErrorResponseSchema } from "../../auth/auth.schema";
import { launchpadOperationErrorResponseSchema, launchpadValidationErrorResponseSchema } from "../schema/launchpad.response.schema";
import {
  getSavedLaunchpadsQuerySchema,
  getLaunchpadParamsSchema,
} from "./schema/save.request.schema";
import {
  getSavedLaunchpadsResponseSchema,
  saveLaunchpadResponseSchema,
} from "./schema/save.response.schema";
import {
  handleGetSavedLaunchpads,
  handleSaveLaunchpad,
  handleUnsaveLaunchpad,
} from "./save.service";

export const saveRouter = new OpenAPIHono<AppBindings>();

export const getSavedLaunchpadsRoute = createRoute({
  method: "get",
  path: "/saved",
  tags: ["Launchpad Save"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  request: {
    query: getSavedLaunchpadsQuerySchema,
  },
  responses: {
    200: {
      description: "List of saved launchpads by the authenticated user",
      content: {
        "application/json": {
          schema: getSavedLaunchpadsResponseSchema,
        },
      },
    },
    400: {
      description: "Validation failed",
      content: {
        "application/json": {
          schema: launchpadValidationErrorResponseSchema,
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
      description: "Forbidden",
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
          schema: launchpadOperationErrorResponseSchema,
        },
      },
    },
  },
});

export const saveLaunchpadRoute = createRoute({
  method: "post",
  path: "/save/{launchpadId}",
  tags: ["Launchpad Save"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  request: {
    params: getLaunchpadParamsSchema,
  },
  responses: {
    200: {
      description: "Launchpad saved",
      content: {
        "application/json": {
          schema: saveLaunchpadResponseSchema,
        },
      },
    },
    400: {
      description: "Bad request",
      content: {
        "application/json": {
          schema: launchpadValidationErrorResponseSchema,
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
      description: "Forbidden",
      content: {
        "application/json": {
          schema: authProtectedErrorResponseSchema,
        },
      },
    },
    404: {
      description: "Launchpad not found",
      content: {
        "application/json": {
          schema: launchpadOperationErrorResponseSchema,
        },
      },
    },
    500: {
      description: "Internal server error",
      content: {
        "application/json": {
          schema: launchpadOperationErrorResponseSchema,
        },
      },
    },
  },
});

export const unsaveLaunchpadRoute = createRoute({
  method: "delete",
  path: "/save/{launchpadId}",
  tags: ["Launchpad Save"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  request: {
    params: getLaunchpadParamsSchema,
  },
  responses: {
    200: {
      description: "Launchpad unsaved",
      content: {
        "application/json": {
          schema: saveLaunchpadResponseSchema,
        },
      },
    },
    400: {
      description: "Bad request",
      content: {
        "application/json": {
          schema: launchpadValidationErrorResponseSchema,
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
      description: "Forbidden",
      content: {
        "application/json": {
          schema: authProtectedErrorResponseSchema,
        },
      },
    },
    404: {
      description: "Launchpad not found",
      content: {
        "application/json": {
          schema: launchpadOperationErrorResponseSchema,
        },
      },
    },
    500: {
      description: "Internal server error",
      content: {
        "application/json": {
          schema: launchpadOperationErrorResponseSchema,
        },
      },
    },
  },
});

saveRouter.openapi(getSavedLaunchpadsRoute, async (c) => {
  const query = c.req.valid("query");
  return handleGetSavedLaunchpads(c, query) as any;
});

saveRouter.openapi(saveLaunchpadRoute, async (c) => {
  const { launchpadId } = c.req.valid("param");
  return handleSaveLaunchpad(c, { launchpadId }) as any;
});

saveRouter.openapi(unsaveLaunchpadRoute, async (c) => {
  const { launchpadId } = c.req.valid("param");
  return handleUnsaveLaunchpad(c, { launchpadId }) as any;
});