CREATE TABLE "launchpad_save" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"launchpad_id" uuid NOT NULL,
	"saver_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "launchpad_save" ADD CONSTRAINT "launchpad_save_launchpad_id_launchpad_id_fk" FOREIGN KEY ("launchpad_id") REFERENCES "public"."launchpad"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "launchpad_save" ADD CONSTRAINT "launchpad_save_saver_id_user_id_fk" FOREIGN KEY ("saver_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "launchpad_save_launchpad_saver_unique_idx" ON "launchpad_save" USING btree ("launchpad_id","saver_id");--> statement-breakpoint
CREATE INDEX "launchpad_save_launchpad_idx" ON "launchpad_save" USING btree ("launchpad_id");--> statement-breakpoint
CREATE INDEX "launchpad_save_saver_idx" ON "launchpad_save" USING btree ("saver_id");