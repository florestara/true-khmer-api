ALTER TABLE "notification" ADD COLUMN "event_type" text;--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN "dedupe_key" text;--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN "aggregate_count" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "notification_user_dedupe_idx" ON "notification" USING btree ("user_id","dedupe_key");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_unread_dedupe_unique_idx" ON "notification" USING btree ("user_id","dedupe_key") WHERE "notification"."dedupe_key" is not null and "notification"."is_read" = false and "notification"."archived" = false;