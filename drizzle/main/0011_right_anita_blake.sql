CREATE TYPE "public"."launchpad_category_status" AS ENUM('ACTIVE', 'ARCHIVED', 'HIDDEN');--> statement-breakpoint
CREATE TABLE "launchpad_category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(255) NOT NULL,
	"name" varchar(120) NOT NULL,
	"icon_key" varchar(100),
	"display_order" integer DEFAULT 0 NOT NULL,
	"status" "launchpad_category_status" DEFAULT 'ACTIVE' NOT NULL,
	"total_roles" integer DEFAULT 0 NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "point_transactions" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "point_transactions" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "point_transactions" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "point_transactions" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
CREATE UNIQUE INDEX "launchpad_category_slug_unique_idx" ON "launchpad_category" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "launchpad_category_name_unique_idx" ON "launchpad_category" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "launchpad_category_status_idx" ON "launchpad_category" USING btree ("status");--> statement-breakpoint
CREATE INDEX "launchpad_category_order_idx" ON "launchpad_category" USING btree ("display_order");