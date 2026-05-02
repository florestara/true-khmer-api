DROP INDEX IF EXISTS "volunteer_application_applicant_opportunity_active_unique_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "volunteer_application_applicant_opportunity_unique_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "volunteer_application_applicant_role_active_unique_idx" ON "volunteer_application" USING btree ("applicant_id","role_id") WHERE "volunteer_application"."status" in ('SUBMITTED', 'ACCEPTED');
