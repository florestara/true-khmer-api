CREATE TABLE "recent_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(100) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"target_type" varchar(100) NOT NULL,
	"target_id" uuid NOT NULL,
	"reference_type" varchar(100) NOT NULL,
	"reference_id" uuid NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recent_activity" ADD CONSTRAINT "recent_activity_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recent_activity_user_created_idx" ON "recent_activity" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "recent_activity_type_idx" ON "recent_activity" USING btree ("type");--> statement-breakpoint
CREATE INDEX "recent_activity_target_idx" ON "recent_activity" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "recent_activity_reference_idx" ON "recent_activity" USING btree ("reference_type","reference_id");