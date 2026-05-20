ALTER TABLE "fcm_token" DROP CONSTRAINT "fcm_token_user_token_unique";--> statement-breakpoint
ALTER TABLE "notification" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "fcm_token" ADD CONSTRAINT "fcm_token_unique" UNIQUE("token");