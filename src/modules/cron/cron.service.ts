import { db } from "../../db/index";
import { volunteerOpportunity, launchpad } from "../../db/schema";
import { eq, and, lt, isNull } from "drizzle-orm";

export async function runStatusUpdateCron() {
  const now = new Date();
  const cambodiaTime = new Date(
    now.toLocaleString("en-US", {
      timeZone: "Asia/Phnom_Penh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }),
  );

  let updatedVolunteerOpportunities = 0;
  let updatedLaunchpadPosts = 0;

  try {
    const volunteerResult = await db
      .update(volunteerOpportunity)
      .set({
        status: "IN_PROGRESS",
        updatedAt: cambodiaTime.toISOString(),
      })
      .where(
        and(
          eq(volunteerOpportunity.status, "LIVE"),
          lt(
            volunteerOpportunity.applicationDeadline,
            cambodiaTime.toISOString(),
          ), // Compare with Cambodia time
          isNull(volunteerOpportunity.deletedAt),
        ),
      )
      .returning();

    updatedVolunteerOpportunities = volunteerResult.length;

    const launchpadResult = await db
      .update(launchpad)
      .set({
        status: "IN_PROGRESS",
        updatedAt: cambodiaTime.toISOString(),
      })
      .where(
        and(
          eq(launchpad.status, "LIVE"),
          lt(launchpad.deadline, cambodiaTime.toISOString()),
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
