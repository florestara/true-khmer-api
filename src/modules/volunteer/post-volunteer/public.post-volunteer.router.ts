import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import type { AppBindings } from "../../../lib/types";
import {
  getVolunteerCategoriesResponseSchema,
  getVolunteerLocationsResponseSchema,
  getVolunteerOpportunityParamsSchema,
  getVolunteerOpportunityResponseSchema,
  getVolunteerOpportunitiesResponseSchema,
  getVolunteerOpportunitiesQuerySchema,
  volunteerOperationErrorResponseSchema,
  volunteerValidationErrorResponseSchema,
} from "./post-volunteer.schema";
import {
  handleGetVolunteerCategories,
  handleGetVolunteerLocations,
  handleGetVolunteerOpportunity,
  handleGetVolunteerOpportunities,
} from "./post-volunteer.service";

export const publicPostVolunteerRouter = new OpenAPIHono<AppBindings>();

const getPublicVolunteerCategoriesRoute = createRoute({
  method: "get",
  path: "/categories",
  tags: ["Public", "Public Volunteer"],
  security: [],
  responses: {
    200: {
      description: "List of volunteer categories",
      content: {
        "application/json": {
          schema: getVolunteerCategoriesResponseSchema,
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

const getPublicVolunteerLocationsRoute = createRoute({
  method: "get",
  path: "/locations",
  tags: ["Public", "Public Volunteer"],
  security: [],
  responses: {
    200: {
      description: "List of volunteer locations in Cambodia",
      content: {
        "application/json": {
          schema: getVolunteerLocationsResponseSchema,
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

const getPublicVolunteerOpportunitiesRoute = createRoute({
  method: "get",
  path: "/opportunities",
  tags: ["Public", "Public Volunteer"],
  security: [],
  request: {
    query: getVolunteerOpportunitiesQuerySchema,
  },
  responses: {
    200: {
      description: "List of volunteer opportunities",
      content: {
        "application/json": {
          schema: getVolunteerOpportunitiesResponseSchema,
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

const getPublicVolunteerOpportunityRoute = createRoute({
  method: "get",
  path: "/opportunities/{opportunityId}",
  tags: ["Public", "Public Volunteer"],
  security: [],
  request: {
    params: getVolunteerOpportunityParamsSchema,
  },
  responses: {
    200: {
      description: "Volunteer opportunity details",
      content: {
        "application/json": {
          schema: getVolunteerOpportunityResponseSchema,
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

publicPostVolunteerRouter.openapi(getPublicVolunteerCategoriesRoute, async (c) => {
  return handleGetVolunteerCategories(c) as any;
});

publicPostVolunteerRouter.openapi(getPublicVolunteerLocationsRoute, async (c) => {
  return handleGetVolunteerLocations(c) as any;
});

publicPostVolunteerRouter.openapi(
  getPublicVolunteerOpportunitiesRoute,
  async (c) => {
    const query = c.req.valid("query");
    return handleGetVolunteerOpportunities(c, query, true) as any;
  },
);

publicPostVolunteerRouter.openapi(getPublicVolunteerOpportunityRoute, async (c) => {
  const params = c.req.valid("param");
  return handleGetVolunteerOpportunity(c, params, true) as any;
});
