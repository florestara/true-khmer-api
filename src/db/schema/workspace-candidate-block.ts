import { relations, sql } from "drizzle-orm";
import {
  index,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./user";

export const workspaceCandidateBlockSourceTypeEnum = pgEnum(
  "workspace_candidate_block_source_type",
  ["VOLUNTEER", "PROJECT"],
);

export const workspaceCandidateBlockStatusEnum = pgEnum(
  "workspace_candidate_block_status",
  ["ACTIVE", "INACTIVE"],
);

export const workspaceCandidateBlock = pgTable(
  "workspace_candidate_block",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    sourceType: workspaceCandidateBlockSourceTypeEnum("source_type").notNull(),
    postingId: uuid("posting_id").notNull(),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: workspaceCandidateBlockStatusEnum("status")
      .default("ACTIVE")
      .notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => user.id),
    updatedBy: uuid("updated_by")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql`now()`),
  },
  (table) => [
    uniqueIndex("workspace_candidate_block_source_posting_candidate_unique_idx").on(
      table.sourceType,
      table.postingId,
      table.candidateId,
    ),
    index("workspace_candidate_block_candidate_idx").on(table.candidateId),
    index("workspace_candidate_block_created_by_idx").on(table.createdBy),
  ],
);

export const workspaceCandidateBlockRelations = relations(
  workspaceCandidateBlock,
  ({ one }) => ({
    candidate: one(user, {
      fields: [workspaceCandidateBlock.candidateId],
      references: [user.id],
    }),
    creator: one(user, {
      fields: [workspaceCandidateBlock.createdBy],
      references: [user.id],
    }),
    updater: one(user, {
      fields: [workspaceCandidateBlock.updatedBy],
      references: [user.id],
    }),
  }),
);
