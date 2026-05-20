import {
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
import { launchpadCategory } from "./categories/categories";
import { city } from "../onboarding";
import { user } from "../user";
import { relations, sql } from "drizzle-orm";
import { launchpadRole } from "./roles/roles";

export const launchpadStatus = pgEnum("launchpad_status", [
  "DRAFT",
  "LIVE",
  "IN_PROGRESS",
  "COMPLETED",
]);

export const launchpad = pgTable(
  "launchpad",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    categoryId: uuid("category_id").references(() => launchpadCategory.id, {
      onDelete: "set null",
    }),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    cityId: uuid("city_id").references(() => city.id, {
      onDelete: "set null",
    }),
    deadline: timestamp("deadline", { withTimezone: true, mode: "string" }),
    logoKey: varchar("logo_key", { length: 255 }),
    coverKey: varchar("cover_key", { length: 255 }),
    documentKeys: jsonb("document_keys")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    documentNames: jsonb("document_names")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    phoneNumber: varchar("phone_number", { length: 20 }),
    email: varchar("email", { length: 255 }),
    telegramUsername: varchar("telegram_username", { length: 255 }),
    website: varchar("website", { length: 255 }),
    totalView: integer("total_view").notNull().default(0),
    status: launchpadStatus("status").default("LIVE").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    updatedBy: uuid("updated_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("launchpad_category_id_idx").using("btree", table.categoryId),
    index("launchpad_city_id_idx").using("btree", table.cityId),
    index("launchpad_status_idx").using("btree", table.status),
  ],
);

export const launchpadRelations = relations(launchpad, ({ one, many }) => ({
  category: one(launchpadCategory, {
    fields: [launchpad.categoryId],
    references: [launchpadCategory.id],
  }),
  city: one(city, {
    fields: [launchpad.cityId],
    references: [city.id],
  }),
  createdBy: one(user, {
    fields: [launchpad.createdBy],
    references: [user.id],
  }),
  roles: many(launchpadRole),
  launchpadSave: many(launchpadSave),
}));

export const launchpadSave = pgTable(
  "launchpad_save",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    launchpadId: uuid("launchpad_id")
      .notNull()
      .references(() => launchpad.id, { onDelete: "cascade" }),
    saverId: uuid("saver_id")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("launchpad_save_launchpad_saver_unique_idx").using(
      "btree",
      table.launchpadId,
      table.saverId,
    ),
    index("launchpad_save_launchpad_idx").using("btree", table.launchpadId),
    index("launchpad_save_saver_idx").using("btree", table.saverId),
  ],
);
