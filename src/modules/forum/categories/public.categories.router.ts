import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import type { AppBindings } from "../../../lib/types";
import {
  getCategoriesResponseSchema,
} from "./categories.schema";
import {
  handleGetCategories,
} from "./categories.service";

export const publicCategoriesRouter = new OpenAPIHono<AppBindings>();

const publicGetRoute = createRoute({
  method: "get",
  path: "/",
  security: [],
  tags: ["Public", "Public Forum Category"],
  responses: {
    200: {
      description: "List of categories",
      content: {
        "application/json": {
          schema: getCategoriesResponseSchema,
        },
      },
    },
  },
});


publicCategoriesRouter.openapi(publicGetRoute, async (c) => {
  return handleGetCategories(c, true) as any;
});


