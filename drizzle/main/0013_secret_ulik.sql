CREATE TABLE "launchpad_role" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"launchpad_id" uuid NOT NULL,
	"title" varchar(120) NOT NULL,
	"capacity" integer DEFAULT 1 NOT NULL,
	"description" text,
	"created_by" uuid NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "launchpad" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid,
	"name" varchar(120) NOT NULL,
	"description" text,
	"city_id" uuid,
	"deadline" timestamp with time zone,
	"logo_key" varchar(255),
	"cover_key" varchar(255),
	"document_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"phone_number" varchar(20),
	"email" varchar(255),
	"telegram_username" varchar(255),
	"website" varchar(255),
	"created_by" uuid NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "launchpad_role" ADD CONSTRAINT "launchpad_role_launchpad_id_launchpad_id_fk" FOREIGN KEY ("launchpad_id") REFERENCES "public"."launchpad"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "launchpad_role" ADD CONSTRAINT "launchpad_role_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "launchpad_role" ADD CONSTRAINT "launchpad_role_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "launchpad" ADD CONSTRAINT "launchpad_category_id_launchpad_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."launchpad_category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "launchpad" ADD CONSTRAINT "launchpad_city_id_city_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."city"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "launchpad" ADD CONSTRAINT "launchpad_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "launchpad" ADD CONSTRAINT "launchpad_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "launchpad_role_title_unique_idx" ON "launchpad_role" USING btree ("launchpad_id",lower("title"));--> statement-breakpoint
CREATE INDEX "launchpad_category_id_idx" ON "launchpad" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "launchpad_city_id_idx" ON "launchpad" USING btree ("city_id");--> statement-breakpoint
CREATE UNIQUE INDEX "launchpad_name_unique_idx" ON "launchpad" USING btree (lower("name"));