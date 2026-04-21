import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import type { AppBindings } from "../../../lib/types";
import { getLaunchpadCategoriesResponseSchema } from "./categories.schema";
import {
  handleGetLaunchpadCategories,
  handleGetLaunchpadCategory,
} from "./categories.service";
import { getLaunchpadCategoriesParamsSchema } from "./schema/categories.request.schema";

export const launchpadCategoriesRouter = new OpenAPIHono<AppBindings>();

const getRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Public", "Launchpad Category"],
  responses: {
    200: {
      description: "List of launchpad categories",
      content: {
        "application/json": {
          schema: getLaunchpadCategoriesResponseSchema,
        },
      },
    },
  },
});

const getRouteById = createRoute({
  method: "get",
  path: "/{categoryId}",
  tags: ["Public", "Launchpad Category"],
  request: {
    params: getLaunchpadCategoriesParamsSchema,
  },
  responses: {
    200: {
      description: "Launchpad category details",
      content: {
        "application/json": {
          schema: getLaunchpadCategoriesResponseSchema,
        },
      },
    },
    400: {
      description: "Invalid request parameters",
    },
    404: {
      description: "Launchpad category not found",
    },
    500: { description: "Internal server error" },
  },
});

launchpadCategoriesRouter.openapi(getRoute, async (c) => {
  return handleGetLaunchpadCategories(c) as any;
});

launchpadCategoriesRouter.openapi(getRouteById, async (c) => {
  const params = c.req.valid("param");
  return handleGetLaunchpadCategory(c, params) as any;
});
