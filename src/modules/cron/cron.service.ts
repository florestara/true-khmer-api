import { db } from "../../db/index";
import { volunteerOpportunity, launchpad } from "../../db/schema";
import { eq, and, lt, isNull } from "drizzle-orm";

export async function runStatusUpdateCron() {
  const now = new Date();
  const nowIso = now.toISOString();

  let updatedVolunteerOpportunities = 0;
  let updatedLaunchpadPosts = 0;

  try {
    const volunteerResult = await db
      .update(volunteerOpportunity)
      .set({
        status: "IN_PROGRESS",
        updatedAt: nowIso,
      })
      .where(
        and(
          eq(volunteerOpportunity.status, "LIVE"),
          lt(volunteerOpportunity.applicationDeadline, nowIso),
          isNull(volunteerOpportunity.deletedAt),
        ),
      )
      .returning();

    updatedVolunteerOpportunities = volunteerResult.length;

    const launchpadResult = await db
      .update(launchpad)
      .set({
        status: "IN_PROGRESS",
        updatedAt: nowIso,
      })
      .where(
        and(
          eq(launchpad.status, "LIVE"),
          lt(launchpad.deadline, nowIso),
          isNull(launchpad.deletedAt),
        ),
      )
      .returning();

    updatedLaunchpadPosts = launchpadResult.length;

    return {
      updatedVolunteerOpportunities,
      updatedLaunchpadPosts,
      totalUpdates: updatedVolunteerOpportunities + updatedLaunchpadPosts,
    };
  } catch (error) {
    console.error("❌ Error running status update cron job:", error);
    throw error;
  }
}
