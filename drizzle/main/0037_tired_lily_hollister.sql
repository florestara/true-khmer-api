ALTER TABLE "volunteer_opportunity" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "volunteer_opportunity" ALTER COLUMN "status" SET DEFAULT 'PUBLISHED'::text;--> statement-breakpoint
UPDATE "volunteer_opportunity" SET "status" = 'PUBLISHED' WHERE "status" = 'ACTIVE';--> statement-breakpoint
DROP TYPE "public"."volunteer_opportunity_status";--> statement-breakpoint
CREATE TYPE "public"."volunteer_opportunity_status" AS ENUM('DRAFT', 'ACTIVE', 'PUBLISHED', 'CLOSED', 'COMPLETED');--> statement-breakpoint
ALTER TABLE "volunteer_opportunity" ALTER COLUMN "status" SET DEFAULT 'PUBLISHED'::"public"."volunteer_opportunity_status";--> statement-breakpoint
ALTER TABLE "volunteer_opportunity" ALTER COLUMN "status" SET DATA TYPE "public"."volunteer_opportunity_status" USING "status"::"public"."volunteer_opportunity_status";
