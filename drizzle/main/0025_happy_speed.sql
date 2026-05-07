DROP INDEX IF EXISTS "volunteer_application_applicant_role_active_unique_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "volunteer_application_opportunity_status_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "volunteer_application_status_idx";--> statement-breakpoint
ALTER TABLE "volunteer_application" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "volunteer_application" ALTER COLUMN "status" SET DATA TYPE text USING "status"::text;--> statement-breakpoint
UPDATE "volunteer_application"
SET "status" = CASE "status"
  WHEN 'ACCEPTED' THEN 'CONFIRMED'
  WHEN 'REJECTED' THEN 'DECLINED'
  ELSE "status"
END;--> statement-breakpoint
DROP TYPE "public"."volunteer_application_status";--> statement-breakpoint
CREATE TYPE "public"."volunteer_application_status" AS ENUM('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'DECLINED', 'CONFIRMED', 'COMPLETED', 'WITHDRAWN');--> statement-breakpoint
ALTER TABLE "volunteer_application" ALTER COLUMN "status" SET DATA TYPE "public"."volunteer_application_status" USING "status"::"public"."volunteer_application_status";--> statement-breakpoint
ALTER TABLE "volunteer_application" ALTER COLUMN "status" SET DEFAULT 'SUBMITTED'::"public"."volunteer_application_status";--> statement-breakpoint
CREATE UNIQUE INDEX "recent_activity_user_reference_type_unique_idx" ON "recent_activity" USING btree ("user_id","reference_type","reference_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "volunteer_application_applicant_role_active_unique_idx" ON "volunteer_application" USING btree ("applicant_id","role_id") WHERE "volunteer_application"."status" in ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'CONFIRMED', 'COMPLETED');--> statement-breakpoint
CREATE INDEX "volunteer_application_opportunity_status_idx" ON "volunteer_application" USING btree ("opportunity_id","status");--> statement-breakpoint
CREATE INDEX "volunteer_application_status_idx" ON "volunteer_application" USING btree ("status");
