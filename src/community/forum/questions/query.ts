import { desc, eq, inArray, lt } from "drizzle-orm";
import { db } from "../../../db/index";
import {
  forumCategory,
  forumQuestion,
  forumQuestionTag,
  forumTag,
} from "../../../db/schema";
import type { CreateQuestionInput } from "./schema";

type ForumCategoryRow = typeof forumCategory.$inferSelect;
type ForumQuestionRow = typeof forumQuestion.$inferSelect;
type ForumQuestionInsert = typeof forumQuestion.$inferInsert;
type ForumQuestionTagInsert = typeof forumQuestionTag.$inferInsert;
type ForumTagInsert = typeof forumTag.$inferInsert;
type ForumQuestionWithTags = ForumQuestionRow & { tags: string[] };
type QuestionsPageResult = {
  questions: ForumQuestionWithTags[];
  nextCursor: string | null;
  hasMore: boolean;
};

function normalizeTagName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export async function findCategoryById(id: string): Promise<ForumCategoryRow | null> {
  const rows = await db.select().from(forumCategory).where(eq(forumCategory.id, id));
  return rows[0] ?? null;
}

export async function findQuestionById(id: string): Promise<ForumQuestionWithTags | null> {
  const rows = await db
    .select({
      question: forumQuestion,
      tagName: forumTag.name,
    })
    .from(forumQuestion)
    .leftJoin(forumQuestionTag, eq(forumQuestionTag.questionId, forumQuestion.id))
    .leftJoin(forumTag, eq(forumTag.id, forumQuestionTag.tagId))
    .where(eq(forumQuestion.id, id));

  if (rows.length === 0) {
    return null;
  }

  const question = rows[0].question;
  const tags = Array.from(
    new Set(
      rows
        .map((row) => row.tagName)
        .filter((tag): tag is string => typeof tag === "string" && tag.length > 0)
    )
  );

  return {
    ...question,
    tags,
  };
}

export async function findAllQuestions(): Promise<ForumQuestionWithTags[]> {
  const rows = await db
    .select({
      question: forumQuestion,
      tagName: forumTag.name,
    })
    .from(forumQuestion)
    .leftJoin(forumQuestionTag, eq(forumQuestionTag.questionId, forumQuestion.id))
    .leftJoin(forumTag, eq(forumTag.id, forumQuestionTag.tagId))
    .orderBy(desc(forumQuestion.createdAt));

  const questionById = new Map<string, ForumQuestionWithTags>();

  for (const row of rows) {
    const existing = questionById.get(row.question.id);
    const tagName =
      typeof row.tagName === "string" && row.tagName.length > 0 ? row.tagName : null;

    if (!existing) {
      questionById.set(row.question.id, {
        ...row.question,
        tags: tagName ? [tagName] : [],
      });
      continue;
    }

    if (tagName && !existing.tags.includes(tagName)) {
      existing.tags.push(tagName);
    }
  }

  return Array.from(questionById.values());
}

export async function findQuestionsPage(
  limit: number,
  cursor?: string
): Promise<QuestionsPageResult> {
  const rows = await db
    .select()
    .from(forumQuestion)
    .where(cursor ? lt(forumQuestion.createdAt, cursor) : undefined)
    .orderBy(desc(forumQuestion.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;

  if (pageRows.length === 0) {
    return {
      questions: [],
      nextCursor: null,
      hasMore: false,
    };
  }

  const questionIds = pageRows.map((question) => question.id);
  const tagRows = await db
    .select({
      questionId: forumQuestionTag.questionId,
      tagName: forumTag.name,
    })
    .from(forumQuestionTag)
    .innerJoin(forumTag, eq(forumTag.id, forumQuestionTag.tagId))
    .where(inArray(forumQuestionTag.questionId, questionIds));

  const tagsByQuestionId = new Map<string, string[]>();
  for (const row of tagRows) {
    const current = tagsByQuestionId.get(row.questionId);
    if (!current) {
      tagsByQuestionId.set(row.questionId, [row.tagName]);
      continue;
    }
    if (!current.includes(row.tagName)) {
      current.push(row.tagName);
    }
  }

  const questions = pageRows.map((question) => ({
    ...question,
    tags: tagsByQuestionId.get(question.id) ?? [],
  }));

  return {
    questions,
    nextCursor: hasMore ? pageRows[pageRows.length - 1].createdAt : null,
    hasMore,
  };
}

export async function createQuestion(
  data: CreateQuestionInput,
  authorId: string
): Promise<ForumQuestionWithTags> {
  return db.transaction(async (tx) => {
    const insertData: ForumQuestionInsert = {
      categoryId: data.categoryId,
      authorId,
      title: data.title,
      body: data.body,
      status: data.status ?? "PUBLISHED",
    };

    const [newQuestion] = await tx
      .insert(forumQuestion)
      .values(insertData)
      .returning();

    const normalizedTags = Array.from(
      new Map((data.tags ?? []).map((tag) => [normalizeTagName(tag), tag.trim()])).entries()
    ).map(([normalizedName, name]) => ({ normalizedName, name }));

    if (normalizedTags.length === 0) {
      return { ...newQuestion, tags: [] };
    }

    const tagInsertValues: ForumTagInsert[] = normalizedTags.map((tag) => ({
      name: tag.name,
      normalizedName: tag.normalizedName,
    }));

    await tx
      .insert(forumTag)
      .values(tagInsertValues)
      .onConflictDoNothing({ target: forumTag.normalizedName });

    const tagRows = await tx
      .select({
        id: forumTag.id,
        normalizedName: forumTag.normalizedName,
        name: forumTag.name,
      })
      .from(forumTag)
      .where(
        inArray(
          forumTag.normalizedName,
          normalizedTags.map((tag) => tag.normalizedName)
        )
      );

    if (tagRows.length === 0) {
      return { ...newQuestion, tags: [] };
    }

    const questionTagValues: ForumQuestionTagInsert[] = tagRows.map((tag) => ({
      questionId: newQuestion.id,
      tagId: tag.id,
    }));

    await tx
      .insert(forumQuestionTag)
      .values(questionTagValues)
      .onConflictDoNothing({
        target: [forumQuestionTag.questionId, forumQuestionTag.tagId],
      });

    const tagNameByNormalizedName = new Map(
      tagRows.map((tag) => [tag.normalizedName, tag.name])
    );
    const tags = normalizedTags.map(
      (tag) => tagNameByNormalizedName.get(tag.normalizedName) ?? tag.name
    );

    return { ...newQuestion, tags };
  });
}
