import {
  pgTable,
  pgEnum,
  index,
  uniqueIndex,
  foreignKey,
  uuid,
  varchar,
  integer,
  numeric,
  char,
  boolean,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";
import { event } from "./event";

export const ticketTierStatus = pgEnum("ticket_tier_status", [
  "DRAFT",
  "ACTIVE",
  "PAUSED",
  "SOLD_OUT",
  "EXPIRED",
  "CANCELLED",
]);

export const ticketTierType = pgEnum("ticket_tier_type", [
  "FREE",
  "PAID",
  "DONATION",
  "VIP",
  "EARLY_BIRD",
  "GROUP",
  "STUDENT",
]);

export const ticketTier = pgTable(
  "ticket_tier",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    name: varchar({ length: 100 }).notNull(),
    slug: varchar({ length: 110 }).notNull(),
    description: varchar({ length: 500 }),
    eventId: uuid("event_id").notNull(),
    type: ticketTierType().default("FREE").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    isVisible: boolean("is_visible").default(true).notNull(),
    sortOrder: integer("sort_order").default(0),
    totalQuantity: integer("total_quantity").default(0).notNull(),
    soldCount: integer("sold_count").default(0).notNull(),
    reservedCount: integer("reserved_count").default(0).notNull(),
    availableCount: integer("available_count").default(0).notNull(),
    minPurchase: integer("min_purchase").default(1).notNull(),
    maxPurchase: integer("max_purchase").default(10).notNull(),
    maxPerUser: integer("max_per_user").default(5).notNull(),
    basePrice: numeric("base_price", { precision: 12, scale: 2 })
      .default("0.00")
      .notNull(),
    salePrice: numeric("sale_price", { precision: 12, scale: 2 }),
    currencyCode: char({ length: 3 }).default("USD").notNull(),
    saleStartAt: timestamp("sale_start_at", {
      withTimezone: true,
      mode: "string",
    }),
    saleEndAt: timestamp("sale_end_at", {
      withTimezone: true,
      mode: "string",
    }),
    validFrom: timestamp("valid_from", {
      withTimezone: true,
      mode: "string",
    }),
    validUntil: timestamp("valid_until", {
      withTimezone: true,
      mode: "string",
    }),
    status: ticketTierStatus().default("DRAFT").notNull(),
    requiredInfo: jsonb("required_info"),
    benefits: jsonb(),
    restrictions: jsonb(),
    cover: varchar({ length: 500 }),
    badge: varchar({ length: 500 }),
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
    index("ticket_tier_active_idx").using(
      "btree",
      table.isActive.asc().nullsLast(),
    ),
    index("ticket_tier_availability_idx").using(
      "btree",
      table.availableCount.asc().nullsLast(),
    ),
    index("ticket_tier_created_idx").using(
      "btree",
      table.createdAt.asc().nullsLast(),
    ),
    index("ticket_tier_creator_idx").using(
      "btree",
      table.createdBy.asc().nullsLast(),
    ),
    index("ticket_tier_event_active_idx").using(
      "btree",
      table.eventId.asc().nullsLast(),
      table.isActive.asc().nullsLast(),
    ),
    index("ticket_tier_event_idx").using(
      "btree",
      table.eventId.asc().nullsLast(),
    ),
    index("ticket_tier_event_sort_idx").using(
      "btree",
      table.eventId.asc().nullsLast(),
      table.sortOrder.asc().nullsLast(),
    ),
    index("ticket_tier_event_status_idx").using(
      "btree",
      table.eventId.asc().nullsLast(),
      table.status.asc().nullsLast(),
    ),
    index("ticket_tier_price_range_idx").using(
      "btree",
      table.basePrice.asc().nullsLast(),
      table.salePrice.asc().nullsLast(),
    ),
    index("ticket_tier_sale_period_idx").using(
      "btree",
      table.saleStartAt.asc().nullsLast(),
      table.saleEndAt.asc().nullsLast(),
    ),
    uniqueIndex("ticket_tier_slug_event_unique_idx").using(
      "btree",
      table.eventId.asc().nullsLast(),
      table.slug.asc().nullsLast(),
    ),
    index("ticket_tier_sold_count_idx").using(
      "btree",
      table.soldCount.asc().nullsLast(),
    ),
    index("ticket_tier_sort_order_idx").using(
      "btree",
      table.sortOrder.asc().nullsLast(),
    ),
    index("ticket_tier_status_idx").using(
      "btree",
      table.status.asc().nullsLast(),
    ),
    index("ticket_tier_type_idx").using("btree", table.type.asc().nullsLast()),
    index("ticket_tier_type_status_idx").using(
      "btree",
      table.type.asc().nullsLast(),
      table.status.asc().nullsLast(),
    ),
    index("ticket_tier_updated_idx").using(
      "btree",
      table.updatedAt.asc().nullsLast(),
    ),
    index("ticket_tier_validity_period_idx").using(
      "btree",
      table.validFrom.asc().nullsLast(),
      table.validUntil.asc().nullsLast(),
    ),
    index("ticket_tier_visible_idx").using(
      "btree",
      table.isVisible.asc().nullsLast(),
    ),
    foreignKey({
      columns: [table.eventId],
      foreignColumns: [event.id],
      name: "ticket_tier_event_id_event_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("restrict"),
  ],
);
