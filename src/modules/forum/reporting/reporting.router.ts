import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
  createReportingResponseSchema,
  createReportingSchema,
} from "./reporting.schema";
import { AppBindings } from "../../../lib/types";
import { handleCreateReporting } from "./reporting.service";

export const reportingRouter = new OpenAPIHono<AppBindings>();

const createReportingRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["Public", "Forum Reporting"],
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: createReportingSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Reporting created successfully",
      content: {
        "application/json": {
          schema: createReportingResponseSchema,
        },
      },
    },
    400: { description: "Invalid request data" },
    401: { description: "Unauthorized" },
    404: { description: "Reported entity not found" },
    500: { description: "Internal server error" },
  },
});

reportingRouter.openapi(createReportingRoute, async (c) => {
  const data = c.req.valid("json");
  return handleCreateReporting(c, data) as any;
});
