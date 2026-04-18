ALTER TABLE "forum_answer" ADD COLUMN "reply_to" uuid;--> statement-breakpoint
ALTER TABLE "forum_answer" ADD COLUMN "reply_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "forum_answer" ADD CONSTRAINT "forum_answer_reply_to_forum_answer_id_fk" FOREIGN KEY ("reply_to") REFERENCES "public"."forum_answer"("id") ON DELETE no action ON UPDATE no action;
