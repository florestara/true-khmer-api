ALTER TABLE "point_transactions" DROP CONSTRAINT "point_transactions_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "tier_history" DROP CONSTRAINT "tier_history_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "tier_history" DROP CONSTRAINT "tier_history_tier_id_tier_id_fk";
--> statement-breakpoint
ALTER TABLE "point_transactions" ALTER COLUMN "action_type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."point_transactions_action_type";--> statement-breakpoint
CREATE TYPE "public"."point_transactions_action_type" AS ENUM('purchase_tk_merch', 'purchase_marketplace', 'purchase_new_merchant_bonus', 'purchase_service', 'leave_review', 'merchant_verified', 'course_published', 'course_completed', 'resource_approved', 'forum_question_posted', 'forum_first_question_bonus', 'forum_participation', 'forum_helpful_answer', 'forum_best_answer', 'forum_answer_upvotes', 'forum_question_upvotes', 'volunteer_opportunity_posted', 'volunteer_registered', 'volunteer_mission_completed', 'volunteer_5star_bonus', 'launchpad_completion_proposer', 'launchpad_completion_participant', 'launchpad_project_validated_proposer', 'launchpad_project_validated_participant', 'mentorship_session_mentor', 'mentorship_session_mentee', 'mentorship_5star_bonus', 'mentorship_review_bonus', 'event_attended_khmer_talk', 'event_attended_networking', 'event_attended_discover', 'event_organised', 'event_organised_rating_bonus', 'khmer_talk_speaker', 'referral_active_member', 'welcome_profile_complete', 'tier_advancement_bonus', 'redemption_deduction');--> statement-breakpoint
ALTER TABLE "point_transactions" ALTER COLUMN "action_type" SET DATA TYPE "public"."point_transactions_action_type" USING "action_type"::"public"."point_transactions_action_type";--> statement-breakpoint
ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tier_history" ADD CONSTRAINT "tier_history_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tier_history" ADD CONSTRAINT "tier_history_tier_id_tier_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."tier"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tier_history_user_tier_unique_idx" ON "tier_history" USING btree ("user_id","tier_id");