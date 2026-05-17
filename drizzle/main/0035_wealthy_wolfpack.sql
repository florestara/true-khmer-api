ALTER TABLE "volunteer_opportunity" ADD COLUMN "start_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "volunteer_opportunity" ADD COLUMN "end_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "volunteer_opportunity" DROP COLUMN "duration_label";
