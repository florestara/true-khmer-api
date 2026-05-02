CREATE TYPE "public"."profile_visibility" AS ENUM('public', 'members', 'private');--> statement-breakpoint
CREATE TYPE "public"."social_link_platform" AS ENUM('website', 'linkedin', 'twitter', 'facebook');--> statement-breakpoint
CREATE TABLE "skill" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(80) NOT NULL,
	"normalized_name" varchar(80) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_skill" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_social_link" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"platform" "social_link_platform" NOT NULL,
	"url" varchar(500) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "date_of_birth" date;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "telegram_username" varchar(32);--> statement-breakpoint
ALTER TABLE "user_profile" ADD COLUMN "profile_visibility" "profile_visibility" DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_profile" ADD COLUMN "contact_visibility" "profile_visibility" DEFAULT 'members' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_profile" ADD COLUMN "social_links_visibility" "profile_visibility" DEFAULT 'members' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_profile" ADD COLUMN "contribution_visibility" "profile_visibility" DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_skill" ADD CONSTRAINT "user_skill_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_skill" ADD CONSTRAINT "user_skill_skill_id_skill_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skill"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_social_link" ADD CONSTRAINT "user_social_link_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "skill_normalized_name_unique_idx" ON "skill" USING btree ("normalized_name");--> statement-breakpoint
CREATE INDEX "skill_name_idx" ON "skill" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "user_skill_user_skill_unique_idx" ON "user_skill" USING btree ("user_id","skill_id");--> statement-breakpoint
CREATE INDEX "user_skill_user_id_idx" ON "user_skill" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_skill_skill_id_idx" ON "user_skill" USING btree ("skill_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_social_link_user_platform_unique_idx" ON "user_social_link" USING btree ("user_id","platform");--> statement-breakpoint
CREATE INDEX "user_social_link_user_id_idx" ON "user_social_link" USING btree ("user_id");