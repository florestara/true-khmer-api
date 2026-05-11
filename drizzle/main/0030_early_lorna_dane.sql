CREATE TYPE "public"."application_declined_by" AS ENUM('POSTER', 'APPLICANT');--> statement-breakpoint
CREATE TABLE "volunteer_application_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"volunteer_application_id" uuid NOT NULL,
	"status" "volunteer_application_status" DEFAULT 'SUBMITTED' NOT NULL,
	"declined_by" "application_declined_by",
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "launchpad_application_log" ADD COLUMN "declined_by" "application_declined_by";--> statement-breakpoint
ALTER TABLE "volunteer_application_log" ADD CONSTRAINT "volunteer_application_log_volunteer_application_id_volunteer_application_id_fk" FOREIGN KEY ("volunteer_application_id") REFERENCES "public"."volunteer_application"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "volunteer_application_log" ADD CONSTRAINT "volunteer_application_log_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "volunteer_application_log_application_id_idx" ON "volunteer_application_log" USING btree ("volunteer_application_id");--> statement-breakpoint
CREATE INDEX "volunteer_application_log_created_by_idx" ON "volunteer_application_log" USING btree ("created_by");
