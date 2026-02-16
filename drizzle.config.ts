import { defineConfig } from "drizzle-kit";
import "dotenv/config";

// Main database config (default)
// Run: npx drizzle-kit push (uses this config)
export default defineConfig({
  out: "./drizzle/main",
  schema: "./src/db/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
