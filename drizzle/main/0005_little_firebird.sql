CREATE TYPE "public"."volunteer_opportunity_status" AS ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED', 'CLOSED');--> statement-breakpoint
CREATE TABLE "volunteer_opportunity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"city_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"overview" text NOT NULL,
	"community_impact" text,
	"duration_label" varchar(120) NOT NULL,
	"commitment_label" varchar(120) NOT NULL,
	"application_deadline" timestamp with time zone NOT NULL,
	"cover_image_key" varchar(600) NOT NULL,
	"cover_image_url" text,
	"benefits" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"contact_telegram_username" varchar(120),
	"contact_email" varchar(320) NOT NULL,
	"contact_phone" varchar(40),
	"contact_website_url" text,
	"status" "volunteer_opportunity_status" DEFAULT 'PUBLISHED' NOT NULL,
	"published_at" timestamp with time zone DEFAULT now(),
	"created_by" uuid NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "volunteer_role" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"commitment_label" varchar(120) NOT NULL,
	"capacity" integer NOT NULL,
	"responsibilities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"display_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "volunteer_role_requirement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_id" uuid NOT NULL,
	"requirement_text" text NOT NULL,
	"display_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "volunteer_opportunity" ADD CONSTRAINT "volunteer_opportunity_category_id_volunteer_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."volunteer_category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "volunteer_opportunity" ADD CONSTRAINT "volunteer_opportunity_city_id_city_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."city"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "volunteer_opportunity" ADD CONSTRAINT "volunteer_opportunity_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "volunteer_opportunity" ADD CONSTRAINT "volunteer_opportunity_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "volunteer_role" ADD CONSTRAINT "volunteer_role_opportunity_id_volunteer_opportunity_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."volunteer_opportunity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "volunteer_role_requirement" ADD CONSTRAINT "volunteer_role_requirement_role_id_volunteer_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."volunteer_role"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "volunteer_opportunity_category_idx" ON "volunteer_opportunity" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "volunteer_opportunity_city_idx" ON "volunteer_opportunity" USING btree ("city_id");--> statement-breakpoint
CREATE INDEX "volunteer_opportunity_status_idx" ON "volunteer_opportunity" USING btree ("status");--> statement-breakpoint
CREATE INDEX "volunteer_opportunity_deadline_idx" ON "volunteer_opportunity" USING btree ("application_deadline");--> statement-breakpoint
CREATE INDEX "volunteer_opportunity_created_by_idx" ON "volunteer_opportunity" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "volunteer_role_opportunity_idx" ON "volunteer_role" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "volunteer_role_order_idx" ON "volunteer_role" USING btree ("display_order");--> statement-breakpoint
CREATE INDEX "volunteer_role_requirement_role_idx" ON "volunteer_role_requirement" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "volunteer_role_requirement_order_idx" ON "volunteer_role_requirement" USING btree ("display_order");