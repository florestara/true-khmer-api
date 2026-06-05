import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { prettyJSON } from "hono/pretty-json";
import { ZodError } from "zod";
import routes from "./routes/routes";
import { AppBindings } from "./lib/types";
import { scalarDocsPageHtml } from "./docs/scalar-docs";
import { logger } from "hono/logger";

const app = new OpenAPIHono<AppBindings>();

// Middleware
if (process.env.NODE_ENV !== "production") {
  app.use("*", logger());
}
app.use("*", cors());
app.use("*", prettyJSON());

// API routes
app.route("/v1", routes);

// Health check
app.get("/", (c) => {
  return c.json({
    message: "TrueKhmer API is running 🚀",
    version: "1.0.0",
  });
});

app.openAPIRegistry.registerComponent("securitySchemes", "BearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
  description: "Enter your JWT token to access protected routes",
});

// Auto-generate OpenAPI spec from routes
app.doc("/docs/openapi.json", {
  openapi: "3.0.0",
  info: {
    title: "TrueKhmer API",
    version: "1.0.0",
    description: "API for TrueKhmer community platform",
  },
});

// API documentation - serve a small auth wrapper around Scalar UI
app.get("/docs", (c) => c.html(scalarDocsPageHtml()));

// 404 handler
app.notFound((c) => {
  return c.json({ error: "Not Found" }, 404);
});

function isZodValidationError(error: unknown): error is ZodError {
  return (
    error instanceof ZodError ||
    (typeof error === "object" &&
      error !== null &&
      "name" in error &&
      (error as { name?: unknown }).name === "ZodError" &&
      "issues" in error &&
      Array.isArray((error as { issues?: unknown }).issues))
  );
}

// Error handler
app.onError((err, c) => {
  if (isZodValidationError(err)) {
    return c.json(
      {
        ok: false,
        error: "Validation failed",
        issues: err.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      400,
    );
  }

  console.error(`${err}`);
  return c.json({ error: "Internal Server Error" }, 500);
});

export default app;
