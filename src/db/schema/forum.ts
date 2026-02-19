import { sql } from "drizzle-orm";
import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  integer,
} from "drizzle-orm/pg-core";

// MVP forum schema: categories/subcategories, questions, and answers.

export const forumCategoryType = pgEnum("forum_category_type", [
  "CATEGORY",
  "SUBCATEGORY",
]);

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

export const forumCategory = pgTable(
  "forum_category",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    parentId: uuid("parent_id"),
    type: forumCategoryType("type").default("CATEGORY").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    description: text("description"),
    icon: varchar("icon", { length: 255 }),
    color: varchar("color", { length: 30 }),
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
    archivedAt: timestamp("archived_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [
    uniqueIndex("forum_category_slug_unique_idx").using("btree", table.slug),
    uniqueIndex("forum_category_root_name_unique_idx")
      .using("btree", table.name)
      .where(sql`${table.parentId} is null`),
    uniqueIndex("forum_category_parent_name_unique_idx")
      .using("btree", table.parentId, table.name)
      .where(sql`${table.parentId} is not null`),
    index("forum_category_parent_idx").using("btree", table.parentId),
    index("forum_category_parent_name_idx").using(
      "btree",
      table.parentId,
      table.name,
    ),
    index("forum_category_status_idx").using("btree", table.status),
    index("forum_category_type_idx").using("btree", table.type),
    index("forum_category_order_idx").using("btree", table.displayOrder),
  ],
);

export const forumQuestion = pgTable(
  "forum_question",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    categoryId: uuid("category_id").notNull(),
    authorId: uuid("author_id").notNull(),
    title: varchar("title", { length: 300 }).notNull(),
    body: text("body").notNull(),
    status: forumQuestionStatus("status").default("PUBLISHED").notNull(),
    answerCount: integer("answer_count").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("forum_question_category_idx").using("btree", table.categoryId),
    index("forum_question_author_idx").using("btree", table.authorId),
    index("forum_question_status_idx").using("btree", table.status),
    index("forum_question_created_idx").using("btree", table.createdAt),
  ],
);

export const forumAnswer = pgTable(
  "forum_answer",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    questionId: uuid("question_id").notNull(),
    authorId: uuid("author_id").notNull(),
    body: text("body").notNull(),
    status: forumAnswerStatus("status").default("PUBLISHED").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("forum_answer_question_idx").using("btree", table.questionId),
    index("forum_answer_author_idx").using("btree", table.authorId),
    index("forum_answer_status_idx").using("btree", table.status),
    index("forum_answer_created_idx").using("btree", table.createdAt),
  ],
);
