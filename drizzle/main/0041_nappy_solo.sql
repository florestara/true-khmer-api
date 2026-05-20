ALTER TABLE "volunteer_opportunity" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "volunteer_opportunity" ALTER COLUMN "status" SET DEFAULT 'LIVE'::text;--> statement-breakpoint
UPDATE "volunteer_opportunity" SET "status" = 'LIVE' WHERE "status" IN ('ACTIVE', 'PUBLISHED');--> statement-breakpoint
UPDATE "volunteer_opportunity" SET "status" = 'IN_PROGRESS' WHERE "status" = 'CLOSED';--> statement-breakpoint
DROP TYPE "public"."volunteer_opportunity_status";--> statement-breakpoint
CREATE TYPE "public"."volunteer_opportunity_status" AS ENUM('DRAFT', 'LIVE', 'IN_PROGRESS', 'COMPLETED');--> statement-breakpoint
ALTER TABLE "volunteer_opportunity" ALTER COLUMN "status" SET DEFAULT 'LIVE'::"public"."volunteer_opportunity_status";--> statement-breakpoint
ALTER TABLE "volunteer_opportunity" ALTER COLUMN "status" SET DATA TYPE "public"."volunteer_opportunity_status" USING "status"::"public"."volunteer_opportunity_status";
