CREATE TABLE "forum_question_save" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"saver_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "forum_question_save" ADD CONSTRAINT "forum_question_save_question_id_forum_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."forum_question"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_question_save" ADD CONSTRAINT "forum_question_save_saver_id_user_id_fk" FOREIGN KEY ("saver_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "forum_question_save_question_saver_unique_idx" ON "forum_question_save" USING btree ("question_id","saver_id");--> statement-breakpoint
CREATE INDEX "forum_question_save_question_idx" ON "forum_question_save" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "forum_question_save_saver_idx" ON "forum_question_save" USING btree ("saver_id");