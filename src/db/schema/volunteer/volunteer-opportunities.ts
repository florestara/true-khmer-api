import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { city } from "../onboarding";
import { user } from "../user";
import { applicationDeclinedByEnum } from "../application";
import { volunteerCategory } from "./volunteer-categories";

export const volunteerOpportunityStatus = pgEnum("volunteer_opportunity_status", [
  "DRAFT",
  "ACTIVE",
  "CLOSED",
  "COMPLETED",
]);

export const volunteerApplicationStatus = pgEnum("volunteer_application_status", [
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "DECLINED",
  "CONFIRMED",
  "COMPLETED",
  "WITHDRAWN",
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
    startDate: date("start_date", { mode: "string" }),
    endDate: date("end_date", { mode: "string" }),
    commitmentLabel: varchar("commitment_label", { length: 120 }),
    commitmentDescription: text("commitment_description"),
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
    totalView: integer("total_view").notNull().default(0),
    filled: boolean("filled").default(false).notNull(),
    status: volunteerOpportunityStatus("status")
      .default("ACTIVE")
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

export const volunteerOpportunitySave = pgTable(
  "volunteer_opportunity_save",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => volunteerOpportunity.id, { onDelete: "cascade" }),
    saverId: uuid("saver_id")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("volunteer_opportunity_save_opportunity_saver_unique_idx").using(
      "btree",
      table.opportunityId,
      table.saverId,
    ),
    index("volunteer_opportunity_save_opportunity_idx").using(
      "btree",
      table.opportunityId,
    ),
    index("volunteer_opportunity_save_saver_idx").using(
      "btree",
      table.saverId,
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
    uniqueIndex("volunteer_role_id_opportunity_unique_idx").on(
      table.id,
      table.opportunityId,
    ),
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

export const volunteerApplication = pgTable(
  "volunteer_application",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => volunteerOpportunity.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => volunteerRole.id, { onDelete: "cascade" }),
    applicantId: uuid("applicant_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    availability: text("availability").notNull(),
    relevantExperience: text("relevant_experience").notNull(),
    supportingDocuments: jsonb("supporting_documents")
      .$type<Array<{ name: string; key: string }>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    status: volunteerApplicationStatus("status")
      .default("SUBMITTED")
      .notNull(),
    archived: boolean("archived").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "volunteer_application_role_opportunity_match_fk",
      columns: [table.roleId, table.opportunityId],
      foreignColumns: [volunteerRole.id, volunteerRole.opportunityId],
    }).onDelete("cascade"),
    check(
      "volunteer_application_supporting_documents_array_check",
      sql`jsonb_typeof(${table.supportingDocuments}) = 'array'`,
    ),
    uniqueIndex("volunteer_application_applicant_role_active_unique_idx")
      .on(table.applicantId, table.roleId)
      .where(
        sql`${table.status} in ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'CONFIRMED', 'COMPLETED')`,
      ),
    index("volunteer_application_opportunity_idx").using(
      "btree",
      table.opportunityId,
    ),
    index("volunteer_application_opportunity_status_idx").using(
      "btree",
      table.opportunityId,
      table.status,
    ),
    index("volunteer_application_role_idx").using("btree", table.roleId),
    index("volunteer_application_applicant_idx").using(
      "btree",
      table.applicantId,
    ),
    index("volunteer_application_status_idx").using("btree", table.status),
  ],
);

export const volunteerApplicationLog = pgTable(
  "volunteer_application_log",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    volunteerApplicationId: uuid("volunteer_application_id")
      .notNull()
      .references(() => volunteerApplication.id, {
        onDelete: "cascade",
      }),
    status: volunteerApplicationStatus("status")
      .default("SUBMITTED")
      .notNull(),
    declinedBy: applicationDeclinedByEnum("declined_by"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("volunteer_application_log_application_id_idx").using(
      "btree",
      table.volunteerApplicationId,
    ),
    index("volunteer_application_log_created_by_idx").using(
      "btree",
      table.createdBy,
    ),
  ],
);

export const volunteerApplicationRelations = relations(
  volunteerApplication,
  ({ many }) => ({
    logs: many(volunteerApplicationLog),
  }),
);

export const volunteerApplicationLogRelations = relations(
  volunteerApplicationLog,
  ({ one }) => ({
    application: one(volunteerApplication, {
      fields: [volunteerApplicationLog.volunteerApplicationId],
      references: [volunteerApplication.id],
    }),
  }),
);
