CREATE TYPE "public"."launchpad_status" AS ENUM('DRAFT', 'LIVE', 'IN_PROGRESS', 'COMPLETED');--> statement-breakpoint
ALTER TABLE "launchpad" ADD COLUMN "status" "launchpad_status" DEFAULT 'LIVE' NOT NULL;--> statement-breakpoint
CREATE INDEX "launchpad_status_idx" ON "launchpad" USING btree ("status");