import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./user";

export const fcmTokenPlatform = pgEnum("fcm_token_platform", [
  "web",
  "android",
  "ios",
]);

export const fcmToken = pgTable(
  "fcm_token",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    platform: fcmTokenPlatform("platform").default("web").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("fcm_token_userId_idx").on(table.userId),
    unique("fcm_token_unique").on(table.token),
  ],
);

export const fcmTokenRelations = relations(fcmToken, ({ one }) => ({
  user: one(user, { fields: [fcmToken.userId], references: [user.id] }),
}));
