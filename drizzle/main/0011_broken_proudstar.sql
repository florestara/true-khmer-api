CREATE TYPE "public"."volunteer_application_status" AS ENUM('SUBMITTED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');--> statement-breakpoint
CREATE TABLE "volunteer_application" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"applicant_id" uuid NOT NULL,
	"availability" text NOT NULL,
	"relevant_experience" text NOT NULL,
	"supporting_document_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "volunteer_application_supporting_document_keys_array_check" CHECK (jsonb_typeof("supporting_document_keys") = 'array'),
	"status" "volunteer_application_status" DEFAULT 'SUBMITTED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "volunteer_role_id_opportunity_unique_idx" ON "volunteer_role" USING btree ("id","opportunity_id");--> statement-breakpoint
ALTER TABLE "volunteer_application" ADD CONSTRAINT "volunteer_application_opportunity_id_volunteer_opportunity_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."volunteer_opportunity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "volunteer_application" ADD CONSTRAINT "volunteer_application_role_id_volunteer_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."volunteer_role"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "volunteer_application" ADD CONSTRAINT "volunteer_application_role_opportunity_match_fk" FOREIGN KEY ("role_id","opportunity_id") REFERENCES "public"."volunteer_role"("id","opportunity_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "volunteer_application" ADD CONSTRAINT "volunteer_application_applicant_id_user_id_fk" FOREIGN KEY ("applicant_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "volunteer_application_applicant_opportunity_active_unique_idx" ON "volunteer_application" USING btree ("applicant_id","opportunity_id") WHERE "status" IN ('SUBMITTED', 'ACCEPTED');--> statement-breakpoint
CREATE INDEX "volunteer_application_opportunity_idx" ON "volunteer_application" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "volunteer_application_role_idx" ON "volunteer_application" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "volunteer_application_applicant_idx" ON "volunteer_application" USING btree ("applicant_id");--> statement-breakpoint
CREATE INDEX "volunteer_application_status_idx" ON "volunteer_application" USING btree ("status");
