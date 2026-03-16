import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { closeDb, db } from "../../../db/index";
import { forumCategory } from "../../../db/schema";

const SEED_ACTOR_ID = "11111111-1111-4111-8111-111111111111";

const FORUM_CATEGORY_SEED = [
  {
    name: "Business Growth",
    slug: "business-growth",
    description: "Questions and ideas about scaling ventures and teams.",
    displayOrder: 1,
  },
  {
    name: "Career Advice",
    slug: "career-advice",
    description: "Career path, hiring, and professional development discussions.",
    displayOrder: 2,
  },
  {
    name: "Tech & Innovation",
    slug: "tech-and-innovation",
    description: "Technology trends, product building, and innovation topics.",
    displayOrder: 3,
  },
  {
    name: "Khmer Culture",
    slug: "khmer-culture",
    description: "Culture, identity, heritage, and local community conversations.",
    displayOrder: 4,
  },
  {
    name: "Networking",
    slug: "networking",
    description: "Relationship building, partnerships, and collaboration opportunities.",
    displayOrder: 5,
  },
] satisfies Array<
  Pick<
    typeof forumCategory.$inferInsert,
    "name" | "slug" | "description" | "displayOrder"
  >
>;

export async function seedForumCategories() {
  let insertedCount = 0;

  for (const category of FORUM_CATEGORY_SEED) {
    try {
      const [insertedCategory] = await db
        .insert(forumCategory)
        .values({
          ...category,
          status: "ACTIVE",
          createdBy: SEED_ACTOR_ID,
          updatedBy: SEED_ACTOR_ID,
        })
        .onConflictDoNothing()
        .returning({ slug: forumCategory.slug });

      if (insertedCategory) insertedCount += 1;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "unknown error";

      throw new Error(
        `Failed to insert forum category "${category.slug}": ${message}`,
      );
    }
  }

  const skippedCount = FORUM_CATEGORY_SEED.length - insertedCount;

  console.log(
    `Forum category seed completed. Inserted ${insertedCount} new categories, skipped ${skippedCount} existing categories.`,
  );
}

function isExecutedDirectly() {
  const currentFilePath = fileURLToPath(import.meta.url);
  const entryPath = process.argv[1] ? resolve(process.argv[1]) : "";
  return currentFilePath === entryPath;
}

async function main() {
  try {
    await seedForumCategories();
  } catch (error) {
    console.error("Forum category seed failed", error);
    process.exitCode = 1;
  } finally {
    await closeDb();
  }
}

if (isExecutedDirectly()) {
  void main();
}