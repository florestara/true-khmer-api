import { index, pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { forumQuestion } from "./forum";

export const forumTag = pgTable(
  "forum_tag",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    name: varchar("name", { length: 30 }).notNull(),
    normalizedName: varchar("normalized_name", { length: 30 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("forum_tag_normalized_name_unique_idx").using(
      "btree",
      table.normalizedName
    ),
    index("forum_tag_name_idx").using("btree", table.name),
  ]
);

export const forumQuestionTag = pgTable(
  "forum_question_tag",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => forumQuestion.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => forumTag.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("forum_question_tag_question_tag_unique_idx").using(
      "btree",
      table.questionId,
      table.tagId
    ),
    index("forum_question_tag_question_idx").using("btree", table.questionId),
    index("forum_question_tag_tag_question_idx").using(
      "btree",
      table.tagId,
      table.questionId
    ),
  ]
);
