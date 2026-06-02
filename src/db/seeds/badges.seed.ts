import { sql } from "drizzle-orm";
import { BADGE_DEFINITIONS } from "../../modules/badges/badges.constants";
import { db } from "../index";
import { badge } from "../schema";

export async function seedBadges() {
  console.log("Seeding badges...");

  await db
    .insert(badge)
    .values([...BADGE_DEFINITIONS])
    .onConflictDoUpdate({
      target: badge.slug,
      set: {
        name: sql`excluded.name`,
        description: sql`excluded.description`,
        category: sql`excluded.category`,
        updatedAt: sql`now()`,
      },
    });

  console.log("Badges seeded.");
}
