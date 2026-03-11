import { Hono } from "hono";
import { swaggerUI } from "@hono/swagger-ui";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import routes from "./routes/index";
import { openApiDoc } from "./docs/openapi";

const app = new Hono();

// Middleware
app.use("*", logger());
app.use("*", cors());
app.use("*", prettyJSON());

// Health check
app.get("/", (c) => {
  return c.json({
    message: "TrueKhmer API is running 🚀",
    version: "1.0.0",
  });
});

// API routes
app.route("/api", routes);

// API documentation
app.get("/docs/openapi.json", (c) => c.json(openApiDoc));
app.get("/docs", swaggerUI({ url: "/docs/openapi.json" }));

// 404 handler
app.notFound((c) => {
  return c.json({ error: "Not Found" }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error(`${err}`);
  return c.json({ error: "Internal Server Error" }, 500);
});

export default app;
