import { seedForumCategories } from "./forum-categories.seed";
import { seedForumReportingTypes } from "./forum-reporting-type.seed";
import { seedOnboardingLookups } from "./onboarding-lookups.seed";
import { closeDb } from "../index";
import { seedPointSystems } from "./point-systems.seed";
import { seedLaunchpadCategories } from "./launchpad-categories.seed";

async function main() {
  console.log("🚀 Starting seed...\n");

  await seedForumReportingTypes();
  await seedOnboardingLookups();
  await seedForumCategories();
  await seedPointSystems();
  await seedLaunchpadCategories();

  console.log("\n🎉 All seeds complete.");
  await closeDb();
  process.exit(0);
}

main().catch(async (e) => {
  console.error("❌ Seeding failed:", e);
  await closeDb();
  process.exit(1);
});
