import { db } from "../index";
import { eq, sql } from "drizzle-orm";
import { city, country, interest, tier } from "../schema";
import { normalizeLocationName } from "../../modules/onboarding/utils";

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
    description: "The everyday Cambodian citizen - the foundation of community",
  },
  {
    slug: "yothea",
    name: "Yothea",
    rankOrder: 2,
    minPoints: 500,
    description: "The Warrior - actively fighting for Cambodia's progress",
  },
  {
    slug: "reach",
    name: "Reach",
    rankOrder: 3,
    minPoints: 2000,
    description: "The Noble - a community leader who guides others with wisdom",
  },
  {
    slug: "preah",
    name: "Preah",
    rankOrder: 4,
    minPoints: 5000,
    description: "The Sacred One - embodies Khmer values at the highest level",
  },
  {
    slug: "indra",
    name: "Indra",
    rankOrder: 5,
    minPoints: 10000,
    description:
      "The Divine - king of gods in Khmer mythology; ultimate contribution",
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

  await db
    .insert(tier)
    .values(TIER_SEED)
    .onConflictDoUpdate({
      target: tier.slug,
      set: {
        name: sql`excluded.name`,
        rankOrder: sql`excluded.rank_order`,
        minPoints: sql`excluded.min_points`,
        description: sql`excluded.description`,
      },
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
