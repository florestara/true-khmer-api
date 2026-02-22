import { relations } from "drizzle-orm/relations";
import { user, event, venue, organization, eventCategory, ticketTier } from "./schema";

export const eventRelations = relations(event, ({one, many}) => ({
	user_createdBy: one(user, {
		fields: [event.createdBy],
		references: [user.id],
		relationName: "event_createdBy_user_id"
	}),
	user_updatedBy: one(user, {
		fields: [event.updatedBy],
		references: [user.id],
		relationName: "event_updatedBy_user_id"
	}),
	venue: one(venue, {
		fields: [event.venueId],
		references: [venue.id]
	}),
	organization: one(organization, {
		fields: [event.organizationId],
		references: [organization.id]
	}),
	ticketTiers: many(ticketTier),
}));

export const userRelations = relations(user, ({many}) => ({
	events_createdBy: many(event, {
		relationName: "event_createdBy_user_id"
	}),
	events_updatedBy: many(event, {
		relationName: "event_updatedBy_user_id"
	}),
	eventCategories_createdBy: many(eventCategory, {
		relationName: "eventCategory_createdBy_user_id"
	}),
	eventCategories_updatedBy: many(eventCategory, {
		relationName: "eventCategory_updatedBy_user_id"
	}),
	venues_createdBy: many(venue, {
		relationName: "venue_createdBy_user_id"
	}),
	venues_updatedBy: many(venue, {
		relationName: "venue_updatedBy_user_id"
	}),
	ticketTiers_createdBy: many(ticketTier, {
		relationName: "ticketTier_createdBy_user_id"
	}),
	ticketTiers_updatedBy: many(ticketTier, {
		relationName: "ticketTier_updatedBy_user_id"
	}),
}));

export const venueRelations = relations(venue, ({one, many}) => ({
	events: many(event),
	user_createdBy: one(user, {
		fields: [venue.createdBy],
		references: [user.id],
		relationName: "venue_createdBy_user_id"
	}),
	user_updatedBy: one(user, {
		fields: [venue.updatedBy],
		references: [user.id],
		relationName: "venue_updatedBy_user_id"
	}),
}));

export const organizationRelations = relations(organization, ({many}) => ({
	events: many(event),
}));

export const eventCategoryRelations = relations(eventCategory, ({one}) => ({
	user_createdBy: one(user, {
		fields: [eventCategory.createdBy],
		references: [user.id],
		relationName: "eventCategory_createdBy_user_id"
	}),
	user_updatedBy: one(user, {
		fields: [eventCategory.updatedBy],
		references: [user.id],
		relationName: "eventCategory_updatedBy_user_id"
	}),
}));

export const ticketTierRelations = relations(ticketTier, ({one}) => ({
	event: one(event, {
		fields: [ticketTier.eventId],
		references: [event.id]
	}),
	user_createdBy: one(user, {
		fields: [ticketTier.createdBy],
		references: [user.id],
		relationName: "ticketTier_createdBy_user_id"
	}),
	user_updatedBy: one(user, {
		fields: [ticketTier.updatedBy],
		references: [user.id],
		relationName: "ticketTier_updatedBy_user_id"
	}),
}));