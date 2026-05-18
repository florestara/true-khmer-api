ALTER TABLE "volunteer_opportunity" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "volunteer_opportunity" ALTER COLUMN "status" SET DEFAULT 'ACTIVE'::text;--> statement-breakpoint
DROP TYPE "public"."volunteer_opportunity_status";--> statement-breakpoint
CREATE TYPE "public"."volunteer_opportunity_status" AS ENUM('DRAFT', 'ACTIVE', 'CLOSED', 'COMPLETED');--> statement-breakpoint
ALTER TABLE "volunteer_opportunity" ALTER COLUMN "status" SET DEFAULT 'ACTIVE'::"public"."volunteer_opportunity_status";--> statement-breakpoint
ALTER TABLE "volunteer_opportunity" ALTER COLUMN "status" SET DATA TYPE "public"."volunteer_opportunity_status" USING "status"::"public"."volunteer_opportunity_status";--> statement-breakpoint
ALTER TABLE "volunteer_application" ADD COLUMN "top_pick" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "volunteer_opportunity" ADD COLUMN "start_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "volunteer_opportunity" ADD COLUMN "end_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "volunteer_opportunity" ADD COLUMN "commitment_description" text;--> statement-breakpoint
ALTER TABLE "volunteer_opportunity" ADD COLUMN "filled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "volunteer_opportunity" DROP COLUMN "duration_label";
