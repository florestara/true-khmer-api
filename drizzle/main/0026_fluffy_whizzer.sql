CREATE TYPE "public"."launchpad_application_status" AS ENUM('SUBMITTED', 'PASSED', 'CONFIRMED', 'REJECTED', 'COMPLETED', 'WITHDRAWN');--> statement-breakpoint
CREATE TABLE "launchpad_application" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"launchpad_id" uuid NOT NULL,
	"launchpad_role_id" uuid NOT NULL,
	"motivation" varchar(2000) NOT NULL,
	"portfolio" varchar(255) NOT NULL,
	"status" "launchpad_application_status" DEFAULT 'SUBMITTED' NOT NULL,
	"document_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"document_names" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "launchpad_application_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"launchpad_application_id" uuid NOT NULL,
	"status" "launchpad_application_status" DEFAULT 'SUBMITTED' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "launchpad_application" ADD CONSTRAINT "launchpad_application_launchpad_id_launchpad_id_fk" FOREIGN KEY ("launchpad_id") REFERENCES "public"."launchpad"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "launchpad_application" ADD CONSTRAINT "launchpad_application_launchpad_role_id_launchpad_role_id_fk" FOREIGN KEY ("launchpad_role_id") REFERENCES "public"."launchpad_role"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "launchpad_application" ADD CONSTRAINT "launchpad_application_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "launchpad_application_log" ADD CONSTRAINT "launchpad_application_log_launchpad_application_id_launchpad_application_id_fk" FOREIGN KEY ("launchpad_application_id") REFERENCES "public"."launchpad_application"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "launchpad_application_log" ADD CONSTRAINT "launchpad_application_log_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "launchpad_application_launchpad_id_idx" ON "launchpad_application" USING btree ("launchpad_id");--> statement-breakpoint
CREATE INDEX "launchpad_application_launchpad_role_id_idx" ON "launchpad_application" USING btree ("launchpad_role_id");--> statement-breakpoint
CREATE INDEX "launchpad_application_created_by_idx" ON "launchpad_application" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "launchpad_application_log_application_id_idx" ON "launchpad_application_log" USING btree ("launchpad_application_id");--> statement-breakpoint
CREATE INDEX "launchpad_application_log_created_by_idx" ON "launchpad_application_log" USING btree ("created_by");