CREATE TYPE "public"."volunteer_category_status" AS ENUM('ACTIVE', 'ARCHIVED', 'HIDDEN');--> statement-breakpoint
CREATE TABLE "volunteer_category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(255) NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"icon_key" varchar(100),
	"display_order" integer DEFAULT 0 NOT NULL,
	"status" "volunteer_category_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "volunteer_category_slug_unique_idx" ON "volunteer_category" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "volunteer_category_name_unique_idx" ON "volunteer_category" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "volunteer_category_status_idx" ON "volunteer_category" USING btree ("status");--> statement-breakpoint
CREATE INDEX "volunteer_category_order_idx" ON "volunteer_category" USING btree ("display_order");
