-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TYPE "public"."access_level" AS ENUM('VIEW_ONLY', 'LIMITED', 'STANDARD', 'ADMIN', 'FULL');--> statement-breakpoint
CREATE TYPE "public"."event_category_status" AS ENUM('DRAFT', 'ACTIVE', 'INACTIVE', 'DELETED');--> statement-breakpoint
CREATE TYPE "public"."event_entry_mode" AS ENUM('TICKETED', 'RSVP', 'OPEN_ACCESS');--> statement-breakpoint
CREATE TYPE "public"."event_registration_mode" AS ENUM('ANYONE', 'REQUIRED_APPROVAL', 'INVITED_GUESTS_ONLY');--> statement-breakpoint
CREATE TYPE "public"."event_staff_role" AS ENUM('ORGANIZER', 'CO_ORGANIZER', 'SPEAKER', 'MODERATOR', 'VOLUNTEER', 'CHECK_IN', 'SUPPORT', 'MEDIA', 'SECURITY', 'VENDOR', 'SPONSOR_REP', 'PHOTOGRAPHER', 'VIDEOGRAPHER', 'TECHNICAL', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."event_staff_status" AS ENUM('INVITED', 'PENDING', 'ACCEPTED', 'DECLINED', 'ACTIVE', 'INACTIVE', 'REMOVED');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('DRAFT', 'PUBLISHED', 'COMPLETED', 'CANCELLED', 'POSTPONED', 'ACTIVE', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."event_ticket_status" AS ENUM('AVAILABLE', 'ALMOST_FULL', 'SOLD_OUT', 'WAITING_LIST');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('CONFERENCE', 'WORKSHOP', 'SEMINAR', 'CONCERT', 'FESTIVAL', 'EXHIBITION', 'NETWORKING', 'TRAINING', 'WEBINAR', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."event_visibility" AS ENUM('LISTED', 'UNLISTED');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('MALE', 'FEMALE', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('DRAFT', 'PENDING', 'CONFIRMED', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'REFUNDED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."organization_invitation_status" AS ENUM('PENDING', 'ACCEPTED', 'DECLINED', 'REVOKED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."organization_member_role" AS ENUM('OWNER', 'ADMIN', 'MANAGER', 'EDITOR', 'MEMBER');--> statement-breakpoint
CREATE TYPE "public"."organization_member_status" AS ENUM('ACTIVE', 'INVITED', 'REJECTED', 'LEFT', 'REVOKED');--> statement-breakpoint
CREATE TYPE "public"."organization_type" AS ENUM('COMPANY', 'NGO');--> statement-breakpoint
CREATE TYPE "public"."payment_gateway" AS ENUM('PAYWAY', 'PAYPAL', 'STRIPE', 'CASH', 'BANK_TRANSFER', 'CRYPTO');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED');--> statement-breakpoint
CREATE TYPE "public"."promotion_scope" AS ENUM('EVENT', 'TICKET_TIER', 'GLOBAL', 'USER_SPECIFIC');--> statement-breakpoint
CREATE TYPE "public"."promotion_status" AS ENUM('DRAFT', 'ACTIVE', 'PAUSED', 'EXPIRED', 'CANCELLED', 'USED_UP');--> statement-breakpoint
CREATE TYPE "public"."promotion_type" AS ENUM('PERCENTAGE', 'FIXED_AMOUNT', 'BUY_X_GET_Y', 'FREE_SHIPPING', 'EARLY_BIRD', 'BULK_DISCOUNT');--> statement-breakpoint
CREATE TYPE "public"."ticket_tier_status" AS ENUM('DRAFT', 'ACTIVE', 'PAUSED', 'SOLD_OUT', 'EXPIRED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."ticket_tier_type" AS ENUM('FREE', 'PAID', 'DONATION', 'VIP', 'EARLY_BIRD', 'GROUP', 'STUDENT');--> statement-breakpoint
CREATE TYPE "public"."token_nonce_purpose" AS ENUM('VERIFY_EMAIL', 'RESET_PASSWORD', 'MAGIC_LOGIN', 'PAYMENT_CALLBACK', 'CONFIRM_EMAIL_CHANGE', 'CONFIRM_ACCOUNT_DELETION', 'ORGANIZATION_INVITATION', 'EVENT_STAFF_INVITATION');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('USER', 'ADMIN');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('STAGED', 'ACTIVE', 'RECOVERY', 'BANNED', 'SUSPENDED', 'LOCKED', 'DEACTIVATED', 'DELETED');--> statement-breakpoint
CREATE SEQUENCE "public"."order_number_seq" INCREMENT BY 1 MINVALUE 1000000 MAXVALUE 99999999 START WITH 1000000 CACHE 1;--> statement-breakpoint
CREATE TABLE "event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid,
	"title" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"sub_title" varchar(255),
	"description" text,
	"excerpt" varchar(500) NOT NULL,
	"cover" varchar(500),
	"photos" jsonb,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"registration_start_at" timestamp with time zone,
	"registration_end_at" timestamp with time zone,
	"agenda" jsonb,
	"organizer_info" jsonb,
	"speakers" jsonb,
	"sponsors" jsonb,
	"event_type" "event_type" DEFAULT 'OTHER',
	"venue_id" uuid,
	"online_url" varchar(500),
	"meeting_id" varchar(100),
	"meeting_password" varchar(100),
	"max_attendees" integer,
	"min_attendees" integer DEFAULT 1,
	"current_attendees" integer DEFAULT 0,
	"base_price" numeric(12, 2),
	"currency_code" char(3) DEFAULT 'USD',
	"qr" varchar(500),
	"tracking_code" varchar(100),
	"status" "event_status" DEFAULT 'DRAFT' NOT NULL,
	"is_online" boolean DEFAULT false NOT NULL,
	"is_hybrid" boolean DEFAULT false NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"is_recurring" boolean DEFAULT false NOT NULL,
	"is_paid" boolean DEFAULT false NOT NULL,
	"is_private" boolean DEFAULT false NOT NULL,
	"requires_approval" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"view_count" integer DEFAULT 0,
	"meta_title" varchar(60),
	"meta_description" varchar(160),
	"social_image" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"venue" jsonb,
	"venue_name" varchar(255),
	"sale_price" numeric(12, 2),
	"ticket_status" "event_ticket_status" DEFAULT 'AVAILABLE' NOT NULL,
	"thumbnail" varchar(500),
	"organization_id" uuid,
	"visibility" "event_visibility" DEFAULT 'LISTED' NOT NULL,
	"registration_mode" "event_registration_mode" DEFAULT 'ANYONE' NOT NULL,
	"entry_mode" "event_entry_mode" DEFAULT 'TICKETED' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_venue_id_venue_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venue"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "event_attendees_idx" ON "event" USING btree ("current_attendees" int4_ops);--> statement-breakpoint
CREATE INDEX "event_capacity_idx" ON "event" USING btree ("max_attendees" int4_ops);--> statement-breakpoint
CREATE INDEX "event_created_by_idx" ON "event" USING btree ("created_by" uuid_ops);--> statement-breakpoint
CREATE INDEX "event_created_by_status_idx" ON "event" USING btree ("created_by" uuid_ops,"status" uuid_ops);--> statement-breakpoint
CREATE INDEX "event_created_idx" ON "event" USING btree ("created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "event_end_at_idx" ON "event" USING btree ("end_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "event_entry_mode_idx" ON "event" USING btree ("entry_mode" enum_ops);--> statement-breakpoint
CREATE INDEX "event_featured_idx" ON "event" USING btree ("is_featured" bool_ops);--> statement-breakpoint
CREATE INDEX "event_featured_published_idx" ON "event" USING btree ("is_featured" bool_ops,"published_at" bool_ops);--> statement-breakpoint
CREATE INDEX "event_online_idx" ON "event" USING btree ("is_online" bool_ops);--> statement-breakpoint
CREATE INDEX "event_online_start_idx" ON "event" USING btree ("is_online" timestamptz_ops,"start_at" bool_ops);--> statement-breakpoint
CREATE INDEX "event_organization_idx" ON "event" USING btree ("organization_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "event_paid_idx" ON "event" USING btree ("is_paid" bool_ops);--> statement-breakpoint
CREATE INDEX "event_private_idx" ON "event" USING btree ("is_private" bool_ops);--> statement-breakpoint
CREATE INDEX "event_published_at_idx" ON "event" USING btree ("published_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "event_registration_mode_idx" ON "event" USING btree ("registration_mode" enum_ops);--> statement-breakpoint
CREATE INDEX "event_registration_period_idx" ON "event" USING btree ("registration_start_at" timestamptz_ops,"registration_end_at" timestamptz_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "event_slug_unique_idx" ON "event" USING btree ("slug" text_ops);--> statement-breakpoint
CREATE INDEX "event_start_at_idx" ON "event" USING btree ("start_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "event_status_idx" ON "event" USING btree ("status" enum_ops);--> statement-breakpoint
CREATE INDEX "event_status_start_idx" ON "event" USING btree ("status" enum_ops,"start_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "event_type_idx" ON "event" USING btree ("event_type" enum_ops);--> statement-breakpoint
CREATE INDEX "event_type_status_idx" ON "event" USING btree ("event_type" enum_ops,"status" enum_ops);--> statement-breakpoint
CREATE INDEX "event_updated_idx" ON "event" USING btree ("updated_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "event_venue_idx" ON "event" USING btree ("venue_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "event_venue_start_idx" ON "event" USING btree ("venue_id" timestamptz_ops,"start_at" uuid_ops);--> statement-breakpoint
CREATE INDEX "event_view_count_idx" ON "event" USING btree ("view_count" int4_ops);--> statement-breakpoint
CREATE INDEX "event_visibility_idx" ON "event" USING btree ("visibility" enum_ops);
*/