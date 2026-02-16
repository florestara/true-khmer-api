import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import routes from "./routes/index";

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
