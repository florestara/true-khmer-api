import { pgTable, index, uniqueIndex, foreignKey, uuid, varchar, text, jsonb, timestamp, integer, numeric, char, boolean, smallint, pgSequence, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const accessLevel = pgEnum("access_level", ['VIEW_ONLY', 'LIMITED', 'STANDARD', 'ADMIN', 'FULL'])
export const eventCategoryStatus = pgEnum("event_category_status", ['DRAFT', 'ACTIVE', 'INACTIVE', 'DELETED'])
export const eventEntryMode = pgEnum("event_entry_mode", ['TICKETED', 'RSVP', 'OPEN_ACCESS'])
export const eventRegistrationMode = pgEnum("event_registration_mode", ['ANYONE', 'REQUIRED_APPROVAL', 'INVITED_GUESTS_ONLY'])
export const eventStaffRole = pgEnum("event_staff_role", ['ORGANIZER', 'CO_ORGANIZER', 'SPEAKER', 'MODERATOR', 'VOLUNTEER', 'CHECK_IN', 'SUPPORT', 'MEDIA', 'SECURITY', 'VENDOR', 'SPONSOR_REP', 'PHOTOGRAPHER', 'VIDEOGRAPHER', 'TECHNICAL', 'OTHER'])
export const eventStaffStatus = pgEnum("event_staff_status", ['INVITED', 'PENDING', 'ACCEPTED', 'DECLINED', 'ACTIVE', 'INACTIVE', 'REMOVED'])
export const eventStatus = pgEnum("event_status", ['DRAFT', 'PUBLISHED', 'COMPLETED', 'CANCELLED', 'POSTPONED', 'ACTIVE', 'ARCHIVED'])
export const eventTicketStatus = pgEnum("event_ticket_status", ['AVAILABLE', 'ALMOST_FULL', 'SOLD_OUT', 'WAITING_LIST'])
export const eventType = pgEnum("event_type", ['CONFERENCE', 'WORKSHOP', 'SEMINAR', 'CONCERT', 'FESTIVAL', 'EXHIBITION', 'NETWORKING', 'TRAINING', 'WEBINAR', 'OTHER'])
export const eventVisibility = pgEnum("event_visibility", ['LISTED', 'UNLISTED'])
export const gender = pgEnum("gender", ['MALE', 'FEMALE', 'OTHER'])
export const orderStatus = pgEnum("order_status", ['DRAFT', 'PENDING', 'CONFIRMED', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'REFUNDED', 'EXPIRED'])
export const organizationInvitationStatus = pgEnum("organization_invitation_status", ['PENDING', 'ACCEPTED', 'DECLINED', 'REVOKED', 'EXPIRED'])
export const organizationMemberRole = pgEnum("organization_member_role", ['OWNER', 'ADMIN', 'MANAGER', 'EDITOR', 'MEMBER'])
export const organizationMemberStatus = pgEnum("organization_member_status", ['ACTIVE', 'INVITED', 'REJECTED', 'LEFT', 'REVOKED'])
export const organizationType = pgEnum("organization_type", ['COMPANY', 'NGO'])
export const paymentGateway = pgEnum("payment_gateway", ['PAYWAY', 'PAYPAL', 'STRIPE', 'CASH', 'BANK_TRANSFER', 'CRYPTO'])
export const paymentStatus = pgEnum("payment_status", ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED'])
export const promotionScope = pgEnum("promotion_scope", ['EVENT', 'TICKET_TIER', 'GLOBAL', 'USER_SPECIFIC'])
export const promotionStatus = pgEnum("promotion_status", ['DRAFT', 'ACTIVE', 'PAUSED', 'EXPIRED', 'CANCELLED', 'USED_UP'])
export const promotionType = pgEnum("promotion_type", ['PERCENTAGE', 'FIXED_AMOUNT', 'BUY_X_GET_Y', 'FREE_SHIPPING', 'EARLY_BIRD', 'BULK_DISCOUNT'])
export const ticketTierStatus = pgEnum("ticket_tier_status", ['DRAFT', 'ACTIVE', 'PAUSED', 'SOLD_OUT', 'EXPIRED', 'CANCELLED'])
export const ticketTierType = pgEnum("ticket_tier_type", ['FREE', 'PAID', 'DONATION', 'VIP', 'EARLY_BIRD', 'GROUP', 'STUDENT'])
export const tokenNoncePurpose = pgEnum("token_nonce_purpose", ['VERIFY_EMAIL', 'RESET_PASSWORD', 'MAGIC_LOGIN', 'PAYMENT_CALLBACK', 'CONFIRM_EMAIL_CHANGE', 'CONFIRM_ACCOUNT_DELETION', 'ORGANIZATION_INVITATION', 'EVENT_STAFF_INVITATION'])
export const userRole = pgEnum("user_role", ['USER', 'ADMIN'])
export const userStatus = pgEnum("user_status", ['STAGED', 'ACTIVE', 'RECOVERY', 'BANNED', 'SUSPENDED', 'LOCKED', 'DEACTIVATED', 'DELETED'])

export const orderNumberSeq = pgSequence("order_number_seq", {  startWith: "1000000", increment: "1", minValue: "1000000", maxValue: "99999999", cache: "1", cycle: false })

export const event = pgTable("event", {
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
	startAt: timestamp("start_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	endAt: timestamp("end_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	registrationStartAt: timestamp("registration_start_at", { withTimezone: true, mode: 'string' }),
	registrationEndAt: timestamp("registration_end_at", { withTimezone: true, mode: 'string' }),
	agenda: jsonb(),
	organizerInfo: jsonb("organizer_info"),
	speakers: jsonb(),
	sponsors: jsonb(),
	eventType: eventType("event_type").default('OTHER'),
	venueId: uuid("venue_id"),
	onlineUrl: varchar("online_url", { length: 500 }),
	meetingId: varchar("meeting_id", { length: 100 }),
	meetingPassword: varchar("meeting_password", { length: 100 }),
	maxAttendees: integer("max_attendees"),
	minAttendees: integer("min_attendees").default(1),
	currentAttendees: integer("current_attendees").default(0),
	basePrice: numeric("base_price", { precision: 12, scale:  2 }),
	currencyCode: char("currency_code", { length: 3 }).default('USD'),
	qr: varchar({ length: 500 }),
	trackingCode: varchar("tracking_code", { length: 100 }),
	status: eventStatus().default('DRAFT').notNull(),
	isOnline: boolean("is_online").default(false).notNull(),
	isHybrid: boolean("is_hybrid").default(false).notNull(),
	isFeatured: boolean("is_featured").default(false).notNull(),
	isRecurring: boolean("is_recurring").default(false).notNull(),
	isPaid: boolean("is_paid").default(false).notNull(),
	isPrivate: boolean("is_private").default(false).notNull(),
	requiresApproval: boolean("requires_approval").default(false).notNull(),
	publishedAt: timestamp("published_at", { withTimezone: true, mode: 'string' }),
	archivedAt: timestamp("archived_at", { withTimezone: true, mode: 'string' }),
	viewCount: integer("view_count").default(0),
	metaTitle: varchar("meta_title", { length: 60 }),
	metaDescription: varchar("meta_description", { length: 160 }),
	socialImage: varchar("social_image", { length: 500 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	venue: jsonb(),
	venueName: varchar("venue_name", { length: 255 }),
	salePrice: numeric("sale_price", { precision: 12, scale:  2 }),
	ticketStatus: eventTicketStatus("ticket_status").default('AVAILABLE').notNull(),
	thumbnail: varchar({ length: 500 }),
	organizationId: uuid("organization_id"),
	visibility: eventVisibility().default('LISTED').notNull(),
	registrationMode: eventRegistrationMode("registration_mode").default('ANYONE').notNull(),
	entryMode: eventEntryMode("entry_mode").default('TICKETED').notNull(),
	hasConfirmedDates: boolean("has_confirmed_dates").default(false).notNull(),
}, (table) => [
	index("event_attendees_idx").using("btree", table.currentAttendees.asc().nullsLast().op("int4_ops")),
	index("event_capacity_idx").using("btree", table.maxAttendees.asc().nullsLast().op("int4_ops")),
	index("event_created_by_idx").using("btree", table.createdBy.asc().nullsLast().op("uuid_ops")),
	index("event_created_by_status_idx").using("btree", table.createdBy.asc().nullsLast().op("uuid_ops"), table.status.asc().nullsLast().op("uuid_ops")),
	index("event_created_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("event_end_at_idx").using("btree", table.endAt.asc().nullsLast().op("timestamptz_ops")),
	index("event_entry_mode_idx").using("btree", table.entryMode.asc().nullsLast().op("enum_ops")),
	index("event_featured_idx").using("btree", table.isFeatured.asc().nullsLast().op("bool_ops")),
	index("event_featured_published_idx").using("btree", table.isFeatured.asc().nullsLast().op("bool_ops"), table.publishedAt.asc().nullsLast().op("bool_ops")),
	index("event_online_idx").using("btree", table.isOnline.asc().nullsLast().op("bool_ops")),
	index("event_online_start_idx").using("btree", table.isOnline.asc().nullsLast().op("timestamptz_ops"), table.startAt.asc().nullsLast().op("bool_ops")),
	index("event_organization_idx").using("btree", table.organizationId.asc().nullsLast().op("uuid_ops")),
	index("event_paid_idx").using("btree", table.isPaid.asc().nullsLast().op("bool_ops")),
	index("event_private_idx").using("btree", table.isPrivate.asc().nullsLast().op("bool_ops")),
	index("event_published_at_idx").using("btree", table.publishedAt.asc().nullsLast().op("timestamptz_ops")),
	index("event_registration_mode_idx").using("btree", table.registrationMode.asc().nullsLast().op("enum_ops")),
	index("event_registration_period_idx").using("btree", table.registrationStartAt.asc().nullsLast().op("timestamptz_ops"), table.registrationEndAt.asc().nullsLast().op("timestamptz_ops")),
	uniqueIndex("event_slug_unique_idx").using("btree", table.slug.asc().nullsLast().op("text_ops")),
	index("event_start_at_idx").using("btree", table.startAt.asc().nullsLast().op("timestamptz_ops")),
	index("event_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	index("event_status_start_idx").using("btree", table.status.asc().nullsLast().op("enum_ops"), table.startAt.asc().nullsLast().op("timestamptz_ops")),
	index("event_type_idx").using("btree", table.eventType.asc().nullsLast().op("enum_ops")),
	index("event_type_status_idx").using("btree", table.eventType.asc().nullsLast().op("enum_ops"), table.status.asc().nullsLast().op("enum_ops")),
	index("event_updated_idx").using("btree", table.updatedAt.asc().nullsLast().op("timestamptz_ops")),
	index("event_venue_idx").using("btree", table.venueId.asc().nullsLast().op("uuid_ops")),
	index("event_venue_start_idx").using("btree", table.venueId.asc().nullsLast().op("timestamptz_ops"), table.startAt.asc().nullsLast().op("uuid_ops")),
	index("event_view_count_idx").using("btree", table.viewCount.asc().nullsLast().op("int4_ops")),
	index("event_visibility_idx").using("btree", table.visibility.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [user.id],
			name: "event_created_by_user_id_fk"
		}).onUpdate("cascade").onDelete("restrict"),
	foreignKey({
			columns: [table.updatedBy],
			foreignColumns: [user.id],
			name: "event_updated_by_user_id_fk"
		}).onUpdate("cascade").onDelete("set null"),
	foreignKey({
			columns: [table.venueId],
			foreignColumns: [venue.id],
			name: "event_venue_id_venue_id_fk"
		}).onUpdate("cascade").onDelete("set null"),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organization.id],
			name: "event_organization_id_organization_id_fk"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const eventCategory = pgTable("event_category", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: varchar({ length: 100 }).notNull(),
	slug: varchar({ length: 110 }).notNull(),
	description: varchar({ length: 500 }),
	icon: varchar({ length: 500 }),
	color: varchar({ length: 7 }),
	sortOrder: integer("sort_order").default(0),
	status: eventCategoryStatus().default('DRAFT').notNull(),
	createdBy: uuid("created_by"),
	updatedBy: uuid("updated_by"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("event_category_active_sort_idx").using("btree", table.sortOrder.asc().nullsLast().op("int4_ops")),
	index("event_category_created_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("event_category_creator_idx").using("btree", table.createdBy.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("event_category_slug_unique_idx").using("btree", table.slug.asc().nullsLast().op("text_ops")),
	index("event_category_sort_order_idx").using("btree", table.sortOrder.asc().nullsLast().op("int4_ops")),
	index("event_category_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	index("event_category_updated_idx").using("btree", table.updatedAt.asc().nullsLast().op("timestamptz_ops")),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [user.id],
			name: "event_category_created_by_user_id_fk"
		}).onUpdate("cascade").onDelete("set null"),
	foreignKey({
			columns: [table.updatedBy],
			foreignColumns: [user.id],
			name: "event_category_updated_by_user_id_fk"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const venue = pgTable("venue", {
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
	countryCode: char("country_code", { length: 2 }).default('KH').notNull(),
	latitude: numeric({ precision: 10, scale:  8 }),
	longitude: numeric({ precision: 11, scale:  8 }),
	locationUrl: varchar("location_url", { length: 500 }),
	maxCapacity: smallint("max_capacity"),
	minCapacity: smallint("min_capacity"),
	amenities: jsonb(),
	cover: varchar({ length: 500 }),
	images: jsonb(),
	floorPlan: varchar("floor_plan", { length: 500 }),
	basePrice: numeric("base_price", { precision: 12, scale:  2 }),
	currency: char({ length: 3 }).default('USD').notNull(),
	pricingModel: varchar("pricing_model", { length: 20 }).default('hourly').notNull(),
	isVerified: boolean("is_verified").default(false).notNull(),
	verifiedAt: timestamp("verified_at", { withTimezone: true, mode: 'string' }),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("venue_active_verified_idx").using("btree", table.isActive.asc().nullsLast().op("bool_ops"), table.isVerified.asc().nullsLast().op("bool_ops")),
	index("venue_capacity_idx").using("btree", table.maxCapacity.asc().nullsLast().op("int2_ops")),
	index("venue_city_active_idx").using("btree", table.city.asc().nullsLast().op("bool_ops"), table.isActive.asc().nullsLast().op("bool_ops")),
	index("venue_city_country_idx").using("btree", table.city.asc().nullsLast().op("text_ops"), table.countryCode.asc().nullsLast().op("text_ops")),
	index("venue_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("venue_created_by_idx").using("btree", table.createdBy.asc().nullsLast().op("uuid_ops")),
	index("venue_location_idx").using("btree", table.latitude.asc().nullsLast().op("numeric_ops"), table.longitude.asc().nullsLast().op("numeric_ops")),
	index("venue_price_currency_idx").using("btree", table.basePrice.asc().nullsLast().op("numeric_ops"), table.currency.asc().nullsLast().op("numeric_ops")),
	uniqueIndex("venue_slug_unique_idx").using("btree", table.slug.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [user.id],
			name: "venue_created_by_user_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.updatedBy],
			foreignColumns: [user.id],
			name: "venue_updated_by_user_id_fk"
		}).onDelete("set null"),
]);

export const ticketTier = pgTable("ticket_tier", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: varchar({ length: 100 }).notNull(),
	slug: varchar({ length: 110 }).notNull(),
	description: varchar({ length: 500 }),
	eventId: uuid("event_id").notNull(),
	type: ticketTierType().default('FREE').notNull(),
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
	basePrice: numeric("base_price", { precision: 12, scale:  2 }).default('0.00').notNull(),
	salePrice: numeric("sale_price", { precision: 12, scale:  2 }),
	currencyCode: char({ length: 3 }).default('USD').notNull(),
	saleStartAt: timestamp("sale_start_at", { withTimezone: true, mode: 'string' }),
	saleEndAt: timestamp("sale_end_at", { withTimezone: true, mode: 'string' }),
	validFrom: timestamp("valid_from", { withTimezone: true, mode: 'string' }),
	validUntil: timestamp("valid_until", { withTimezone: true, mode: 'string' }),
	status: ticketTierStatus().default('DRAFT').notNull(),
	requiredInfo: jsonb("required_info"),
	benefits: jsonb(),
	restrictions: jsonb(),
	cover: varchar({ length: 500 }),
	badge: varchar({ length: 500 }),
	createdBy: uuid("created_by"),
	updatedBy: uuid("updated_by"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("ticket_tier_active_idx").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
	index("ticket_tier_availability_idx").using("btree", table.availableCount.asc().nullsLast().op("int4_ops")),
	index("ticket_tier_created_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("ticket_tier_creator_idx").using("btree", table.createdBy.asc().nullsLast().op("uuid_ops")),
	index("ticket_tier_event_active_idx").using("btree", table.eventId.asc().nullsLast().op("uuid_ops"), table.isActive.asc().nullsLast().op("uuid_ops")),
	index("ticket_tier_event_idx").using("btree", table.eventId.asc().nullsLast().op("uuid_ops")),
	index("ticket_tier_event_sort_idx").using("btree", table.eventId.asc().nullsLast().op("uuid_ops"), table.sortOrder.asc().nullsLast().op("uuid_ops")),
	index("ticket_tier_event_status_idx").using("btree", table.eventId.asc().nullsLast().op("uuid_ops"), table.status.asc().nullsLast().op("uuid_ops")),
	index("ticket_tier_price_range_idx").using("btree", table.basePrice.asc().nullsLast().op("numeric_ops"), table.salePrice.asc().nullsLast().op("numeric_ops")),
	index("ticket_tier_sale_period_idx").using("btree", table.saleStartAt.asc().nullsLast().op("timestamptz_ops"), table.saleEndAt.asc().nullsLast().op("timestamptz_ops")),
	uniqueIndex("ticket_tier_slug_event_unique_idx").using("btree", table.eventId.asc().nullsLast().op("uuid_ops"), table.slug.asc().nullsLast().op("text_ops")),
	index("ticket_tier_sold_count_idx").using("btree", table.soldCount.asc().nullsLast().op("int4_ops")),
	index("ticket_tier_sort_order_idx").using("btree", table.sortOrder.asc().nullsLast().op("int4_ops")),
	index("ticket_tier_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	index("ticket_tier_type_idx").using("btree", table.type.asc().nullsLast().op("enum_ops")),
	index("ticket_tier_type_status_idx").using("btree", table.type.asc().nullsLast().op("enum_ops"), table.status.asc().nullsLast().op("enum_ops")),
	index("ticket_tier_updated_idx").using("btree", table.updatedAt.asc().nullsLast().op("timestamptz_ops")),
	index("ticket_tier_validity_period_idx").using("btree", table.validFrom.asc().nullsLast().op("timestamptz_ops"), table.validUntil.asc().nullsLast().op("timestamptz_ops")),
	index("ticket_tier_visible_idx").using("btree", table.isVisible.asc().nullsLast().op("bool_ops")),
	foreignKey({
			columns: [table.eventId],
			foreignColumns: [event.id],
			name: "ticket_tier_event_id_event_id_fk"
		}).onUpdate("cascade").onDelete("restrict"),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [user.id],
			name: "ticket_tier_created_by_user_id_fk"
		}).onUpdate("cascade").onDelete("set null"),
	foreignKey({
			columns: [table.updatedBy],
			foreignColumns: [user.id],
			name: "ticket_tier_updated_by_user_id_fk"
		}).onUpdate("cascade").onDelete("set null"),
]);
