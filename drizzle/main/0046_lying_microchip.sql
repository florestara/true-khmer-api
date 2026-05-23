DROP INDEX "forum_question_save_saver_idx";--> statement-breakpoint
DROP INDEX "volunteer_opportunity_save_saver_idx";--> statement-breakpoint
DROP INDEX "launchpad_save_saver_idx";--> statement-breakpoint
CREATE INDEX "forum_question_save_saver_created_question_idx" ON "forum_question_save" USING btree ("saver_id","created_at","question_id");--> statement-breakpoint
CREATE INDEX "volunteer_opportunity_save_saver_created_opportunity_idx" ON "volunteer_opportunity_save" USING btree ("saver_id","created_at","opportunity_id");--> statement-breakpoint
CREATE INDEX "launchpad_save_saver_created_launchpad_idx" ON "launchpad_save" USING btree ("saver_id","created_at","launchpad_id");