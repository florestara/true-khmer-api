import { OpenAPIHono } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { ZodError } from "zod";
import routes from "./routes/routes";
import { AppBindings } from "./lib/types";

const app = new OpenAPIHono<AppBindings>();

// Middleware
app.use("*", logger());
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
  bearerFormat: "JWT", // Optional
  description: "Enter your JWT token to access protected routes",
});

app.openAPIRegistry.registerComponent("securitySchemes", "RefreshToken", {
  type: "apiKey",
  in: "header",
  name: "x-refresh-token", // The header name used in the request
  description: "Insert your Refresh Token here",
});

// Auto-generate OpenAPI spec from routes
app.doc("/openapi.json", {
  openapi: "3.0.0",
  info: {
    title: "TrueKhmer API",
    version: "1.0.0",
    description: "API for TrueKhmer community platform",
  },
  security: [{ BearerAuth: [] }, { RefreshToken: [] }],
});

// API documentation - serve Scalar UI
app.get(
  "/docs",
  Scalar({
    url: "/openapi.json",
    theme: "deepSpace",
    persistAuth: true,
    authentication: {
      preferredSecurityScheme: "BearerAuth",
    },
    onBeforeRequest: ({ request }) => {
      const storage = (globalThis as { localStorage?: Storage }).localStorage;
      const token = storage?.getItem("truekhmer.scalar.accessToken");

      if (token && !request.headers.has("authorization")) {
        request.headers.set("authorization", `Bearer ${token}`);
      }
    },
    fetch: async (input, init) => {
      const response = await fetch(input, init);

      if (!response.ok) {
        return response;
      }

      const requestUrl = (() => {
        if (typeof input === "string") {
          return input;
        }

        if (input instanceof URL) {
          return input.toString();
        }

        if (
          typeof input === "object" &&
          input !== null &&
          "url" in input &&
          typeof (input as { url?: unknown }).url === "string"
        ) {
          return (input as { url: string }).url;
        }

        return "";
      })();

      try {
        const baseOrigin =
          (globalThis as { location?: { origin?: string } }).location?.origin ??
          "http://localhost";
        const pathname = new URL(requestUrl, baseOrigin).pathname;

        if (!pathname.endsWith("/auth/login")) {
          return response;
        }

        const payload = await response.clone().json();
        const accessToken =
          typeof payload?.result?.accessToken === "string"
            ? payload.result.accessToken
            : typeof payload?.accessToken === "string"
              ? payload.accessToken
              : null;

        if (accessToken) {
          (globalThis as { localStorage?: Storage }).localStorage?.setItem(
            "truekhmer.scalar.accessToken",
            accessToken,
          );
        }
      } catch {
        // Ignore non-JSON responses and URL parsing errors.
      }

      return response;
    },
  }),
);

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
