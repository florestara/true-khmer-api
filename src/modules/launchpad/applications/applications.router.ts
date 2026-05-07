import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "../../../lib/types";
import { requireAccessToken } from "../../../middlewares/auth.middleware";
import { authProtectedErrorResponseSchema } from "../../auth/auth.schema";
import {
  createLaunchpadApplicationSchema,
  launchpadApplicationByIdParamSchema,
  launchpadApplicationParamSchema,
  presignLaunchpadApplicationDocumentUploadSchema,
} from "./schema/applications.request.schema";
import {
  createLaunchpadApplicationResponseSchema,
  getLaunchpadApplicationResponseSchema,
  launchpadApplicationOperationErrorResponseSchema,
  launchpadApplicationValidationErrorResponseSchema,
  presignLaunchpadApplicationDocumentUploadResponseSchema,
} from "./schema/applications.response.schema";
import {
  handleCreateLaunchpadApplication,
  handleGetLaunchpadApplication,
  handlePresignLaunchpadApplicationDocumentUpload,
} from "./applications.service";

export const launchpadApplicationsRouter = new OpenAPIHono<AppBindings>();

const presignApplicationDocumentRoute = createRoute({
  method: "post",
  path: "/{launchpadId}/applications/document/presign",
  tags: ["Launchpad Applications"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  request: {
    params: launchpadApplicationParamSchema,
    body: {
      content: {
        "application/json": {
          schema: presignLaunchpadApplicationDocumentUploadSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Presigned application document upload URL generated",
      content: {
        "application/json": {
          schema: presignLaunchpadApplicationDocumentUploadResponseSchema,
        },
      },
    },
    400: {
      description: "Validation failed",
      content: {
        "application/json": {
          schema: launchpadApplicationValidationErrorResponseSchema,
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
          schema: launchpadApplicationOperationErrorResponseSchema,
        },
      },
    },
  },
});

const createApplicationRoute = createRoute({
  method: "post",
  path: "/{launchpadId}/applications",
  tags: ["Launchpad Applications"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  request: {
    params: launchpadApplicationParamSchema,
    body: {
      content: {
        "application/json": {
          schema: createLaunchpadApplicationSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Application submitted successfully",
      content: {
        "application/json": {
          schema: createLaunchpadApplicationResponseSchema,
        },
      },
    },
    400: {
      description: "Validation failed",
      content: {
        "application/json": {
          schema: launchpadApplicationValidationErrorResponseSchema,
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
      description: "Launchpad or role not found",
      content: {
        "application/json": {
          schema: launchpadApplicationOperationErrorResponseSchema,
        },
      },
    },
    409: {
      description: "Already applied for this role",
      content: {
        "application/json": {
          schema: launchpadApplicationOperationErrorResponseSchema,
        },
      },
    },
    500: {
      description: "Internal server error",
      content: {
        "application/json": {
          schema: launchpadApplicationOperationErrorResponseSchema,
        },
      },
    },
  },
});

const getApplicationRoute = createRoute({
  method: "get",
  path: "/{launchpadId}/applications/{applicationId}",
  tags: ["Launchpad Applications"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  request: {
    params: launchpadApplicationByIdParamSchema,
  },
  responses: {
    200: {
      description: "Application details",
      content: {
        "application/json": {
          schema: getLaunchpadApplicationResponseSchema,
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
      description: "Application not found",
      content: {
        "application/json": {
          schema: launchpadApplicationOperationErrorResponseSchema,
        },
      },
    },
    500: {
      description: "Internal server error",
      content: {
        "application/json": {
          schema: launchpadApplicationOperationErrorResponseSchema,
        },
      },
    },
  },
});

launchpadApplicationsRouter.openapi(
  presignApplicationDocumentRoute,
  async (c) => {
    const params = c.req.valid("param");
    const data = c.req.valid("json");
    return handlePresignLaunchpadApplicationDocumentUpload(
      c,
      params,
      data,
    ) as any;
  },
);

launchpadApplicationsRouter.openapi(createApplicationRoute, async (c) => {
  const params = c.req.valid("param");
  const data = c.req.valid("json");
  return handleCreateLaunchpadApplication(c, params, data) as any;
});

launchpadApplicationsRouter.openapi(getApplicationRoute, async (c) => {
  const params = c.req.valid("param");
  return handleGetLaunchpadApplication(c, params) as any;
});
