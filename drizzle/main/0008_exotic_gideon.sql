CREATE TYPE "public"."point_systems_mode" AS ENUM('action', 'support');--> statement-breakpoint
CREATE TYPE "public"."point_transactions_action_type" AS ENUM('purchase_tk_merch', 'purchase_marketplace', 'purchase_new_merchant_bonus', 'purchase_service', 'leave_review', 'merchant_verified', 'course_published', 'course_completed', 'resource_approved', 'forum_question_posted', 'forum_first_question_bonus', 'forum_participation', 'forum_helpful_answer', 'forum_best_answer', 'forum_answer_upvotes', 'forum_question_upvotes', 'volunteer_opportunity_posted', 'volunteer_registered', 'volunteer_mission_completed', 'volunteer_5star_bonus', 'launchpad_completion_proposer', 'launchpad_completion_participant', 'launchpad_project_validated_proposer', 'launchpad_project_validated_participant', 'mentorship_session_mentor', 'mentorship_session_mentee', 'mentorship_5star_bonus', 'mentorship_review_bonus', 'event_attended_khmer_talk', 'event_attended_networking', 'event_attended_discover', 'event_organised', 'event_organised_rating_bonus', 'khmer_talk_speaker', 'referral_active_member', 'welcome_profile_complete', 'tier_advancement_bonus', 'redemtion_deduction');--> statement-breakpoint
CREATE TYPE "public"."point_transactions_mode" AS ENUM('action', 'support');--> statement-breakpoint
CREATE TYPE "public"."point_transactions_pool" AS ENUM('active', 'legacy', 'tier');--> statement-breakpoint
CREATE TABLE "point_systems" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar NOT NULL,
	"value" integer DEFAULT 0 NOT NULL,
	"description" varchar,
	"max_per_day" integer DEFAULT 1 NOT NULL,
	"mode" "point_systems_mode" DEFAULT 'action' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "point_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"action_type" "point_transactions_action_type" NOT NULL,
	"points" integer NOT NULL,
	"reference_type" varchar,
	"reference_id" uuid,
	"pool" "point_transactions_pool" DEFAULT 'active' NOT NULL,
	"mode" "point_transactions_mode" DEFAULT 'action' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tier_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tier_id" uuid NOT NULL,
	"achieved_at" timestamp DEFAULT now() NOT NULL,
	"points_at_time" integer NOT NULL
);
--> statement-breakpoint
DROP TABLE "user_point_ledger" CASCADE;--> statement-breakpoint
ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tier_history" ADD CONSTRAINT "tier_history_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tier_history" ADD CONSTRAINT "tier_history_tier_id_tier_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."tier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "point_systems_key_unique_idx" ON "point_systems" USING btree ("key");--> statement-breakpoint
CREATE INDEX "point_transactions_user_id_idx" ON "point_transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tier_history_user_id_idx" ON "tier_history" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tier_history_tier_id_idx" ON "tier_history" USING btree ("tier_id");