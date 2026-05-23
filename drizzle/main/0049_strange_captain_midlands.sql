ALTER TABLE "notification" ADD COLUMN "type" text DEFAULT 'system' NOT NULL;--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN "web_route" text;--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN "mobile_route" text;--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN "archived" boolean DEFAULT false NOT NULL;