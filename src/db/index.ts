import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";

const mainClient = postgres(process.env.DATABASE_URL!);
export const db = drizzle(mainClient, { schema });

export async function closeDb() {
  await mainClient.end({ timeout: 5 });
}