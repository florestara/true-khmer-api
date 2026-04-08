import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { user } from "./user";

// MVP forum schema: categories, questions, and answers.

export const forumCategoryStatus = pgEnum("forum_category_status", [
  "ACTIVE",
  "ARCHIVED",
  "HIDDEN",
]);

export const forumQuestionStatus = pgEnum("forum_question_status", [
  "PUBLISHED",
  "CLOSED",
  "DELETED",
]);

export const forumAnswerStatus = pgEnum("forum_answer_status", [
  "PUBLISHED",
  "DELETED",
]);

export const forumAnswerVoteType = pgEnum("forum_answer_vote_type", [
  "UPVOTE",
  "DOWNVOTE",
]);

export const forumQuestionVoteType = pgEnum("forum_question_vote_type", [
  "UPVOTE",
  "DOWNVOTE",
]);

export const forumCategory = pgTable(
  "forum_category",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    description: text("description"),
    displayOrder: integer("display_order").default(0).notNull(),
    status: forumCategoryStatus("status").default("ACTIVE").notNull(),
    createdBy: uuid("created_by").notNull(),
    updatedBy: uuid("updated_by"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    archivedAt: timestamp("archived_at", {
      withTimezone: true,
      mode: "string",
    }),
  },
  (table) => [
    uniqueIndex("forum_category_slug_unique_idx").using("btree", table.slug),
    uniqueIndex("forum_category_name_unique_idx").using(
      "btree",
      sql`lower(${table.name})`,
    ),
    index("forum_category_status_idx").using("btree", table.status),
    index("forum_category_order_idx").using("btree", table.displayOrder),
  ],
);

export const forumQuestion = pgTable(
  "forum_question",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => forumCategory.id),
    authorId: uuid("author_id")
      .notNull()
      .references(() => user.id),
    title: varchar("title", { length: 300 }).notNull(),
    body: text("body").notNull(),
    status: forumQuestionStatus("status").default("PUBLISHED").notNull(),
    answerCount: integer("answer_count").default(0).notNull(),
    upvoteCount: integer("upvote_count").default(0).notNull(),
    downvoteCount: integer("downvote_count").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [
    index("forum_question_category_idx").using("btree", table.categoryId),
    index("forum_question_author_idx").using("btree", table.authorId),
    index("forum_question_status_idx").using("btree", table.status),
    index("forum_question_created_idx").using("btree", table.createdAt),
  ],
);

export const forumQuestionVote = pgTable(
  "forum_question_vote",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => forumQuestion.id, { onDelete: "cascade" }),
    voterId: uuid("voter_id")
      .notNull()
      .references(() => user.id),
    voteType: forumQuestionVoteType("vote_type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("forum_question_vote_question_voter_unique_idx").using(
      "btree",
      table.questionId,
      table.voterId,
    ),
    index("forum_question_vote_question_idx").using("btree", table.questionId),
    index("forum_question_vote_voter_idx").using("btree", table.voterId),
    index("forum_question_vote_type_idx").using("btree", table.voteType),
  ],
);

export const forumAnswer = pgTable(
  "forum_answer",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => forumQuestion.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => user.id),
    body: text("body").notNull(),
    status: forumAnswerStatus("status").default("PUBLISHED").notNull(),
    upvoteCount: integer("upvote_count").default(0).notNull(),
    downvoteCount: integer("downvote_count").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [
    index("forum_answer_question_idx").using("btree", table.questionId),
    index("forum_answer_author_idx").using("btree", table.authorId),
    index("forum_answer_status_idx").using("btree", table.status),
    index("forum_answer_created_idx").using("btree", table.createdAt),
  ],
);

export const forumAnswerVote = pgTable(
  "forum_answer_vote",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    answerId: uuid("answer_id")
      .notNull()
      .references(() => forumAnswer.id, { onDelete: "cascade" }),
    voterId: uuid("voter_id")
      .notNull()
      .references(() => user.id),
    voteType: forumAnswerVoteType("vote_type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("forum_answer_vote_answer_voter_unique_idx").using(
      "btree",
      table.answerId,
      table.voterId,
    ),
    index("forum_answer_vote_answer_idx").using("btree", table.answerId),
    index("forum_answer_vote_voter_idx").using("btree", table.voterId),
    index("forum_answer_vote_type_idx").using("btree", table.voteType),
  ],
);

export const forumReportingType = pgTable(
  "forum_reporting_type",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    type: varchar("type", { length: 150 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("forum_reporting_type_type_unique_idx").using(
      "btree",
      table.type,
    ),
  ],
);

export const forumReporting = pgTable("forum_reporting", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  questionId: uuid("question_id").references(() => forumQuestion.id, {
    onDelete: "cascade",
  }),
  answerId: uuid("answer_id").references(() => forumAnswer.id, {
    onDelete: "cascade",
  }),
  typeId: uuid("type_id")
    .notNull()
    .references(() => forumReportingType.id),
  description: text("description"),
  createdBy: uuid("created_by").references(() => user.id),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
});

export const forumCategoryRelations = relations(forumCategory, ({ many }) => ({
  questions: many(forumQuestion),
}));

export const forumQuestionRelations = relations(
  forumQuestion,
  ({ one, many }) => ({
    category: one(forumCategory, {
      fields: [forumQuestion.categoryId],
      references: [forumCategory.id],
    }),
    author: one(user, {
      fields: [forumQuestion.authorId],
      references: [user.id],
    }),
    answers: many(forumAnswer),
    votes: many(forumQuestionVote),
  }),
);

export const forumQuestionVoteRelations = relations(
  forumQuestionVote,
  ({ one }) => ({
    question: one(forumQuestion, {
      fields: [forumQuestionVote.questionId],
      references: [forumQuestion.id],
    }),
    voter: one(user, {
      fields: [forumQuestionVote.voterId],
      references: [user.id],
    }),
  }),
);

export const forumAnswerRelations = relations(forumAnswer, ({ one, many }) => ({
  question: one(forumQuestion, {
    fields: [forumAnswer.questionId],
    references: [forumQuestion.id],
  }),
  author: one(user, {
    fields: [forumAnswer.authorId],
    references: [user.id],
  }),
  votes: many(forumAnswerVote),
}));

export const forumAnswerVoteRelations = relations(
  forumAnswerVote,
  ({ one }) => ({
    answer: one(forumAnswer, {
      fields: [forumAnswerVote.answerId],
      references: [forumAnswer.id],
    }),
    voter: one(user, {
      fields: [forumAnswerVote.voterId],
      references: [user.id],
    }),
  }),
);

export const forumReportingTypeRelations = relations(
  forumReportingType,
  ({ many }) => ({
    reportings: many(forumReporting),
  }),
);

export const forumReportingRelations = relations(forumReporting, ({ one }) => ({
  question: one(forumQuestion, {
    fields: [forumReporting.questionId],
    references: [forumQuestion.id],
  }),
  answer: one(forumAnswer, {
    fields: [forumReporting.answerId],
    references: [forumAnswer.id],
  }),
  type: one(forumReportingType, {
    fields: [forumReporting.typeId],
    references: [forumReportingType.id],
  }),
}));
