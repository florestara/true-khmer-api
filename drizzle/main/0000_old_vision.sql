CREATE TYPE "public"."user_gender" AS ENUM('male', 'female', 'other');--> statement-breakpoint
CREATE TYPE "public"."forum_answer_status" AS ENUM('PUBLISHED', 'DELETED');--> statement-breakpoint
CREATE TYPE "public"."forum_answer_vote_type" AS ENUM('UPVOTE', 'DOWNVOTE');--> statement-breakpoint
CREATE TYPE "public"."forum_category_status" AS ENUM('ACTIVE', 'ARCHIVED', 'HIDDEN');--> statement-breakpoint
CREATE TYPE "public"."forum_question_status" AS ENUM('PUBLISHED', 'CLOSED', 'DELETED');--> statement-breakpoint
CREATE TABLE "account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jwks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_key" text NOT NULL,
	"private_key" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" uuid NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"gender" "user_gender" DEFAULT 'other' NOT NULL,
	"occupation" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" text DEFAULT 'user' NOT NULL,
	"onboarding_step" integer DEFAULT 0 NOT NULL,
	"onboarding_completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "city" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"country_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"normalized_name" varchar(120) NOT NULL,
	"provider" varchar(40) DEFAULT 'countriesnow' NOT NULL,
	"provider_ref" varchar(120),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "country" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"normalized_name" varchar(120) NOT NULL,
	"iso2" varchar(2),
	"provider" varchar(40) DEFAULT 'countriesnow' NOT NULL,
	"provider_ref" varchar(120),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interest" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(80) NOT NULL,
	"label" varchar(120) NOT NULL,
	"icon" varchar(30) DEFAULT '' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tier" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(80) NOT NULL,
	"name" varchar(120) NOT NULL,
	"rank_order" integer NOT NULL,
	"min_points" integer DEFAULT 0 NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_contribution_onboard" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"community_member" boolean DEFAULT false NOT NULL,
	"find_volunteers" boolean DEFAULT false NOT NULL,
	"launch_project" boolean DEFAULT false NOT NULL,
	"organize_event" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_interest" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"interest_id" uuid NOT NULL,
	"selected_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_point_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"points_delta" integer NOT NULL,
	"action_type" varchar(80) NOT NULL,
	"event_key" varchar(120),
	"reference_type" varchar(80),
	"reference_id" varchar(120),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"display_name" varchar(200),
	"avatar_key" varchar(600),
	"avatar_url" text,
	"bio" text,
	"country_id" uuid,
	"city_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_progress" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"total_points" integer DEFAULT 0 NOT NULL,
	"current_tier_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forum_answer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"status" "forum_answer_status" DEFAULT 'PUBLISHED' NOT NULL,
	"upvote_count" integer DEFAULT 0 NOT NULL,
	"downvote_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "forum_answer_vote" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"answer_id" uuid NOT NULL,
	"voter_id" uuid NOT NULL,
	"vote_type" "forum_answer_vote_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forum_category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"status" "forum_category_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "forum_question" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"title" varchar(300) NOT NULL,
	"body" text NOT NULL,
	"status" "forum_question_status" DEFAULT 'PUBLISHED' NOT NULL,
	"answer_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forum_question_tag" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forum_tag" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(30) NOT NULL,
	"normalized_name" varchar(30) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "city" ADD CONSTRAINT "city_country_id_country_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."country"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_contribution_onboard" ADD CONSTRAINT "user_contribution_onboard_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_interest" ADD CONSTRAINT "user_interest_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_interest" ADD CONSTRAINT "user_interest_interest_id_interest_id_fk" FOREIGN KEY ("interest_id") REFERENCES "public"."interest"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_point_ledger" ADD CONSTRAINT "user_point_ledger_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profile" ADD CONSTRAINT "user_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profile" ADD CONSTRAINT "user_profile_country_id_country_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."country"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profile" ADD CONSTRAINT "user_profile_city_id_city_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."city"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_progress" ADD CONSTRAINT "user_progress_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_progress" ADD CONSTRAINT "user_progress_current_tier_id_tier_id_fk" FOREIGN KEY ("current_tier_id") REFERENCES "public"."tier"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_answer" ADD CONSTRAINT "forum_answer_question_id_forum_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."forum_question"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_answer_vote" ADD CONSTRAINT "forum_answer_vote_answer_id_forum_answer_id_fk" FOREIGN KEY ("answer_id") REFERENCES "public"."forum_answer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_question" ADD CONSTRAINT "forum_question_category_id_forum_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."forum_category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_question_tag" ADD CONSTRAINT "forum_question_tag_question_id_forum_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."forum_question"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_question_tag" ADD CONSTRAINT "forum_question_tag_tag_id_forum_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."forum_tag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "city_country_normalized_name_unique_idx" ON "city" USING btree ("country_id","normalized_name");--> statement-breakpoint
CREATE UNIQUE INDEX "city_country_id_id_unique_idx" ON "city" USING btree ("country_id","id");--> statement-breakpoint
CREATE INDEX "city_country_idx" ON "city" USING btree ("country_id");--> statement-breakpoint
CREATE INDEX "city_name_idx" ON "city" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "country_normalized_name_unique_idx" ON "country" USING btree ("normalized_name");--> statement-breakpoint
CREATE INDEX "country_name_idx" ON "country" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "interest_slug_unique_idx" ON "interest" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "interest_label_unique_idx" ON "interest" USING btree ("label");--> statement-breakpoint
CREATE INDEX "interest_active_idx" ON "interest" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "tier_slug_unique_idx" ON "tier" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "tier_rank_order_unique_idx" ON "tier" USING btree ("rank_order");--> statement-breakpoint
CREATE UNIQUE INDEX "tier_min_points_unique_idx" ON "tier" USING btree ("min_points");--> statement-breakpoint
CREATE INDEX "user_contribution_onboard_user_id_idx" ON "user_contribution_onboard" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_interest_user_interest_unique_idx" ON "user_interest" USING btree ("user_id","interest_id");--> statement-breakpoint
CREATE INDEX "user_interest_user_id_idx" ON "user_interest" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_interest_interest_id_idx" ON "user_interest" USING btree ("interest_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_point_ledger_event_key_unique_idx" ON "user_point_ledger" USING btree ("event_key");--> statement-breakpoint
CREATE INDEX "user_point_ledger_user_id_idx" ON "user_point_ledger" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_point_ledger_action_type_idx" ON "user_point_ledger" USING btree ("action_type");--> statement-breakpoint
CREATE UNIQUE INDEX "user_profile_user_id_unique_idx" ON "user_profile" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_profile_country_id_idx" ON "user_profile" USING btree ("country_id");--> statement-breakpoint
CREATE INDEX "user_profile_city_id_idx" ON "user_profile" USING btree ("city_id");--> statement-breakpoint
CREATE INDEX "user_progress_current_tier_id_idx" ON "user_progress" USING btree ("current_tier_id");--> statement-breakpoint
CREATE INDEX "forum_answer_question_idx" ON "forum_answer" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "forum_answer_author_idx" ON "forum_answer" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "forum_answer_status_idx" ON "forum_answer" USING btree ("status");--> statement-breakpoint
CREATE INDEX "forum_answer_created_idx" ON "forum_answer" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "forum_answer_vote_answer_voter_unique_idx" ON "forum_answer_vote" USING btree ("answer_id","voter_id");--> statement-breakpoint
CREATE INDEX "forum_answer_vote_answer_idx" ON "forum_answer_vote" USING btree ("answer_id");--> statement-breakpoint
CREATE INDEX "forum_answer_vote_voter_idx" ON "forum_answer_vote" USING btree ("voter_id");--> statement-breakpoint
CREATE INDEX "forum_answer_vote_type_idx" ON "forum_answer_vote" USING btree ("vote_type");--> statement-breakpoint
CREATE UNIQUE INDEX "forum_category_slug_unique_idx" ON "forum_category" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "forum_category_name_unique_idx" ON "forum_category" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "forum_category_status_idx" ON "forum_category" USING btree ("status");--> statement-breakpoint
CREATE INDEX "forum_category_order_idx" ON "forum_category" USING btree ("display_order");--> statement-breakpoint
CREATE INDEX "forum_question_category_idx" ON "forum_question" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "forum_question_author_idx" ON "forum_question" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "forum_question_status_idx" ON "forum_question" USING btree ("status");--> statement-breakpoint
CREATE INDEX "forum_question_created_idx" ON "forum_question" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "forum_question_tag_question_tag_unique_idx" ON "forum_question_tag" USING btree ("question_id","tag_id");--> statement-breakpoint
CREATE INDEX "forum_question_tag_question_idx" ON "forum_question_tag" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "forum_question_tag_tag_question_idx" ON "forum_question_tag" USING btree ("tag_id","question_id");--> statement-breakpoint
CREATE UNIQUE INDEX "forum_tag_normalized_name_unique_idx" ON "forum_tag" USING btree ("normalized_name");--> statement-breakpoint
CREATE INDEX "forum_tag_name_idx" ON "forum_tag" USING btree ("name");