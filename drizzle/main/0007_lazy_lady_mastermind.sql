CREATE TABLE IF NOT EXISTS "forum_reporting" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid,
	"answer_id" uuid,
	"type_id" uuid NOT NULL,
	"description" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "forum_reporting" ADD CONSTRAINT "forum_reporting_question_id_forum_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."forum_question"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "forum_reporting" ADD CONSTRAINT "forum_reporting_answer_id_forum_answer_id_fk" FOREIGN KEY ("answer_id") REFERENCES "public"."forum_answer"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "forum_reporting" ADD CONSTRAINT "forum_reporting_type_id_forum_reporting_type_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."forum_reporting_type"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "forum_reporting" ADD CONSTRAINT "forum_reporting_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;