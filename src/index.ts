import "dotenv/config";
import { serve } from "@hono/node-server";
import app from "./app";
import { startCronScheduler } from "./modules/cron/scheduler";

const port = Number(process.env.PORT) || 3000;

console.log(`🚀 Server is running on http://localhost:${port}`);

// Start the cron scheduler
startCronScheduler();

serve({
  fetch: app.fetch,
  port,
});
