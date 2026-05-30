import { relations, sql } from "drizzle-orm";
import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./user";

export const workspaceApplicantNoteSourceTypeEnum = pgEnum(
  "workspace_applicant_note_source_type",
  ["VOLUNTEER", "PROJECT"],
);

export const workspaceApplicantNote = pgTable(
  "workspace_applicant_note",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    sourceType: workspaceApplicantNoteSourceTypeEnum("source_type").notNull(),
    postingId: uuid("posting_id").notNull(),
    applicantId: uuid("applicant_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    note: text("note").notNull().default(""),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    updatedBy: uuid("updated_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql`now()`),
  },
  (table) => [
    uniqueIndex("workspace_applicant_note_source_posting_applicant_unique_idx").on(
      table.sourceType,
      table.postingId,
      table.applicantId,
    ),
    index("workspace_applicant_note_applicant_idx").on(table.applicantId),
    index("workspace_applicant_note_created_by_idx").on(table.createdBy),
  ],
);

export const workspaceApplicantNoteRelations = relations(
  workspaceApplicantNote,
  ({ one }) => ({
    applicant: one(user, {
      fields: [workspaceApplicantNote.applicantId],
      references: [user.id],
    }),
    creator: one(user, {
      fields: [workspaceApplicantNote.createdBy],
      references: [user.id],
    }),
    updater: one(user, {
      fields: [workspaceApplicantNote.updatedBy],
      references: [user.id],
    }),
  }),
);
