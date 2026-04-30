CREATE TABLE "volunteer_opportunity_save" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"saver_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "volunteer_opportunity_save" ADD CONSTRAINT "volunteer_opportunity_save_opportunity_id_volunteer_opportunity_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."volunteer_opportunity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "volunteer_opportunity_save" ADD CONSTRAINT "volunteer_opportunity_save_saver_id_user_id_fk" FOREIGN KEY ("saver_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "volunteer_opportunity_save_opportunity_saver_unique_idx" ON "volunteer_opportunity_save" USING btree ("opportunity_id","saver_id");--> statement-breakpoint
CREATE INDEX "volunteer_opportunity_save_opportunity_idx" ON "volunteer_opportunity_save" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "volunteer_opportunity_save_saver_idx" ON "volunteer_opportunity_save" USING btree ("saver_id");