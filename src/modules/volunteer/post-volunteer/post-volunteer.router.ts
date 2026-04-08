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
  createVolunteerOpportunityFormSchema,
  createVolunteerOpportunityResponseSchema,
  getVolunteerCategoriesResponseSchema,
  getVolunteerLocationsResponseSchema,
  volunteerCategoryValidationErrorResponseSchema,
  volunteerOperationErrorResponseSchema,
  volunteerValidationErrorResponseSchema,
} from "./post-volunteer.schema";
import {
  handleCreateVolunteerCategory,
  handleCreateVolunteerOpportunity,
  handleGetVolunteerCategories,
  handleGetVolunteerLocations,
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

const getVolunteerLocationsRoute = createRoute({
  method: "get",
  path: "/locations",
  tags: ["Volunteer Post"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: "List of volunteer locations in Cambodia",
      content: {
        "application/json": {
          schema: getVolunteerLocationsResponseSchema,
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

const createVolunteerOpportunityRoute = createRoute({
  method: "post",
  path: "/opportunities",
  tags: ["Volunteer Post"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: {
        "multipart/form-data": {
          schema: createVolunteerOpportunityFormSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Volunteer opportunity created",
      content: {
        "application/json": {
          schema: createVolunteerOpportunityResponseSchema,
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
      description: "Related volunteer records were not found",
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

postVolunteerRouter.openapi(getVolunteerLocationsRoute, async (c) => {
  return handleGetVolunteerLocations(c) as any;
});

postVolunteerRouter.openapi(createVolunteerOpportunityRoute, async (c) => {
  return handleCreateVolunteerOpportunity(c) as any;
});
