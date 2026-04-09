import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import type { AppBindings } from "../../../lib/types";
import {
  getVolunteerCategoriesResponseSchema,
  getVolunteerLocationsResponseSchema,
  volunteerOperationErrorResponseSchema,
} from "./post-volunteer.schema";
import {
  handleGetVolunteerCategories,
  handleGetVolunteerLocations,
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

publicPostVolunteerRouter.openapi(getPublicVolunteerCategoriesRoute, async (c) => {
  return handleGetVolunteerCategories(c) as any;
});

publicPostVolunteerRouter.openapi(getPublicVolunteerLocationsRoute, async (c) => {
  return handleGetVolunteerLocations(c) as any;
});
