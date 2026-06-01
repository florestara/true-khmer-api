import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./user";

export const notification = pgTable(
  "notification",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    imageUrl: text("image_url"),
    type: text("type").notNull().default("system"),
    eventType: text("event_type"),
    dedupeKey: text("dedupe_key"),
    aggregateCount: integer("aggregate_count").default(1).notNull(),
    data: jsonb("data").$type<Record<string, string>>(),
    webRoute: text("web_route"),
    mobileRoute: text("mobile_route"),
    isRead: boolean("is_read").default(false).notNull(),
    readAt: timestamp("read_at"),
    archived: boolean("archived").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("notification_userId_idx").on(table.userId),
    index("notification_user_dedupe_idx").on(table.userId, table.dedupeKey),
    uniqueIndex("notification_unread_dedupe_unique_idx")
      .on(table.userId, table.dedupeKey)
      .where(
        sql`${table.dedupeKey} is not null and ${table.isRead} = false and ${table.archived} = false`,
      ),
  ],
);

export const notificationRelations = relations(notification, ({ one }) => ({
  user: one(user, { fields: [notification.userId], references: [user.id] }),
}));
