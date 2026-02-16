import { pgTable, index, uniqueIndex, foreignKey, uuid, varchar, text, jsonb, timestamp, integer, numeric, char, boolean, pgSequence, pgEnum } from "drizzle-orm/pg-core"
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
	startAt: timestamp("start_at", { withTimezone: true, mode: 'string' }).notNull(),
	endAt: timestamp("end_at", { withTimezone: true, mode: 'string' }).notNull(),
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
