import { db } from "../db/index";
import { eq } from "drizzle-orm";
import { normalizeLocationName } from "./utils";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { city, contribution, country, interest, tier } from "../db/schema";

const INTEREST_SEED = [
  { slug: "education", label: "Education" },
  { slug: "technology", label: "Technology" },
  { slug: "environment", label: "Environment" },
  { slug: "healthcare", label: "Healthcare" },
  { slug: "arts-culture", label: "Arts & Culture" },
  { slug: "business", label: "Business" },
  { slug: "agriculture", label: "Agriculture" },
  { slug: "mentorship", label: "Mentorship" },
  { slug: "social", label: "Social" },
  { slug: "heritage", label: "Heritage" },
  { slug: "startups", label: "Startups" },
] satisfies Array<Pick<typeof interest.$inferInsert, "slug" | "label">>;

const CONTRIBUTION_SEED = [
  {
    slug: "ask-questions",
    name: "Ask Questions",
    description:
      "Ask questions in the forum and get practical help from the community.",
  },
  {
    slug: "find-answers",
    name: "Find Answers",
    description:
      "Discover answers from existing discussions and community tips.",
  },
  {
    slug: "recruit-volunteer",
    name: "Recruit Volunteer",
    description: "Post for volunteer opportunities and make direct impact.",
  },
  {
    slug: "post-project",
    name: "Post Project",
    description:
      "Launch projects and recruit talented collaborators to your team.",
  },
  {
    slug: "organize-event",
    name: "Organize Event",
    description:
      "Host events and connect the Khmer community around shared goals.",
  },
  {
    slug: "basic-activities",
    name: "Basic Activities",
    description: "Browse, react, and support members across the platform.",
  },
] satisfies Array<
  Pick<typeof contribution.$inferInsert, "slug" | "name" | "description">
>;

const TIER_SEED = [
  {
    slug: "neary",
    name: "Neary",
    rankOrder: 1,
    minPoints: 0,
    description: "Starting tier.",
  },
  {
    slug: "yothea",
    name: "Yothea",
    rankOrder: 2,
    minPoints: 200,
    description: "Second tier.",
  },
  {
    slug: "reach",
    name: "Reach",
    rankOrder: 3,
    minPoints: 600,
    description: "Advanced tier.",
  },
] satisfies Array<
  Pick<
    typeof tier.$inferInsert,
    "slug" | "name" | "rankOrder" | "minPoints" | "description"
  >
>;

const CAMBODIA_COUNTRY_SEED = {
  name: "Cambodia",
  normalizedName: normalizeLocationName("Cambodia"),
  iso2: "KH",
  provider: "seed",
  providerRef: "kh",
} satisfies Pick<
  typeof country.$inferInsert,
  "name" | "normalizedName" | "iso2" | "provider" | "providerRef"
>;

const CAMBODIA_CITY_NAMES = [
  "Banteay Meanchey",
  "Battambang",
  "Kampong Cham",
  "Kampong Chhnang",
  "Kampong Speu",
  "Kampong Thom",
  "Kampot",
  "Kandal",
  "Koh Kong",
  "Kratie",
  "Mondulkiri",
  "Phnom Penh",
  "Preah Vihear",
  "Prey Veng",
  "Pursat",
  "Ratanakiri",
  "Siem Reap",
  "Preah Sihanouk",
  "Stung Treng",
  "Svay Rieng",
  "Takeo",
  "Oddar Meanchey",
  "Kep",
  "Pailin",
  "Tboung Khmum",
] as const;

export async function seedOnboardingLookups() {
  await db.insert(interest).values(INTEREST_SEED).onConflictDoNothing({
    target: interest.slug,
  });

  await db.insert(contribution).values(CONTRIBUTION_SEED).onConflictDoNothing({
    target: contribution.slug,
  });

  await db.insert(tier).values(TIER_SEED).onConflictDoNothing({
    target: tier.slug,
  });

  await db.insert(country).values(CAMBODIA_COUNTRY_SEED).onConflictDoNothing({
    target: country.normalizedName,
  });

  const [cambodiaCountry] = await db
    .select({ id: country.id })
    .from(country)
    .where(eq(country.normalizedName, CAMBODIA_COUNTRY_SEED.normalizedName))
    .limit(1);

  if (!cambodiaCountry) {
    throw new Error("Failed to seed Cambodia country");
  }

  const citySeed = CAMBODIA_CITY_NAMES.map((name) => ({
    countryId: cambodiaCountry.id,
    name,
    normalizedName: normalizeLocationName(name),
    provider: "seed",
    providerRef: `kh:${normalizeLocationName(name)}`,
  })) satisfies Array<
    Pick<
      typeof city.$inferInsert,
      "countryId" | "name" | "normalizedName" | "provider" | "providerRef"
    >
  >;

  await db
    .insert(city)
    .values(citySeed)
    .onConflictDoNothing({
      target: [city.countryId, city.normalizedName],
    });
}

function isExecutedDirectly() {
  const currentFilePath = fileURLToPath(import.meta.url);
  const entryPath = process.argv[1] ? resolve(process.argv[1]) : "";
  return currentFilePath === entryPath;
}

if (isExecutedDirectly()) {
  seedOnboardingLookups()
    .then(() => {
      console.log("Onboarding lookup seed completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Onboarding lookup seed failed", error);
      process.exit(1);
    });
}
