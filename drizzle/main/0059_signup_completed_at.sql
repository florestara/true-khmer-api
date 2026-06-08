ALTER TABLE "user" ADD COLUMN "signup_completed_at" timestamp;--> statement-breakpoint
UPDATE "user"
SET "signup_completed_at" = "created_at"
WHERE "signup_completed_at" IS NULL
