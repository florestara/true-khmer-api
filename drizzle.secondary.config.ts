import { defineConfig } from "drizzle-kit";
import "dotenv/config";

// Secondary database config
// Run: npx drizzle-kit push --config=drizzle.secondary.config.ts
export default defineConfig({
  out: "./drizzle/secondary",
  schema: "./src/db/schema/secondary.ts",
  dialect: "postgresql",
  tablesFilter: ["event"],
  dbCredentials: {
    url: process.env.SECONDARY_DATABASE_URL!,
  },
});
