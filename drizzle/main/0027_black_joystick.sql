ALTER TABLE "launchpad_application" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "launchpad_application" ALTER COLUMN "status" SET DEFAULT 'SUBMITTED'::text;--> statement-breakpoint
ALTER TABLE "launchpad_application_log" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "launchpad_application_log" ALTER COLUMN "status" SET DEFAULT 'SUBMITTED'::text;--> statement-breakpoint
DROP TYPE "public"."launchpad_application_status";--> statement-breakpoint
CREATE TYPE "public"."launchpad_application_status" AS ENUM('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'DECLINED', 'CONFIRMED', 'COMPLETED', 'WITHDRAWN');--> statement-breakpoint
ALTER TABLE "launchpad_application" ALTER COLUMN "status" SET DEFAULT 'SUBMITTED'::"public"."launchpad_application_status";--> statement-breakpoint
ALTER TABLE "launchpad_application" ALTER COLUMN "status" SET DATA TYPE "public"."launchpad_application_status" USING "status"::"public"."launchpad_application_status";--> statement-breakpoint
ALTER TABLE "launchpad_application_log" ALTER COLUMN "status" SET DEFAULT 'SUBMITTED'::"public"."launchpad_application_status";--> statement-breakpoint
ALTER TABLE "launchpad_application_log" ALTER COLUMN "status" SET DATA TYPE "public"."launchpad_application_status" USING "status"::"public"."launchpad_application_status";