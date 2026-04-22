import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  integer,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "../user";
import { tier } from "../onboarding";

export const pointTransactionsActionType = pgEnum(
  "point_transactions_action_type",
  [
    "purchase_tk_merch",
    "purchase_marketplace",
    "purchase_new_merchant_bonus",
    "purchase_service",
    "leave_review",
    "merchant_verified",
    "course_published",
    "course_completed",
    "resource_approved",
    "forum_question_posted",
    "forum_first_question_bonus",
    "forum_participation",
    "forum_helpful_answer",
    "forum_best_answer",
    "forum_answer_upvotes",
    "forum_question_upvotes",
    "volunteer_opportunity_posted",
    "volunteer_registered",
    "volunteer_mission_completed",
    "volunteer_5star_bonus",
    "launchpad_completion_proposer",
    "launchpad_completion_participant",
    "launchpad_project_validated_proposer",
    "launchpad_project_validated_participant",
    "mentorship_session_mentor",
    "mentorship_session_mentee",
    "mentorship_5star_bonus",
    "mentorship_review_bonus",
    "event_attended_khmer_talk",
    "event_attended_networking",
    "event_attended_discover",
    "event_organised",
    "event_organised_rating_bonus",
    "khmer_talk_speaker",
    "referral_active_member",
    "welcome_profile_complete",
    "tier_advancement_bonus",
    "redemption_deduction",
  ],
);

export const pointTransactionsPool = pgEnum("point_transactions_pool", [
  "active",
  "legacy",
  "tier",
]);

export const pointTransactionsMode = pgEnum("point_transactions_mode", [
  "action",
  "support",
]);

export const pointSystemsMode = pgEnum("point_systems_mode", [
  "action",
  "support",
]);

export const pointSystems = pgTable(
  "point_systems",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    key: varchar("key").notNull(),
    value: integer("value").notNull().default(0),
    description: varchar("description"),
    maxPerDay: integer("max_per_day").notNull().default(1),
    mode: pointSystemsMode("mode").notNull().default("action"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("point_systems_key_unique_idx").using("btree", table.key),
  ],
);

export const pointTransactions = pgTable(
  "point_transactions",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    actionType: pointTransactionsActionType("action_type").notNull(),
    points: integer("points").notNull(),
    referenceType: varchar("reference_type"),
    referenceId: uuid("reference_id"),
    pool: pointTransactionsPool("pool").notNull().default("active"),
    mode: pointTransactionsMode("mode").notNull().default("action"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("point_transactions_user_id_idx").using("btree", table.userId),
  ],
);

export const tierHistory = pgTable(
  "tier_history",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    tierId: uuid("tier_id")
      .notNull()
      .references(() => tier.id, { onDelete: "cascade" }),
    achievedAt: timestamp("achieved_at").notNull().defaultNow(),
    pointsAtTime: integer("points_at_time").notNull(),
  },
  (table) => [
    index("tier_history_user_id_idx").using("btree", table.userId),
    index("tier_history_tier_id_idx").using("btree", table.tierId),
    uniqueIndex("tier_history_user_tier_unique_idx").on(
      table.userId,
      table.tierId,
    ),
  ],
);

export const pointTransactionsRelations = relations(
  pointTransactions,
  ({ one }) => ({
    user: one(user, {
      fields: [pointTransactions.userId],
      references: [user.id],
    }),
  }),
);

export const tierHistoryRelations = relations(tierHistory, ({ one }) => ({
  user: one(user, {
    fields: [tierHistory.userId],
    references: [user.id],
  }),
  tier: one(tier, {
    fields: [tierHistory.tierId],
    references: [tier.id],
  }),
}));
