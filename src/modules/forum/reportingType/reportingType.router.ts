import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { AppBindings } from "../../../lib/types";
import { getReportingTypesResponseSchema } from "./reportingType.schema";
import { handleReportingTypes } from "./reportingType.service";

export const reportingTypeRouter = new OpenAPIHono<AppBindings>();

const listPublicRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Public", "Public Forum Reporting Type"],
  security: [],
  responses: {
    200: {
      description: "List of reporting types",
      content: {
        "application/json": {
          schema: getReportingTypesResponseSchema,
        },
      },
    },
    404: { description: "No reporting types found" },
    500: { description: "Internal server error" },
  },
});

reportingTypeRouter.openapi(listPublicRoute, async (c) => {
  return handleReportingTypes(c) as any;
});
