import { db } from "../../db/index";
import { eq } from "drizzle-orm";
import { normalizeLocationName } from "./utils";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { city, country, interest, tier } from "../../db/schema";

const INTEREST_SEED = [
  { slug: "education", label: "Education", icon: "🎓" },
  { slug: "technology", label: "Technology", icon: "💻" },
  { slug: "environment", label: "Environment", icon: "🌱" },
  { slug: "healthcare", label: "Healthcare", icon: "🩺" },
  { slug: "arts-culture", label: "Arts & Culture", icon: "🎨" },
  { slug: "business", label: "Business", icon: "📊" },
  { slug: "agriculture", label: "Agriculture", icon: "🌾" },
  { slug: "mentorship", label: "Mentorship", icon: "👨🏻‍🏫" },
  { slug: "social", label: "Social", icon: "🤝" },
  { slug: "heritage", label: "Heritage", icon: "🏛️" },
  { slug: "startups", label: "Startups", icon: "🚀" },
] satisfies Array<
  Pick<typeof interest.$inferInsert, "slug" | "label" | "icon">
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
  name: "🇰🇭Cambodia",
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
