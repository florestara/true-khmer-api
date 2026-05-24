import { CronJob } from "cron";
import { runStatusUpdateCron } from "./cron.service";

let isRunning = false;

export const startCronScheduler = () =>
  new CronJob(
    "0 0 * * *", // cronTime
    async function () {
      if (isRunning) {
        console.log("⏳ Cron job is still running, skipping this tick.");
        return;
      }
      isRunning = true;
      try {
        const result = await runStatusUpdateCron();
        console.log(
          `✅ Cron job completed: ${result.updatedVolunteerOpportunities} volunteer opportunities and ${result.updatedLaunchpadPosts} launchpad posts updated to IN_PROGRESS.`,
        );
      } catch (error) {
        console.error("❌ Error in cron job:", error);
      } finally {
        isRunning = false;
      }
    }, // onTick
    null, // onComplete
    true, // start
    "Asia/Phnom_Penh", // timeZone
  );
