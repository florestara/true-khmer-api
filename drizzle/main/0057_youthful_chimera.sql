CREATE TYPE "public"."badge_category" AS ENUM('ONBOARDING', 'COLLABORATION', 'KNOWLEDGE', 'VOLUNTEER', 'LAUNCHPAD');--> statement-breakpoint
CREATE TABLE "badge" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(80) NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text NOT NULL,
	"category" "badge_category" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_badge" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"badge_id" uuid NOT NULL,
	"awarded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_badge" ADD CONSTRAINT "user_badge_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_badge" ADD CONSTRAINT "user_badge_badge_id_badge_id_fk" FOREIGN KEY ("badge_id") REFERENCES "public"."badge"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "badge_slug_unique_idx" ON "badge" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "user_badge_user_id_badge_id_unique_idx" ON "user_badge" USING btree ("user_id","badge_id");--> statement-breakpoint
CREATE INDEX "user_badge_user_id_idx" ON "user_badge" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_badge_badge_id_idx" ON "user_badge" USING btree ("badge_id");
