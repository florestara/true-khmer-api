CREATE TYPE "public"."workspace_candidate_block_source_type" AS ENUM('VOLUNTEER', 'PROJECT');--> statement-breakpoint
CREATE TYPE "public"."workspace_candidate_block_status" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TABLE "workspace_candidate_block" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_type" "workspace_candidate_block_source_type" NOT NULL,
	"posting_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"status" "workspace_candidate_block_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspace_candidate_block" ADD CONSTRAINT "workspace_candidate_block_candidate_id_user_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_candidate_block" ADD CONSTRAINT "workspace_candidate_block_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_candidate_block" ADD CONSTRAINT "workspace_candidate_block_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_candidate_block_source_posting_candidate_unique_idx" ON "workspace_candidate_block" USING btree ("source_type","posting_id","candidate_id");--> statement-breakpoint
CREATE INDEX "workspace_candidate_block_candidate_idx" ON "workspace_candidate_block" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "workspace_candidate_block_created_by_idx" ON "workspace_candidate_block" USING btree ("created_by");