import { db } from "../index";
import { forumReportingType } from "../schema/forum";

const reportingTypes = [
  "Spam or misleading",
  "Harassment or hate speech",
  "Inappropriate content",
  "Self-promotion / Advertising",
  "Copyright violation",
  "Other",
];

export async function seedForumReportingTypes() {
  for (const type of reportingTypes) {
    await db
      .insert(forumReportingType)
      .values({ type })
      .onConflictDoNothing({ target: forumReportingType.type });
  }
}
