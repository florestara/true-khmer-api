ALTER TABLE "volunteer_application" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "launchpad_application" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
UPDATE "volunteer_application" SET "archived_at" = "updated_at" WHERE "archived" = true AND "archived_at" IS NULL;--> statement-breakpoint
UPDATE "launchpad_application" SET "archived_at" = "updated_at" WHERE "archived" = true AND "archived_at" IS NULL;
