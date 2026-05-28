CREATE TYPE "public"."workspace_applicant_note_source_type" AS ENUM('VOLUNTEER', 'PROJECT');--> statement-breakpoint
CREATE TABLE "workspace_applicant_note" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_type" "workspace_applicant_note_source_type" NOT NULL,
	"posting_id" uuid NOT NULL,
	"applicant_id" uuid NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspace_applicant_note" ADD CONSTRAINT "workspace_applicant_note_applicant_id_user_id_fk" FOREIGN KEY ("applicant_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_applicant_note" ADD CONSTRAINT "workspace_applicant_note_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_applicant_note" ADD CONSTRAINT "workspace_applicant_note_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_applicant_note_source_posting_applicant_unique_idx" ON "workspace_applicant_note" USING btree ("source_type","posting_id","applicant_id");--> statement-breakpoint
CREATE INDEX "workspace_applicant_note_applicant_idx" ON "workspace_applicant_note" USING btree ("applicant_id");--> statement-breakpoint
CREATE INDEX "workspace_applicant_note_created_by_idx" ON "workspace_applicant_note" USING btree ("created_by");