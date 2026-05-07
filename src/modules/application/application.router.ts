import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import type { AppBindings } from "../../lib/types";
import { requireAccessToken } from "../../middlewares/auth.middleware";
import { authProtectedErrorResponseSchema } from "../auth/auth.schema";
import {
  createVolunteerApplicationResponseSchema,
  createVolunteerApplicationSchema,
  getVolunteerApplicationsResponseSchema,
  presignVolunteerApplicationDocumentUploadResponseSchema,
  presignVolunteerApplicationDocumentUploadSchema,
  volunteerValidationErrorResponseSchema,
  volunteerOperationErrorResponseSchema,
} from "./application.schema";
import {
  handleCreateVolunteerApplication,
  handleGetVolunteerApplications,
  handlePresignVolunteerApplicationDocumentUpload,
} from "./application.service";

export const applicationRouter = new OpenAPIHono<AppBindings>();

const presignVolunteerApplicationDocumentUploadRoute = createRoute({
  method: "post",
  path: "/document/presign",
  tags: ["Volunteer Application"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: presignVolunteerApplicationDocumentUploadSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Presigned volunteer application document upload URL generated",
      content: {
        "application/json": {
          schema: presignVolunteerApplicationDocumentUploadResponseSchema,
        },
      },
    },
    400: {
      description: "Validation failed",
      content: {
        "application/json": {
          schema: volunteerValidationErrorResponseSchema,
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
      description: "Volunteer opportunity not found",
      content: {
        "application/json": {
          schema: volunteerOperationErrorResponseSchema,
        },
      },
    },
    409: {
      description: "Volunteer application already exists",
      content: {
        "application/json": {
          schema: volunteerOperationErrorResponseSchema,
        },
      },
    },
    500: {
      description: "Internal server error",
      content: {
        "application/json": {
          schema: volunteerOperationErrorResponseSchema,
        },
      },
    },
  },
});

const createVolunteerApplicationRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["Volunteer Application"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: createVolunteerApplicationSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Volunteer application submitted",
      content: {
        "application/json": {
          schema: createVolunteerApplicationResponseSchema,
        },
      },
    },
    400: {
      description: "Validation failed",
      content: {
        "application/json": {
          schema: volunteerValidationErrorResponseSchema,
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
      description: "Volunteer role not found",
      content: {
        "application/json": {
          schema: volunteerOperationErrorResponseSchema,
        },
      },
    },
    409: {
      description: "Duplicate volunteer application",
      content: {
        "application/json": {
          schema: volunteerOperationErrorResponseSchema,
        },
      },
    },
    500: {
      description: "Internal server error",
      content: {
        "application/json": {
          schema: volunteerOperationErrorResponseSchema,
        },
      },
    },
  },
});

const getVolunteerApplicationsRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Volunteer Application"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: "List of volunteer applications for the authenticated user",
      content: {
        "application/json": {
          schema: getVolunteerApplicationsResponseSchema,
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
          schema: volunteerOperationErrorResponseSchema,
        },
      },
    },
  },
});

applicationRouter.openapi(
  presignVolunteerApplicationDocumentUploadRoute,
  async (c) => {
    const data = c.req.valid("json");
    return handlePresignVolunteerApplicationDocumentUpload(c, data) as any;
  },
);

applicationRouter.openapi(createVolunteerApplicationRoute, async (c) => {
  const data = c.req.valid("json");
  return handleCreateVolunteerApplication(c, data) as any;
});

applicationRouter.openapi(getVolunteerApplicationsRoute, async (c) => {
  return handleGetVolunteerApplications(c) as any;
});
