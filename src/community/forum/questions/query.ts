import { and, desc, eq, inArray, lt, or } from "drizzle-orm";
import { db } from "../../../db/index";
import { forumQuestion, forumQuestionTag, forumTag } from "../../../db/schema";
import {
  encodeQuestionsPageCursor,
  type CreateQuestionInput,
  type GetQuestionsQuery,
  type QuestionsPageCursor,
} from "./schema";

type ForumQuestionRow = typeof forumQuestion.$inferSelect;
type ForumQuestionInsert = typeof forumQuestion.$inferInsert;
type ForumQuestionTagInsert = typeof forumQuestionTag.$inferInsert;
type ForumTagInsert = typeof forumTag.$inferInsert;
type ForumQuestionWithTags = ForumQuestionRow & { tags: string[] };
type QuestionsPagination = {
  limit: number;
  hasMore: boolean;
  nextCursor: string | null;
};

type QuestionsListResult = {
  questions: ForumQuestionWithTags[];
  pagination: QuestionsPagination;
};

function normalizeTagName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function buildQuestionsWhereClause(categoryId?: string, cursor?: QuestionsPageCursor) {
  const filters = [];

  if (categoryId) {
    filters.push(eq(forumQuestion.categoryId, categoryId));
  }

  if (cursor) {
    filters.push(
      or(
        lt(forumQuestion.createdAt, cursor.createdAt),
        and(eq(forumQuestion.createdAt, cursor.createdAt), lt(forumQuestion.id, cursor.id))
      )
    );
  }

  return filters.length > 0 ? and(...filters) : undefined;
}

async function attachTagsToQuestions(
  questions: ForumQuestionRow[]
): Promise<ForumQuestionWithTags[]> {
  if (questions.length === 0) {
    return [];
  }

  const questionIds = questions.map((question) => question.id);
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

  return questions.map((question) => ({
    ...question,
    tags: tagsByQuestionId.get(question.id) ?? [],
  }));
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

export async function findQuestions({
  categoryId,
  limit,
  cursor,
}: GetQuestionsQuery): Promise<QuestionsListResult> {
  const whereClause = buildQuestionsWhereClause(categoryId, cursor);
  const baseQuery = db
    .select()
    .from(forumQuestion)
    .where(whereClause)
    .orderBy(desc(forumQuestion.createdAt), desc(forumQuestion.id));

  const rows = await baseQuery.limit(limit + 1);
  const hasMore = rows.length > limit;
  const questionRows = hasMore ? rows.slice(0, limit) : rows;
  const questions = await attachTagsToQuestions(questionRows);

  return {
    questions,
    pagination: {
      limit,
      hasMore,
      nextCursor:
        hasMore && questionRows.length > 0
          ? encodeQuestionsPageCursor({
              createdAt: questionRows[questionRows.length - 1].createdAt,
              id: questionRows[questionRows.length - 1].id,
            })
          : null,
    },
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
