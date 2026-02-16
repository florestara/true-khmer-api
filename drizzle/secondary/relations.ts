import { relations } from "drizzle-orm/relations";
import { user, event, venue, organization } from "./schema";

export const eventRelations = relations(event, ({one}) => ({
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
}));

export const userRelations = relations(user, ({many}) => ({
	events_createdBy: many(event, {
		relationName: "event_createdBy_user_id"
	}),
	events_updatedBy: many(event, {
		relationName: "event_updatedBy_user_id"
	}),
}));

export const venueRelations = relations(venue, ({many}) => ({
	events: many(event),
}));

export const organizationRelations = relations(organization, ({many}) => ({
	events: many(event),
}));