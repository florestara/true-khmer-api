import {
  pgTable,
  index,
  uniqueIndex,
  uuid,
  varchar,
  text,
  numeric,
  char,
  boolean,
  smallint,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";

export const venue = pgTable(
  "venue",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
    name: varchar({ length: 255 }).notNull(),
    slug: varchar({ length: 255 }).notNull(),
    description: text(),
    email: varchar({ length: 320 }),
    phone: varchar({ length: 20 }),
    website: varchar({ length: 500 }),
    address: text().notNull(),
    city: varchar({ length: 100 }).notNull(),
    countryCode: char("country_code", { length: 2 }).default("KH").notNull(),
    latitude: numeric({ precision: 10, scale: 8 }),
    longitude: numeric({ precision: 11, scale: 8 }),
    locationUrl: varchar("location_url", { length: 500 }),
    maxCapacity: smallint("max_capacity"),
    minCapacity: smallint("min_capacity"),
    amenities: jsonb(),
    cover: varchar({ length: 500 }),
    images: jsonb(),
    floorPlan: varchar("floor_plan", { length: 500 }),
    basePrice: numeric("base_price", { precision: 12, scale: 2 }),
    currency: char({ length: 3 }).default("USD").notNull(),
    pricingModel: varchar("pricing_model", { length: 20 })
      .default("hourly")
      .notNull(),
    isVerified: boolean("is_verified").default(false).notNull(),
    verifiedAt: timestamp("verified_at", {
      withTimezone: true,
      mode: "string",
    }),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("venue_active_verified_idx").using(
      "btree",
      table.isActive.asc().nullsLast(),
      table.isVerified.asc().nullsLast(),
    ),
    index("venue_capacity_idx").using(
      "btree",
      table.maxCapacity.asc().nullsLast(),
    ),
    index("venue_city_active_idx").using(
      "btree",
      table.city.asc().nullsLast(),
      table.isActive.asc().nullsLast(),
    ),
    index("venue_city_country_idx").using(
      "btree",
      table.city.asc().nullsLast(),
      table.countryCode.asc().nullsLast(),
    ),
    index("venue_created_at_idx").using(
      "btree",
      table.createdAt.asc().nullsLast(),
    ),
    index("venue_created_by_idx").using(
      "btree",
      table.createdBy.asc().nullsLast(),
    ),
    index("venue_location_idx").using(
      "btree",
      table.latitude.asc().nullsLast(),
      table.longitude.asc().nullsLast(),
    ),
    index("venue_price_currency_idx").using(
      "btree",
      table.basePrice.asc().nullsLast(),
      table.currency.asc().nullsLast(),
    ),
    uniqueIndex("venue_slug_unique_idx").using(
      "btree",
      table.slug.asc().nullsLast(),
    ),
  ],
);
