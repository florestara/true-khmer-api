ALTER TABLE "volunteer_application" ADD COLUMN IF NOT EXISTS "supporting_documents" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
UPDATE "volunteer_application"
SET "supporting_documents" = COALESCE(
  (
    SELECT jsonb_agg(
      jsonb_build_object(
        'name',
        COALESCE(
          "document_names"."value",
          regexp_replace("document_keys"."value", '^.*/', '')
        ),
        'key',
        "document_keys"."value"
      )
      ORDER BY "document_keys"."ordinality"
    )
    FROM jsonb_array_elements_text("volunteer_application"."supporting_document_keys") WITH ORDINALITY AS "document_keys"("value", "ordinality")
    LEFT JOIN jsonb_array_elements_text("volunteer_application"."supporting_document_names") WITH ORDINALITY AS "document_names"("value", "ordinality")
      ON "document_names"."ordinality" = "document_keys"."ordinality"
  ),
  '[]'::jsonb
);--> statement-breakpoint
ALTER TABLE "volunteer_application" DROP CONSTRAINT IF EXISTS "volunteer_application_supporting_document_keys_array_check";--> statement-breakpoint
ALTER TABLE "volunteer_application" DROP CONSTRAINT IF EXISTS "volunteer_application_supporting_document_names_array_check";--> statement-breakpoint
ALTER TABLE "volunteer_application" DROP CONSTRAINT IF EXISTS "volunteer_application_supporting_documents_array_check";--> statement-breakpoint
ALTER TABLE "volunteer_application" ADD CONSTRAINT "volunteer_application_supporting_documents_array_check" CHECK (jsonb_typeof("volunteer_application"."supporting_documents") = 'array');--> statement-breakpoint
ALTER TABLE "volunteer_application" DROP COLUMN IF EXISTS "supporting_document_keys";--> statement-breakpoint
ALTER TABLE "volunteer_application" DROP COLUMN IF EXISTS "supporting_document_names";
