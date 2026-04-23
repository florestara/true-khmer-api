import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { AppBindings } from "../../lib/types";
import { requireAccessToken } from "../../middlewares/auth.middleware";
import {
  presignLaunchpadDocumentUploadSchema,
  presignLaunchpadImageUploadSchema,
} from "./schema/launchpad.request.schema";
import {
  launchpadOperationErrorResponseSchema,
  launchpadValidationErrorResponseSchema,
  presignLaunchpadCoverUploadResponseSchema,
  presignLaunchpadDocumentUploadResponseSchema,
  presignLaunchpadLogoUploadResponseSchema,
} from "./schema/launchpad.response.schema";
import { authProtectedErrorResponseSchema } from "../auth/auth.schema";
import {
  handlePresignLaunchpadCoverUpload,
  handlePresignLaunchpadDocumentUpload,
  handlePresignLaunchpadLogoUpload,
} from "./launchpad.service";

export const launchpadRouter = new OpenAPIHono<AppBindings>();

const presignlaunchpadLogoUploadRoute = createRoute({
  method: "post",
  path: "/logo/presign",
  tags: ["Launchpad"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: presignLaunchpadImageUploadSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Presigned launchpad logo upload URL generated",
      content: {
        "application/json": {
          schema: presignLaunchpadLogoUploadResponseSchema,
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

const presignlaunchpadCoverUploadRoute = createRoute({
  method: "post",
  path: "/cover/presign",
  tags: ["Launchpad"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: presignLaunchpadImageUploadSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Presigned launchpad cover upload URL generated",
      content: {
        "application/json": {
          schema: presignLaunchpadCoverUploadResponseSchema,
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

const presignlaunchpadDocumentUploadRoute = createRoute({
  method: "post",
  path: "/document/presign",
  tags: ["Launchpad"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: presignLaunchpadDocumentUploadSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Presigned launchpad document upload URL generated",
      content: {
        "application/json": {
          schema: presignLaunchpadDocumentUploadResponseSchema,
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

launchpadRouter.openapi(presignlaunchpadLogoUploadRoute, async (c) => {
  const data = c.req.valid("json");
  return handlePresignLaunchpadLogoUpload(c, data) as any;
});

launchpadRouter.openapi(presignlaunchpadCoverUploadRoute, async (c) => {
  const data = c.req.valid("json");
  return handlePresignLaunchpadCoverUpload(c, data) as any;
});

launchpadRouter.openapi(presignlaunchpadDocumentUploadRoute, async (c) => {
  const data = c.req.valid("json");
  return handlePresignLaunchpadDocumentUpload(c, data) as any;
});
