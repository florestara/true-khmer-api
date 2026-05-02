import { relations } from "drizzle-orm";
import {
  index,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { user } from "./user";

export const socialLinkPlatform = pgEnum("social_link_platform", [
  "website",
  "linkedin",
  "twitter",
  "facebook",
]);

export const skill = pgTable(
  "skill",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 80 }).notNull(),
    normalizedName: varchar("normalized_name", { length: 80 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("skill_normalized_name_unique_idx").on(table.normalizedName),
    index("skill_name_idx").on(table.name),
  ],
);

export const userSkill = pgTable(
  "user_skill",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    skillId: uuid("skill_id")
      .notNull()
      .references(() => skill.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("user_skill_user_skill_unique_idx").on(
      table.userId,
      table.skillId,
    ),
    index("user_skill_user_id_idx").on(table.userId),
    index("user_skill_skill_id_idx").on(table.skillId),
  ],
);

export const userSocialLink = pgTable(
  "user_social_link",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    platform: socialLinkPlatform("platform").notNull(),
    url: varchar("url", { length: 500 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("user_social_link_user_platform_unique_idx").on(
      table.userId,
      table.platform,
    ),
    index("user_social_link_user_id_idx").on(table.userId),
  ],
);

export const skillRelations = relations(skill, ({ many }) => ({
  userSkills: many(userSkill),
}));

export const userSkillRelations = relations(userSkill, ({ one }) => ({
  user: one(user, {
    fields: [userSkill.userId],
    references: [user.id],
  }),
  skill: one(skill, {
    fields: [userSkill.skillId],
    references: [skill.id],
  }),
}));

export const userSocialLinkRelations = relations(userSocialLink, ({ one }) => ({
  user: one(user, {
    fields: [userSocialLink.userId],
    references: [user.id],
  }),
}));
