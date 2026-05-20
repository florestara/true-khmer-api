ALTER TYPE "public"."volunteer_opportunity_status" ADD VALUE 'CANCELED';--> statement-breakpoint
ALTER TYPE "public"."launchpad_status" ADD VALUE 'CANCELED';--> statement-breakpoint
CREATE TABLE "volunteer_opportunity_action_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"from_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"to_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "volunteer_opportunity_status" NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "launchpad_action_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"launchpad_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"from_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"to_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "launchpad_status" NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "volunteer_opportunity" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "launchpad" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "volunteer_opportunity_action_log" ADD CONSTRAINT "volunteer_opportunity_action_log_opportunity_id_volunteer_opportunity_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."volunteer_opportunity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "volunteer_opportunity_action_log" ADD CONSTRAINT "volunteer_opportunity_action_log_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "launchpad_action_log" ADD CONSTRAINT "launchpad_action_log_launchpad_id_launchpad_id_fk" FOREIGN KEY ("launchpad_id") REFERENCES "public"."launchpad"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "launchpad_action_log" ADD CONSTRAINT "launchpad_action_log_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "volunteer_opportunity_action_log_opportunity_idx" ON "volunteer_opportunity_action_log" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "volunteer_opportunity_action_log_created_by_idx" ON "volunteer_opportunity_action_log" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "launchpad_action_log_launchpad_idx" ON "launchpad_action_log" USING btree ("launchpad_id");--> statement-breakpoint
CREATE INDEX "launchpad_action_log_created_by_idx" ON "launchpad_action_log" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "volunteer_opportunity_deleted_at_idx" ON "volunteer_opportunity" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "launchpad_deleted_at_idx" ON "launchpad" USING btree ("deleted_at");
