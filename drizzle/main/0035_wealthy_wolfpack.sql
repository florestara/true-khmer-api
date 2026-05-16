ALTER TABLE "volunteer_opportunity" ADD COLUMN "start_date" date;--> statement-breakpoint
ALTER TABLE "volunteer_opportunity" ADD COLUMN "end_date" date;--> statement-breakpoint
ALTER TABLE "volunteer_opportunity" DROP COLUMN "duration_label";