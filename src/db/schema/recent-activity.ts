import { relations, sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { user } from "./user";

export const recentActivity = pgTable(
  "recent_activity",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 100 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    targetType: varchar("target_type", { length: 100 }).notNull(),
    targetId: uuid("target_id").notNull(),
    referenceType: varchar("reference_type", { length: 100 }).notNull(),
    referenceId: uuid("reference_id").notNull(),
    data: jsonb("data")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("recent_activity_user_created_idx").using(
      "btree",
      table.userId,
      table.createdAt,
    ),
    index("recent_activity_type_idx").using("btree", table.type),
    index("recent_activity_target_idx").using(
      "btree",
      table.targetType,
      table.targetId,
    ),
    index("recent_activity_reference_idx").using(
      "btree",
      table.referenceType,
      table.referenceId,
    ),
  ],
);

export const recentActivityRelations = relations(recentActivity, ({ one }) => ({
  user: one(user, {
    fields: [recentActivity.userId],
    references: [user.id],
  }),
}));
