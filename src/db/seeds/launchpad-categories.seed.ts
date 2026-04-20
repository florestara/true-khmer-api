import { db } from "../index";
import { launchpadCategory } from "../schema/launchpad/categories/categories";

const SEED_ACTOR_ID = "11111111-1111-4111-8111-111111111111";

const LAUNCHPAD_CATEGORY_SEED = [
  {
    name: "Education",
    slug: "education",
    iconKey: "bookOpen",
    displayOrder: 1,
  },
  {
    name: "Environment",
    slug: "environment",
    iconKey: "Globe",
    displayOrder: 2,
  },
  {
    name: "Health",
    slug: "health",
    iconKey: "Heart",
    displayOrder: 3,
  },
  {
    name: "Mentorship",
    slug: "mentorship",
    iconKey: "Users",
    displayOrder: 4,
  },
  {
    name: "Technology",
    slug: "technology",
    iconKey: "Zap",
    displayOrder: 5,
  },
] satisfies Array<
  Pick<
    typeof launchpadCategory.$inferInsert,
    "slug" | "name" | "iconKey" | "displayOrder"
  >
>;

export async function seedLaunchpadCategories() {
  for (const category of LAUNCHPAD_CATEGORY_SEED) {
    try {
      await db
        .insert(launchpadCategory)
        .values({
          ...category,
          status: "ACTIVE",
          createdBy: SEED_ACTOR_ID,
          updatedBy: SEED_ACTOR_ID,
        })
        .onConflictDoNothing()
        .returning({ slug: launchpadCategory.slug });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";

      throw new Error(
        `Failed to insert forum category "${category.slug}": ${message}`,
      );
    }
  }
}
