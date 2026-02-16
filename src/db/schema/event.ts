import {
  pgTable,
  pgEnum,
  index,
  uniqueIndex,
  uuid,
  varchar,
  text,
  jsonb,
  timestamp,
  integer,
  numeric,
  char,
  boolean,
} from "drizzle-orm/pg-core";

export const eventStatus = pgEnum("event_status", [
  "DRAFT",
  "PUBLISHED",
  "COMPLETED",
  "CANCELLED",
  "POSTPONED",
  "ACTIVE",
  "ARCHIVED",
]);

export const eventType = pgEnum("event_type", [
  "CONFERENCE",
  "WORKSHOP",
  "SEMINAR",
  "CONCERT",
  "FESTIVAL",
  "EXHIBITION",
  "NETWORKING",
  "TRAINING",
  "WEBINAR",
  "OTHER",
]);

export const eventTicketStatus = pgEnum("event_ticket_status", [
  "AVAILABLE",
  "ALMOST_FULL",
  "SOLD_OUT",
  "WAITING_LIST",
]);

export const eventVisibility = pgEnum("event_visibility", [
  "LISTED",
  "UNLISTED",
]);

export const eventRegistrationMode = pgEnum("event_registration_mode", [
  "ANYONE",
  "REQUIRED_APPROVAL",
  "INVITED_GUESTS_ONLY",
]);

export const eventEntryMode = pgEnum("event_entry_mode", [
  "TICKETED",
  "RSVP",
  "OPEN_ACCESS",
]);

export const event = pgTable(
  "event",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    createdBy: uuid("created_by").notNull(),
    updatedBy: uuid("updated_by"),
    title: varchar({ length: 255 }).notNull(),
    slug: varchar({ length: 255 }).notNull(),
    subTitle: varchar("sub_title", { length: 255 }),
    description: text(),
    excerpt: varchar({ length: 500 }).notNull(),
    cover: varchar({ length: 500 }),
    photos: jsonb(),
    startAt: timestamp("start_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    endAt: timestamp("end_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    registrationStartAt: timestamp("registration_start_at", {
      withTimezone: true,
      mode: "string",
    }),
    registrationEndAt: timestamp("registration_end_at", {
      withTimezone: true,
      mode: "string",
    }),
    agenda: jsonb(),
    organizerInfo: jsonb("organizer_info"),
    speakers: jsonb(),
    sponsors: jsonb(),
    eventType: eventType("event_type").default("OTHER"),
    venueId: uuid("venue_id"),
    onlineUrl: varchar("online_url", { length: 500 }),
    meetingId: varchar("meeting_id", { length: 100 }),
    meetingPassword: varchar("meeting_password", { length: 100 }),
    maxAttendees: integer("max_attendees"),
    minAttendees: integer("min_attendees").default(1),
    currentAttendees: integer("current_attendees").default(0),
    basePrice: numeric("base_price", { precision: 12, scale: 2 }),
    currencyCode: char("currency_code", { length: 3 }).default("USD"),
    qr: varchar({ length: 500 }),
    trackingCode: varchar("tracking_code", { length: 100 }),
    status: eventStatus().default("DRAFT").notNull(),
    isOnline: boolean("is_online").default(false).notNull(),
    isHybrid: boolean("is_hybrid").default(false).notNull(),
    isFeatured: boolean("is_featured").default(false).notNull(),
    isRecurring: boolean("is_recurring").default(false).notNull(),
    isPaid: boolean("is_paid").default(false).notNull(),
    isPrivate: boolean("is_private").default(false).notNull(),
    requiresApproval: boolean("requires_approval").default(false).notNull(),
    publishedAt: timestamp("published_at", {
      withTimezone: true,
      mode: "string",
    }),
    archivedAt: timestamp("archived_at", {
      withTimezone: true,
      mode: "string",
    }),
    viewCount: integer("view_count").default(0),
    metaTitle: varchar("meta_title", { length: 60 }),
    metaDescription: varchar("meta_description", { length: 160 }),
    socialImage: varchar("social_image", { length: 500 }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    venue: jsonb(),
    venueName: varchar("venue_name", { length: 255 }),
    salePrice: numeric("sale_price", { precision: 12, scale: 2 }),
    ticketStatus: eventTicketStatus("ticket_status")
      .default("AVAILABLE")
      .notNull(),
    thumbnail: varchar({ length: 500 }),
    organizationId: uuid("organization_id"),
    visibility: eventVisibility().default("LISTED").notNull(),
    registrationMode: eventRegistrationMode("registration_mode")
      .default("ANYONE")
      .notNull(),
    entryMode: eventEntryMode("entry_mode").default("TICKETED").notNull(),
  },
  (table) => [
    index("event_status_idx").using("btree", table.status),
    index("event_start_at_idx").using("btree", table.startAt),
    index("event_end_at_idx").using("btree", table.endAt),
    index("event_created_by_idx").using("btree", table.createdBy),
    index("event_organization_idx").using("btree", table.organizationId),
    index("event_type_idx").using("btree", table.eventType),
    index("event_visibility_idx").using("btree", table.visibility),
    uniqueIndex("event_slug_unique_idx").using("btree", table.slug),
  ],
);
