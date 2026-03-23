import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import type { AppBindings } from "../../../lib/types";
import {
  createCategoryResponseSchema,
  createCategorySchema,
  getCategoriesResponseSchema,
} from "./categories.schema";
import {
  requireAdmin,
  requireAccessToken,
} from "../../../middlewares/auth.middleware";
import {
  handleCreateCategory,
  handleGetCategories,
} from "./categories.service";

export const categoriesRouter = new OpenAPIHono<AppBindings>();

const getRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Forum Category"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
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

const postRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["Forum Category"],
  middleware: [requireAdmin],
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: { "application/json": { schema: createCategorySchema } },
    },
  },
  responses: {
    201: {
      description: "Category created",
      content: {
        "application/json": {
          schema: createCategoryResponseSchema,
        },
      },
    },
    400: { description: "Validation failed" },
    409: { description: "Category already exists" },
  },
});

categoriesRouter.openapi(getRoute, async (c) => {
  return (await handleGetCategories(c)) as any;
});

categoriesRouter.openapi(postRoute, async (c) => {
  return handleCreateCategory(c);
});
