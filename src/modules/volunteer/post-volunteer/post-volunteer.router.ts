import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import type { AppBindings } from "../../../lib/types";
import {
  requireAdmin,
  requireAccessToken,
} from "../../../middlewares/auth.middleware";
import { authProtectedErrorResponseSchema } from "../../auth/auth.schema";
import {
  createVolunteerCategoryResponseSchema,
  createVolunteerCategorySchema,
  getVolunteerCategoriesResponseSchema,
  volunteerOperationErrorResponseSchema,
  volunteerCategoryValidationErrorResponseSchema,
} from "./post-volunteer.schema";
import {
  handleCreateVolunteerCategory,
  handleGetVolunteerCategories,
} from "./post-volunteer.service";

export const postVolunteerRouter = new OpenAPIHono<AppBindings>();

const getVolunteerCategoriesRoute = createRoute({
  method: "get",
  path: "/categories",
  tags: ["Volunteer Post"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: "List of volunteer categories",
      content: {
        "application/json": {
          schema: getVolunteerCategoriesResponseSchema,
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

const createVolunteerCategoryRoute = createRoute({
  method: "post",
  path: "/categories",
  tags: ["Volunteer Post"],
  middleware: [requireAdmin],
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: createVolunteerCategorySchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Volunteer category created",
      content: {
        "application/json": {
          schema: createVolunteerCategoryResponseSchema,
        },
      },
    },
    400: {
      description: "Validation failed",
      content: {
        "application/json": {
          schema: volunteerCategoryValidationErrorResponseSchema,
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
      description: "Category already exists",
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

postVolunteerRouter.openapi(getVolunteerCategoriesRoute, async (c) => {
  return handleGetVolunteerCategories(c) as any;
});

postVolunteerRouter.openapi(createVolunteerCategoryRoute, async (c) => {
  const data = c.req.valid("json");
  return handleCreateVolunteerCategory(c, data) as any;
});
