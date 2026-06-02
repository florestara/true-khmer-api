import { relations } from "drizzle-orm";
import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { user } from "../user";

export const badgeCategory = pgEnum("badge_category", [
  "ONBOARDING",
  "COLLABORATION",
  "KNOWLEDGE",
  "VOLUNTEER",
  "LAUNCHPAD",
]);

export const badge = pgTable(
  "badge",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: varchar("slug", { length: 80 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description").notNull(),
    category: badgeCategory("category").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("badge_slug_unique_idx").on(table.slug)],
);

export const userBadge = pgTable(
  "user_badge",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    badgeId: uuid("badge_id")
      .notNull()
      .references(() => badge.id, { onDelete: "cascade" }),
    awardedAt: timestamp("awarded_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("user_badge_user_id_badge_id_unique_idx").on(
      table.userId,
      table.badgeId,
    ),
    index("user_badge_user_id_idx").on(table.userId),
    index("user_badge_badge_id_idx").on(table.badgeId),
  ],
);

export const badgeRelations = relations(badge, ({ many }) => ({
  userBadges: many(userBadge),
}));

export const userBadgeRelations = relations(userBadge, ({ one }) => ({
  user: one(user, {
    fields: [userBadge.userId],
    references: [user.id],
  }),
  badge: one(badge, {
    fields: [userBadge.badgeId],
    references: [badge.id],
  }),
}));
