ALTER TABLE "volunteer_opportunity" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "volunteer_opportunity" ALTER COLUMN "status" SET DATA TYPE text USING "status"::text;--> statement-breakpoint
UPDATE "volunteer_opportunity"
SET "status" = CASE "status"
  WHEN 'PUBLISHED' THEN 'ACTIVE'
  WHEN 'ARCHIVED' THEN 'CLOSED'
  ELSE "status"
END;--> statement-breakpoint
DROP TYPE "public"."volunteer_opportunity_status";--> statement-breakpoint
CREATE TYPE "public"."volunteer_opportunity_status" AS ENUM('DRAFT', 'ACTIVE', 'CLOSED', 'COMPLETED');--> statement-breakpoint
ALTER TABLE "volunteer_opportunity" ALTER COLUMN "status" SET DATA TYPE "public"."volunteer_opportunity_status" USING "status"::"public"."volunteer_opportunity_status";--> statement-breakpoint
ALTER TABLE "volunteer_opportunity" ALTER COLUMN "status" SET DEFAULT 'ACTIVE'::"public"."volunteer_opportunity_status";--> statement-breakpoint
UPDATE "volunteer_opportunity"
SET "status" = 'CLOSED'
WHERE "status" = 'ACTIVE'
  AND "application_deadline" <= now();--> statement-breakpoint
ALTER TABLE "volunteer_opportunity" ADD COLUMN "commitment_description" text;--> statement-breakpoint
ALTER TABLE "volunteer_opportunity" ADD COLUMN "filled" boolean DEFAULT false NOT NULL;
