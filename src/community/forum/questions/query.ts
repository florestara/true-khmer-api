import { and, desc, eq, inArray, lt, or } from "drizzle-orm";
import { db } from "../../../db/index";
import {
  forumCategory,
  forumQuestion,
  forumQuestionTag,
  forumTag,
  user,
  userProfile,
} from "../../../db/schema";
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
type QuestionHydrationRow = {
  question: ForumQuestionRow;
  categoryName: string;
  authorDisplayName: string | null;
  authorFullName: string;
  authorAvatarKey: string | null;
};
type ForumQuestionWithTags = Omit<ForumQuestionRow, "categoryId" | "authorId"> & {
  category: {
    id: string;
    name: string;
  };
  author: {
    id: string;
    name: string;
    avatarKey: string | null;
  };
  tags: string[];
};
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

function resolveAuthorName(row: QuestionHydrationRow): string {
  const displayName = row.authorDisplayName?.trim();
  const fullName = row.authorFullName.trim();
  return displayName && displayName.length > 0 ? displayName : fullName;
}

function hydrateQuestion(row: QuestionHydrationRow, tags: string[]): ForumQuestionWithTags {
  const { categoryId, authorId, ...question } = row.question;

  return {
    ...question,
    category: {
      id: categoryId,
      name: row.categoryName,
    },
    author: {
      id: authorId,
      name: resolveAuthorName(row),
      avatarKey: row.authorAvatarKey,
    },
    tags,
  };
}

function buildQuestionsBaseQuery() {
  return db
    .select({
      question: forumQuestion,
      categoryName: forumCategory.name,
      authorDisplayName: userProfile.displayName,
      authorFullName: user.name,
      authorAvatarKey: userProfile.avatarKey,
    })
    .from(forumQuestion)
    .innerJoin(forumCategory, eq(forumCategory.id, forumQuestion.categoryId))
    .innerJoin(user, eq(user.id, forumQuestion.authorId))
    .leftJoin(userProfile, eq(userProfile.userId, user.id));
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
  questions: QuestionHydrationRow[]
): Promise<ForumQuestionWithTags[]> {
  if (questions.length === 0) {
    return [];
  }

  const questionIds = questions.map((row) => row.question.id);
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

  return questions.map((row) =>
    hydrateQuestion(row, tagsByQuestionId.get(row.question.id) ?? [])
  );
}

export async function findQuestionById(id: string): Promise<ForumQuestionWithTags | null> {
  const rows = await db
    .select({
      question: forumQuestion,
      categoryName: forumCategory.name,
      authorDisplayName: userProfile.displayName,
      authorFullName: user.name,
      authorAvatarKey: userProfile.avatarKey,
      tagName: forumTag.name,
    })
    .from(forumQuestion)
    .innerJoin(forumCategory, eq(forumCategory.id, forumQuestion.categoryId))
    .innerJoin(user, eq(user.id, forumQuestion.authorId))
    .leftJoin(userProfile, eq(userProfile.userId, user.id))
    .leftJoin(forumQuestionTag, eq(forumQuestionTag.questionId, forumQuestion.id))
    .leftJoin(forumTag, eq(forumTag.id, forumQuestionTag.tagId))
    .where(eq(forumQuestion.id, id));

  if (rows.length === 0) {
    return null;
  }

  const questionRow: QuestionHydrationRow = {
    question: rows[0].question,
    categoryName: rows[0].categoryName,
    authorDisplayName: rows[0].authorDisplayName,
    authorFullName: rows[0].authorFullName,
    authorAvatarKey: rows[0].authorAvatarKey,
  };
  const tags = Array.from(
    new Set(
      rows
        .map((row) => row.tagName)
        .filter((tag): tag is string => typeof tag === "string" && tag.length > 0)
    )
  );

  return hydrateQuestion(questionRow, tags);
}

export async function findQuestions({
  categoryId,
  limit,
  cursor,
}: GetQuestionsQuery): Promise<QuestionsListResult> {
  const whereClause = buildQuestionsWhereClause(categoryId, cursor);
  const baseQuery = buildQuestionsBaseQuery()
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
              createdAt: questionRows[questionRows.length - 1].question.createdAt,
              id: questionRows[questionRows.length - 1].question.id,
            })
          : null,
    },
  };
}

export async function createQuestion(
  data: CreateQuestionInput,
  authorId: string
): Promise<ForumQuestionWithTags> {
  const newQuestionId = await db.transaction(async (tx) => {
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
      return newQuestion.id;
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
      return newQuestion.id;
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

    return newQuestion.id;
  });

  const createdQuestion = await findQuestionById(newQuestionId);
  if (!createdQuestion) {
    throw new Error("Created question could not be loaded");
  }

  return createdQuestion;
}
