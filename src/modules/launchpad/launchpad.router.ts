import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { AppBindings } from "../../lib/types";
import {
  attachAuthIfValidAccessToken,
  requireAccessToken,
} from "../../middlewares/auth.middleware";
import {
  createLaunchpadRequestSchema,
  getLaunchpadQueryListSchema,
  getLaunchpadQuerySchema,
  presignLaunchpadDocumentUploadSchema,
  presignLaunchpadImageUploadSchema,
  updateLaunchpadRequestSchema,
} from "./schema/launchpad.request.schema";
import {
  createLaunchpadResponseSchema,
  getLaunchpadByIdResponseSchema,
  getLaunchpadsResponseSchema,
  launchpadOperationErrorResponseSchema,
  launchpadValidationErrorResponseSchema,
  presignLaunchpadCoverUploadResponseSchema,
  presignLaunchpadDocumentUploadResponseSchema,
  presignLaunchpadLogoUploadResponseSchema,
} from "./schema/launchpad.response.schema";
import { authProtectedErrorResponseSchema } from "../auth/auth.schema";
import {
  handleCreateLaunchpad,
  handleFindLaunchpadById,
  handleFindLaunchpads,
  handlePresignLaunchpadCoverUpload,
  handlePresignLaunchpadDocumentUpload,
  handlePresignLaunchpadLogoUpload,
  handleUpdateLaunchpad,
} from "./launchpad.service";
import { saveRouter } from "./save/save.router";

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

const createLaunchpadRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["Launchpad"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: createLaunchpadRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Launchpad created successfully",
      content: {
        "application/json": {
          schema: createLaunchpadResponseSchema,
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
    409: {
      description: "Launchpad with this name already exists",
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

const getLaunchpadByIdRoute = createRoute({
  method: "get",
  path: "/{launchpadId}",
  tags: ["Launchpad"],
  middleware: [attachAuthIfValidAccessToken],
  request: {
    params: getLaunchpadQuerySchema,
  },
  responses: {
    200: {
      description: "Launchpad found",
      content: {
        "application/json": {
          schema: getLaunchpadByIdResponseSchema,
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

const updateLaunchpadRoute = createRoute({
  method: "patch",
  path: "/{launchpadId}",
  tags: ["Launchpad"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  request: {
    params: getLaunchpadQuerySchema,
    body: {
      content: {
        "application/json": {
          schema: updateLaunchpadRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Launchpad updated",
      content: {
        "application/json": {
          schema: createLaunchpadResponseSchema,
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
    404: {
      description: "Launchpad or related record not found",
      content: {
        "application/json": {
          schema: launchpadOperationErrorResponseSchema,
        },
      },
    },
    409: {
      description: "Launchpad edit conflict",
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

const getLaunchpadsRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Launchpad"],
  middleware: [attachAuthIfValidAccessToken],
  request: {
    query: getLaunchpadQueryListSchema,
  },
  responses: {
    200: {
      description: "Launchpads found",
      content: {
        "application/json": {
          schema: getLaunchpadsResponseSchema,
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

launchpadRouter.route("/", saveRouter);

launchpadRouter.openapi(createLaunchpadRoute, async (c) => {
  const data = c.req.valid("json");
  return handleCreateLaunchpad(c, data) as any;
});

launchpadRouter.openapi(updateLaunchpadRoute, async (c) => {
  const params = c.req.valid("param");
  const data = c.req.valid("json");
  return handleUpdateLaunchpad(c, params, data) as any;
});

launchpadRouter.openapi(getLaunchpadByIdRoute, async (c) => {
  const { launchpadId } = c.req.valid("param");
  return handleFindLaunchpadById(c, { launchpadId }) as any;
});

launchpadRouter.openapi(getLaunchpadsRoute, async (c) => {
  const query = c.req.valid("query");
  return handleFindLaunchpads(c, query) as any;
});
