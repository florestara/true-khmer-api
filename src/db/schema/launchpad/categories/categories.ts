import {
  integer,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  uniqueIndex,
  varchar,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const launchpadCategoryStatus = pgEnum("launchpad_category_status", [
  "ACTIVE",
  "ARCHIVED",
  "HIDDEN",
]);

export const launchpadCategory = pgTable(
  "launchpad_category",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    iconKey: varchar("icon_key", { length: 100 }),
    displayOrder: integer("display_order").default(0).notNull(),
    status: launchpadCategoryStatus("status").default("ACTIVE").notNull(),
    totalRoles: integer("total_roles").default(0).notNull(),
    createdBy: uuid("created_by").notNull(),
    updatedBy: uuid("updated_by"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    archivedAt: timestamp("archived_at", {
      withTimezone: true,
      mode: "string",
    }),
  },
  (table) => [
    uniqueIndex("launchpad_category_slug_unique_idx").using(
      "btree",
      table.slug,
    ),
    uniqueIndex("launchpad_category_name_unique_idx").using(
      "btree",
      sql`lower(${table.name})`,
    ),
    index("launchpad_category_status_idx").using("btree", table.status),
    index("launchpad_category_order_idx").using("btree", table.displayOrder),
  ],
);
