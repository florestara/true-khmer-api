import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const volunteerCategoryStatus = pgEnum("volunteer_category_status", [
  "ACTIVE",
  "ARCHIVED",
  "HIDDEN",
]);

export const volunteerCategory = pgTable(
  "volunteer_category",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    iconKey: varchar("icon_key", { length: 100 }),
    displayOrder: integer("display_order").default(0).notNull(),
    status: volunteerCategoryStatus("status").default("ACTIVE").notNull(),
    createdBy: uuid("created_by").notNull(),
    updatedBy: uuid("updated_by"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [
    uniqueIndex("volunteer_category_slug_unique_idx").using("btree", table.slug),
    uniqueIndex("volunteer_category_name_unique_idx").using(
      "btree",
      sql`lower(${table.name})`,
    ),
    index("volunteer_category_status_idx").using("btree", table.status),
    index("volunteer_category_order_idx").using("btree", table.displayOrder),
  ],
);
