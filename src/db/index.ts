import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";
import * as secondarySchema from "./schema/secondary";

// Main database (users, etc.) - migrations managed via DATABASE_URL
const mainClient = postgres(process.env.DATABASE_URL!);
export const db = drizzle(mainClient, { schema });

// Secondary database (events, etc.) - separate database for querying
const secondaryClient = postgres(process.env.SECONDARY_DATABASE_URL!);
export const secondaryDb = drizzle(secondaryClient, {
  schema: secondarySchema,
});
