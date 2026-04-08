import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { city } from "../onboarding";
import { user } from "../user";
import { volunteerCategory } from "./volunteer-categories";

export const volunteerOpportunityStatus = pgEnum("volunteer_opportunity_status", [
  "DRAFT",
  "PUBLISHED",
  "ARCHIVED",
  "CLOSED",
]);

export const volunteerOpportunity = pgTable(
  "volunteer_opportunity",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => volunteerCategory.id),
    cityId: uuid("city_id")
      .notNull()
      .references(() => city.id),
    title: varchar("title", { length: 255 }).notNull(),
    overview: text("overview").notNull(),
    communityImpact: text("community_impact"),
    durationLabel: varchar("duration_label", { length: 120 }).notNull(),
    commitmentLabel: varchar("commitment_label", { length: 120 }).notNull(),
    applicationDeadline: timestamp("application_deadline", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    coverImageKey: varchar("cover_image_key", { length: 600 }).notNull(),
    coverImageUrl: text("cover_image_url"),
    benefits: jsonb("benefits")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    contactTelegramUsername: varchar("contact_telegram_username", {
      length: 120,
    }),
    contactEmail: varchar("contact_email", { length: 320 }).notNull(),
    contactPhone: varchar("contact_phone", { length: 40 }),
    contactWebsiteUrl: text("contact_website_url"),
    status: volunteerOpportunityStatus("status")
      .default("PUBLISHED")
      .notNull(),
    publishedAt: timestamp("published_at", {
      withTimezone: true,
      mode: "string",
    }).defaultNow(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => user.id),
    updatedBy: uuid("updated_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [
    index("volunteer_opportunity_category_idx").using("btree", table.categoryId),
    index("volunteer_opportunity_city_idx").using("btree", table.cityId),
    index("volunteer_opportunity_status_idx").using("btree", table.status),
    index("volunteer_opportunity_deadline_idx").using(
      "btree",
      table.applicationDeadline,
    ),
    index("volunteer_opportunity_created_by_idx").using(
      "btree",
      table.createdBy,
    ),
  ],
);

export const volunteerRole = pgTable(
  "volunteer_role",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => volunteerOpportunity.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    commitmentLabel: varchar("commitment_label", { length: 120 }).notNull(),
    capacity: integer("capacity").notNull(),
    responsibilities: jsonb("responsibilities")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    displayOrder: integer("display_order").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("volunteer_role_opportunity_idx").using("btree", table.opportunityId),
    index("volunteer_role_order_idx").using("btree", table.displayOrder),
  ],
);

export const volunteerRoleRequirement = pgTable(
  "volunteer_role_requirement",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    roleId: uuid("role_id")
      .notNull()
      .references(() => volunteerRole.id, { onDelete: "cascade" }),
    requirementText: text("requirement_text").notNull(),
    displayOrder: integer("display_order").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("volunteer_role_requirement_role_idx").using("btree", table.roleId),
    index("volunteer_role_requirement_order_idx").using(
      "btree",
      table.displayOrder,
    ),
  ],
);
