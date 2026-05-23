ALTER TABLE "launchpad_application" ADD COLUMN "relevant_experience" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "launchpad_application" ADD COLUMN "top_pick" boolean DEFAULT false NOT NULL;--> statement-breakpoint
DROP INDEX IF EXISTS "launchpad_application_unique_active";--> statement-breakpoint
CREATE UNIQUE INDEX "launchpad_application_unique_active" ON "launchpad_application" USING btree ("launchpad_role_id","created_by") WHERE "launchpad_application"."status" in ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'CONFIRMED', 'COMPLETED');--> statement-breakpoint
CREATE UNIQUE INDEX "launchpad_application_created_by_launchpad_top_pick_active_unique_idx" ON "launchpad_application" USING btree ("created_by","launchpad_id") WHERE "launchpad_application"."top_pick" = true and "launchpad_application"."status" in ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'CONFIRMED', 'COMPLETED');
