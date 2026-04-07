CREATE TYPE "public"."forum_question_vote_type" AS ENUM('UPVOTE', 'DOWNVOTE');--> statement-breakpoint
CREATE TABLE "forum_question_vote" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"voter_id" uuid NOT NULL,
	"vote_type" "forum_question_vote_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "forum_question" ADD COLUMN "upvote_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "forum_question" ADD COLUMN "downvote_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "forum_question" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "forum_question_vote" ADD CONSTRAINT "forum_question_vote_question_id_forum_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."forum_question"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "forum_question_vote_question_voter_unique_idx" ON "forum_question_vote" USING btree ("question_id","voter_id");--> statement-breakpoint
CREATE INDEX "forum_question_vote_question_idx" ON "forum_question_vote" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "forum_question_vote_voter_idx" ON "forum_question_vote" USING btree ("voter_id");--> statement-breakpoint
CREATE INDEX "forum_question_vote_type_idx" ON "forum_question_vote" USING btree ("vote_type");--> statement-breakpoint
