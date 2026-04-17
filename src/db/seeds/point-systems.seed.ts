import { pointSystems } from "../schema/point_system/point-systems";
import { db } from "../index";
import { sql } from "drizzle-orm";

const POINT_SYSTEMS_SEED = [
  {
    key: "purchase_tk_merch",
    value: 10,
    description: "Purchase TK merch",
    maxPerDay: 0,
    mode: "support",
  },
  {
    key: "purchase_marketplace",
    value: 5,
    description: "Purchase marketplace product",
    maxPerDay: 0,
    mode: "support",
  },
  {
    key: "purchase_new_merchant_bonus",
    value: 10,
    description: "New merchant bonus (first purchase per merchant)",
    maxPerDay: 0,
    mode: "support",
  },
  {
    key: "purchase_service",
    value: 10,
    description: "Purchase service from Khmer provider",
    maxPerDay: 0,
    mode: "support",
  },
  {
    key: "leave_review",
    value: 2,
    description: "Leave product review",
    maxPerDay: 0,
    mode: "support",
  },
  {
    key: "merchant_verified",
    value: 50,
    description: "Merchant verification (one-time)",
    maxPerDay: 0,
    mode: "action",
  },
  {
    key: "course_published",
    value: 50,
    description: "Publish a course",
    maxPerDay: 0,
    mode: "action",
  },
  {
    key: "course_completed",
    value: 20,
    description: "Complete a course",
    maxPerDay: 0,
    mode: "support",
  },
  {
    key: "resource_approved",
    value: 25,
    description: "Upload approved library resource",
    maxPerDay: 0,
    mode: "action",
  },
  {
    key: "forum_question_posted",
    value: 1,
    description: "Post a forum question",
    maxPerDay: 5,
    mode: "action",
  },
  {
    key: "forum_first_question_bonus",
    value: 10,
    description: "First forum question bonus (after first reply)",
    maxPerDay: 0,
    mode: "action",
  },
  {
    key: "forum_participation",
    value: 1,
    description: "Forum first answer in thread",
    maxPerDay: 30,
    mode: "support",
  },
  {
    key: "forum_helpful_answer",
    value: 10,
    description: "Forum answer marked Helpful",
    maxPerDay: 30,
    mode: "support",
  },
  {
    key: "forum_best_answer",
    value: 25,
    description: "Forum answer marked Best Answer",
    maxPerDay: 0,
    mode: "support",
  },
  {
    key: "forum_answer_upvotes",
    value: 2,
    description: "Answer receives 10 community upvotes (+per 10)",
    maxPerDay: 0,
    mode: "support",
  },
  {
    key: "forum_question_upvotes",
    value: 2,
    description: "Question receives 10 community upvotes (+per 10)",
    maxPerDay: 0,
    mode: "action",
  },
  {
    key: "volunteer_opportunity_posted",
    value: 20,
    description: "Post a volunteer opportunity",
    maxPerDay: 0,
    mode: "action",
  },
  {
    key: "volunteer_registered",
    value: 5,
    description: "Register as a volunteer",
    maxPerDay: 0,
    mode: "support",
  },
  {
    key: "volunteer_mission_completed",
    value: 40,
    description: "Complete a volunteer mission",
    maxPerDay: 0,
    mode: "action",
  },
  {
    key: "volunteer_5star_bonus",
    value: 10,
    description: "Receive a 5-star rating as a volunteer",
    maxPerDay: 0,
    mode: "action",
  },
  {
    key: "launchpad_completion_proposer",
    value: 80,
    description: "Project completed - proposer",
    maxPerDay: 0,
    mode: "action",
  },
  {
    key: "launchpad_completion_participant",
    value: 40,
    description: "Project completed - participant",
    maxPerDay: 0,
    mode: "support",
  },
  {
    key: "launchpad_project_validated_proposer",
    value: 20,
    description: "Validate a launchpad project as a proposer",
    maxPerDay: 0,
    mode: "action",
  },
  {
    key: "launchpad_project_validated_participant",
    value: 10,
    description: "Validate a launchpad project as a participant",
    maxPerDay: 0,
    mode: "support",
  },
  {
    key: "mentorship_session_mentor",
    value: 40,
    description: "Mentor a session",
    maxPerDay: 0,
    mode: "action",
  },
  {
    key: "mentorship_session_mentee",
    value: 20,
    description: "Attend a mentorship session as a mentee",
    maxPerDay: 0,
    mode: "support",
  },
  {
    key: "mentorship_5star_bonus",
    value: 10,
    description: "5-star session rating (bonus)",
    maxPerDay: 0,
    mode: "action",
  },
  {
    key: "mentorship_review_bonus",
    value: 5,
    description: "Written session review (bonus)",
    maxPerDay: 0,
    mode: "action",
  },
  {
    key: "event_attended_khmer_talk",
    value: 15,
    description: "Attend a Khmer Talk event",
    maxPerDay: 0,
    mode: "support",
  },
  {
    key: "event_attended_networking",
    value: 10,
    description: "Attend a networking event",
    maxPerDay: 0,
    mode: "support",
  },
  {
    key: "event_attended_discover",
    value: 12,
    description: "Attend a Discover Khmer visit",
    maxPerDay: 0,
    mode: "support",
  },
  {
    key: "event_organised",
    value: 100,
    description: "Organize event",
    maxPerDay: 0,
    mode: "action",
  },
  {
    key: "event_organised_rating_bonus",
    value: 25,
    description: "Event 4+ star bonus",
    maxPerDay: 0,
    mode: "action",
  },
  {
    key: "khmer_talk_speaker",
    value: 50,
    description: "Speak at an event",
    maxPerDay: 0,
    mode: "action",
  },
  {
    key: "referral_active_member",
    value: 30,
    description: "Refer an active new member (completes onboarding)",
    maxPerDay: 0,
    mode: "action",
  },
  {
    key: "welcome_profile_complete",
    value: 50,
    description: "Complete onboarding process",
    maxPerDay: 0,
    mode: "action",
  },
  {
    key: "tier_advancement_bonus",
    value: 100,
    description: "3-tier system: Neary, Yothea, Reach",
    maxPerDay: 0,
    mode: "action",
  },
] satisfies Array<
  Pick<
    typeof pointSystems.$inferInsert,
    "key" | "value" | "description" | "maxPerDay" | "mode"
  >
>;

export async function seedPointSystems() {
  await db
    .insert(pointSystems)
    .values(POINT_SYSTEMS_SEED)
    .onConflictDoUpdate({
      target: pointSystems.key,
      set: {
        value: sql`excluded.value`,
        description: sql`excluded.description`,
        maxPerDay: sql`excluded.max_per_day`,
      },
    });
}
