import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import type { AppBindings } from "../../../lib/types";
import { requireAccessToken } from "../../../middlewares/auth.middleware";
import { authProtectedErrorResponseSchema } from "../../auth/auth.schema";
import {
  changeManagePostingApplicationStatusParamSchema,
  extendManagePostingDeadlineBodySchema,
  extendManagePostingDeadlineResponseSchema,
  getManagePostingApplicationParamSchema,
  getManagePostingDetailParamSchema,
  getManagePostingDetailQuerySchema,
  getManagePostingsQuerySchema,
  managePostingApplicationActionResponseSchema,
  managePostingApplicationDetailResponseSchema,
  managePostingDetailResponseSchema,
  updateManagePostingActionParamSchema,
  updateManagePostingActionResponseSchema,
  managePostingsErrorResponseSchema,
  managePostingsResponseSchema,
} from "./manage-posting.schema";
import {
  handleExtendManagePostingDeadline,
  handleGetManagePostingApplication,
  handleGetManagePostingDetail,
  handleGetManagePostings,
  handleUpdateManagePostingAction,
  handleUpdateManagePostingApplication,
} from "./manage-posting.service";

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

const getManagePostingDetailRoute = createRoute({
  method: "get",
  path: "/{sourceType}/{postingId}",
  tags: ["Workspace"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  request: {
    params: getManagePostingDetailParamSchema,
    query: getManagePostingDetailQuerySchema,
  },
  responses: {
    200: {
      description:
        "Authenticated user's posting detail with applicants for review",
      content: {
        "application/json": {
          schema: managePostingDetailResponseSchema,
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
      description: "Posting not found",
      content: {
        "application/json": {
          schema: managePostingsErrorResponseSchema,
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

const getManagePostingApplicationRoute = createRoute({
  method: "get",
  path: "/{sourceType}/{postingId}/{applicationId}",
  tags: ["Workspace"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  request: {
    params: getManagePostingApplicationParamSchema,
  },
  responses: {
    200: {
      description: "Authenticated posting owner's application detail",
      content: {
        "application/json": {
          schema: managePostingApplicationDetailResponseSchema,
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
          schema: managePostingsErrorResponseSchema,
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

const updateManagePostingActionRoute = createRoute({
  method: "post",
  path: "/{sourceType}/{postingId}/action/{postingAction}",
  tags: ["Workspace"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  request: {
    params: updateManagePostingActionParamSchema,
  },
  responses: {
    200: {
      description: "Posting action completed",
      content: {
        "application/json": {
          schema: updateManagePostingActionResponseSchema,
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
      description: "Posting not found",
      content: {
        "application/json": {
          schema: managePostingsErrorResponseSchema,
        },
      },
    },
    409: {
      description: "Posting action is not allowed for the current state",
      content: {
        "application/json": {
          schema: managePostingsErrorResponseSchema,
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

const extendManagePostingDeadlineRoute = createRoute({
  method: "post",
  path: "/{sourceType}/{postingId}/extend-deadline",
  tags: ["Workspace"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  request: {
    params: getManagePostingDetailParamSchema,
    body: {
      content: {
        "application/json": {
          schema: extendManagePostingDeadlineBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Posting deadline extended and posting reopened",
      content: {
        "application/json": {
          schema: extendManagePostingDeadlineResponseSchema,
        },
      },
    },
    400: {
      description: "Validation failed",
      content: {
        "application/json": {
          schema: managePostingsErrorResponseSchema,
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
      description: "Posting not found",
      content: {
        "application/json": {
          schema: managePostingsErrorResponseSchema,
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

const updateManagePostingApplicationRoute = createRoute({
  method: "post",
  path: "/{sourceType}/{postingId}/{applicationId}/change-status/{statusAction}",
  tags: ["Workspace"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  request: {
    params: changeManagePostingApplicationStatusParamSchema,
  },
  responses: {
    200: {
      description: "Application review action completed",
      content: {
        "application/json": {
          schema: managePostingApplicationActionResponseSchema,
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
          schema: managePostingsErrorResponseSchema,
        },
      },
    },
    409: {
      description: "Application is no longer pending review",
      content: {
        "application/json": {
          schema: managePostingsErrorResponseSchema,
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

managePostingRouter.openapi(getManagePostingApplicationRoute, async (c) => {
  const params = c.req.valid("param");
  return (await handleGetManagePostingApplication(c, params)) as any;
});

managePostingRouter.openapi(updateManagePostingActionRoute, async (c) => {
  const params = c.req.valid("param");
  return (await handleUpdateManagePostingAction(c, params)) as any;
});

managePostingRouter.openapi(extendManagePostingDeadlineRoute, async (c) => {
  const params = c.req.valid("param");
  const body = c.req.valid("json");
  return (await handleExtendManagePostingDeadline(c, params, body)) as any;
});

managePostingRouter.openapi(updateManagePostingApplicationRoute, async (c) => {
  const params = c.req.valid("param");
  return (await handleUpdateManagePostingApplication(c, params)) as any;
});

managePostingRouter.openapi(getManagePostingDetailRoute, async (c) => {
  const params = c.req.valid("param");
  const query = c.req.valid("query");
  return (await handleGetManagePostingDetail(c, params, query)) as any;
});
