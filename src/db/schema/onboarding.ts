import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { user } from "./user";

export const country = pgTable(
  "country",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    normalizedName: varchar("normalized_name", { length: 120 }).notNull(),
    iso2: varchar("iso2", { length: 2 }),
    provider: varchar("provider", { length: 40 }).default("countriesnow").notNull(),
    providerRef: varchar("provider_ref", { length: 120 }),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("country_normalized_name_unique_idx").on(table.normalizedName),
    index("country_name_idx").on(table.name),
  ],
);

export const city = pgTable(
  "city",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    countryId: uuid("country_id")
      .notNull()
      .references(() => country.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    normalizedName: varchar("normalized_name", { length: 120 }).notNull(),
    provider: varchar("provider", { length: 40 }).default("countriesnow").notNull(),
    providerRef: varchar("provider_ref", { length: 120 }),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("city_country_normalized_name_unique_idx").on(
      table.countryId,
      table.normalizedName,
    ),
    uniqueIndex("city_country_id_id_unique_idx").on(table.countryId, table.id),
    index("city_country_idx").on(table.countryId),
    index("city_name_idx").on(table.name),
  ],
);

export const userProfile = pgTable(
  "user_profile",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    displayName: varchar("display_name", { length: 200 }),
    avatarKey: varchar("avatar_key", { length: 600 }),
    avatarUrl: text("avatar_url"),
    bio: text("bio"),
    countryId: uuid("country_id").references(() => country.id, {
      onDelete: "set null",
    }),
    cityId: uuid("city_id").references(() => city.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("user_profile_user_id_unique_idx").on(table.userId),
    index("user_profile_country_id_idx").on(table.countryId),
    index("user_profile_city_id_idx").on(table.cityId),
  ],
);

export const interest = pgTable(
  "interest",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: varchar("slug", { length: 80 }).notNull(),
    label: varchar("label", { length: 120 }).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("interest_slug_unique_idx").on(table.slug),
    uniqueIndex("interest_label_unique_idx").on(table.label),
    index("interest_active_idx").on(table.isActive),
  ],
);

export const userInterest = pgTable(
  "user_interest",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    interestId: uuid("interest_id")
      .notNull()
      .references(() => interest.id, { onDelete: "cascade" }),
    selectedAt: timestamp("selected_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("user_interest_user_interest_unique_idx").on(
      table.userId,
      table.interestId,
    ),
    index("user_interest_user_id_idx").on(table.userId),
    index("user_interest_interest_id_idx").on(table.interestId),
  ],
);

export const contribution = pgTable(
  "contribution",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: varchar("slug", { length: 80 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("contribution_slug_unique_idx").on(table.slug),
    uniqueIndex("contribution_name_unique_idx").on(table.name),
    index("contribution_active_idx").on(table.isActive),
  ],
);

export const userContribution = pgTable(
  "user_contribution",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    contributionId: uuid("contribution_id")
      .notNull()
      .references(() => contribution.id, { onDelete: "cascade" }),
    selectedAt: timestamp("selected_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("user_contribution_user_contribution_unique_idx").on(
      table.userId,
      table.contributionId,
    ),
    index("user_contribution_user_id_idx").on(table.userId),
    index("user_contribution_contribution_id_idx").on(table.contributionId),
  ],
);

export const tier = pgTable(
  "tier",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: varchar("slug", { length: 80 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    rankOrder: integer("rank_order").notNull(),
    minPoints: integer("min_points").default(0).notNull(),
    description: text("description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("tier_slug_unique_idx").on(table.slug),
    uniqueIndex("tier_rank_order_unique_idx").on(table.rankOrder),
    uniqueIndex("tier_min_points_unique_idx").on(table.minPoints),
  ],
);

export const userPointLedger = pgTable(
  "user_point_ledger",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    pointsDelta: integer("points_delta").notNull(),
    actionType: varchar("action_type", { length: 80 }).notNull(),
    eventKey: varchar("event_key", { length: 120 }),
    referenceType: varchar("reference_type", { length: 80 }),
    referenceId: varchar("reference_id", { length: 120 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("user_point_ledger_event_key_unique_idx").on(table.eventKey),
    index("user_point_ledger_user_id_idx").on(table.userId),
    index("user_point_ledger_action_type_idx").on(table.actionType),
  ],
);

export const userProgress = pgTable(
  "user_progress",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    totalPoints: integer("total_points").default(0).notNull(),
    currentTierId: uuid("current_tier_id").references(() => tier.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("user_progress_current_tier_id_idx").on(table.currentTierId)],
);

export const countryRelations = relations(country, ({ many }) => ({
  cities: many(city),
  userProfiles: many(userProfile),
}));

export const cityRelations = relations(city, ({ one, many }) => ({
  country: one(country, {
    fields: [city.countryId],
    references: [country.id],
  }),
  userProfiles: many(userProfile),
}));

export const userProfileRelations = relations(userProfile, ({ one }) => ({
  user: one(user, {
    fields: [userProfile.userId],
    references: [user.id],
  }),
  country: one(country, {
    fields: [userProfile.countryId],
    references: [country.id],
  }),
  city: one(city, {
    fields: [userProfile.cityId],
    references: [city.id],
  }),
}));

export const interestRelations = relations(interest, ({ many }) => ({
  userInterests: many(userInterest),
}));

export const userInterestRelations = relations(userInterest, ({ one }) => ({
  user: one(user, {
    fields: [userInterest.userId],
    references: [user.id],
  }),
  interest: one(interest, {
    fields: [userInterest.interestId],
    references: [interest.id],
  }),
}));

export const contributionRelations = relations(contribution, ({ many }) => ({
  userContributions: many(userContribution),
}));

export const userContributionRelations = relations(
  userContribution,
  ({ one }) => ({
    user: one(user, {
      fields: [userContribution.userId],
      references: [user.id],
    }),
    contribution: one(contribution, {
      fields: [userContribution.contributionId],
      references: [contribution.id],
    }),
  }),
);

export const tierRelations = relations(tier, ({ many }) => ({
  userProgressRows: many(userProgress),
}));

export const userPointLedgerRelations = relations(userPointLedger, ({ one }) => ({
  user: one(user, {
    fields: [userPointLedger.userId],
    references: [user.id],
  }),
}));

export const userProgressRelations = relations(userProgress, ({ one }) => ({
  user: one(user, {
    fields: [userProgress.userId],
    references: [user.id],
  }),
  currentTier: one(tier, {
    fields: [userProgress.currentTierId],
    references: [tier.id],
  }),
}));
