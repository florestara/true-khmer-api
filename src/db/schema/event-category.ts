import {
  pgTable,
  pgEnum,
  index,
  uniqueIndex,
  uuid,
  varchar,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";

export const eventCategoryStatus = pgEnum("event_category_status", [
  "DRAFT",
  "ACTIVE",
  "INACTIVE",
  "DELETED",
]);

export const eventCategory = pgTable(
  "event_category",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    name: varchar({ length: 100 }).notNull(),
    slug: varchar({ length: 110 }).notNull(),
    description: varchar({ length: 500 }),
    icon: varchar({ length: 500 }),
    color: varchar({ length: 7 }),
    sortOrder: integer("sort_order").default(0),
    status: eventCategoryStatus().default("DRAFT").notNull(),
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("event_category_active_sort_idx").using(
      "btree",
      table.sortOrder.asc().nullsLast(),
    ),
    index("event_category_created_idx").using(
      "btree",
      table.createdAt.asc().nullsLast(),
    ),
    index("event_category_creator_idx").using(
      "btree",
      table.createdBy.asc().nullsLast(),
    ),
    uniqueIndex("event_category_slug_unique_idx").using(
      "btree",
      table.slug.asc().nullsLast(),
    ),
    index("event_category_sort_order_idx").using(
      "btree",
      table.sortOrder.asc().nullsLast(),
    ),
    index("event_category_status_idx").using(
      "btree",
      table.status.asc().nullsLast(),
    ),
    index("event_category_updated_idx").using(
      "btree",
      table.updatedAt.asc().nullsLast(),
    ),
  ],
);
