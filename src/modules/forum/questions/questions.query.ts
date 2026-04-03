import { and, desc, eq, gte, inArray, lt, or, sql, type SQL } from "drizzle-orm";
import { db } from "../../../db/index";
import {
  forumAnswer,
  forumCategory,
  forumQuestion,
  forumQuestionTag,
  forumQuestionVote,
  forumTag,
  user,
  userProfile,
} from "../../../db/schema";
import { FORUM_ADVISORY_LOCK_NAMESPACE } from "../lib/constants";
import {
  encodeQuestionsPageCursor,
  type CreateQuestionInput,
  type EditQuestionInput,
  type GetTrendingTagsQuery,
  type GetQuestionsQuery,
  type QuestionSortBy,
  type QuestionVoteType,
  type QuestionsPageCursor,
  type VoteIntent,
} from "./questions.schema";

type ForumQuestionRow = typeof forumQuestion.$inferSelect;
type ForumQuestionInsert = typeof forumQuestion.$inferInsert;
type ForumQuestionTagInsert = typeof forumQuestionTag.$inferInsert;
type ForumQuestionVoteInsert = typeof forumQuestionVote.$inferInsert;
type ForumTagInsert = typeof forumTag.$inferInsert;
type QuestionTag = {
  id: string;
  name: string;
};
type BaseQuestionHydrationRow = {
  question: ForumQuestionRow;
  categoryName: string;
  authorDisplayName: string | null;
  authorFullName: string;
  authorAvatarKey: string | null;
  viewerVoteType: string | null;
};
type QuestionListRow = BaseQuestionHydrationRow & {
  myActivityAt: string;
};
type QuestionDetailRow = BaseQuestionHydrationRow;
type ForumQuestionWithTags = Omit<
  ForumQuestionRow,
  "categoryId" | "authorId" | "deletedAt"
> & {
  score: number;
  viewerVote: QuestionVoteType | null;
  category: {
    id: string;
    name: string;
  };
  author: {
    id: string;
    name: string;
    avatarKey: string | null;
  };
  tags: QuestionTag[];
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
type TrendingTagResult = {
  id: string;
  name: string;
  count: number;
};

const VISIBLE_QUESTION_STATUSES = ["PUBLISHED", "CLOSED"] as const;
const MIN_TRENDING_TAG_COUNT = 10;
const MAX_TRENDING_TAG_AMOUNT = 10;
const QUESTION_SCORE_SQL =
  sql<number>`${forumQuestion.upvoteCount} - ${forumQuestion.downvoteCount}`;

function buildMyActivityTimestampSql(viewerId: string) {
  return sql<string>`greatest(
    ${forumQuestion.createdAt},
    coalesce(
      (
        select max(${forumAnswer.updatedAt})
        from ${forumAnswer}
        where ${forumAnswer.questionId} = ${forumQuestion.id}
          and ${forumAnswer.authorId} = ${viewerId}
          and ${forumAnswer.status} = 'PUBLISHED'
      ),
      ${forumQuestion.createdAt}
    ),
    coalesce(
      (
        select max(${forumQuestionVote.updatedAt})
        from ${forumQuestionVote}
        where ${forumQuestionVote.questionId} = ${forumQuestion.id}
          and ${forumQuestionVote.voterId} = ${viewerId}
      ),
      ${forumQuestion.createdAt}
    )
  )`;
}

function normalizeTagName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function toInteger(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function resolveAuthorName(row: BaseQuestionHydrationRow): string {
  const displayName = row.authorDisplayName?.trim();
  const fullName = row.authorFullName.trim();
  return displayName && displayName.length > 0 ? displayName : fullName;
}

function buildNextQuestionsCursor(
  sortBy: QuestionSortBy,
  row: QuestionListRow,
): string {
  if (sortBy === "topRated") {
    return encodeQuestionsPageCursor({
      sortBy: "topRated",
      score: row.question.upvoteCount - row.question.downvoteCount,
      createdAt: row.question.createdAt,
      id: row.question.id,
    });
  }

  if (sortBy === "myActivity") {
    return encodeQuestionsPageCursor({
      sortBy: "myActivity",
      activityAt: row.myActivityAt,
      id: row.question.id,
    });
  }

  return encodeQuestionsPageCursor({
    sortBy: sortBy === "unanswered" ? "unanswered" : "recent",
    createdAt: row.question.createdAt,
    id: row.question.id,
  });
}

function hydrateQuestion(
  row: BaseQuestionHydrationRow,
  tags: QuestionTag[],
): ForumQuestionWithTags {
  const {
    categoryId,
    authorId,
    deletedAt: _deletedAt,
    ...question
  } = row.question;

  return {
    ...question,
    score: question.upvoteCount - question.downvoteCount,
    viewerVote: row.viewerVoteType
      ? (row.viewerVoteType as QuestionVoteType)
      : null,
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

function buildQuestionsBaseQuery(viewerId: string) {
  const myActivityAt = buildMyActivityTimestampSql(viewerId);

  return db
    .select({
      question: forumQuestion,
      categoryName: forumCategory.name,
      authorDisplayName: userProfile.displayName,
      authorFullName: user.name,
      authorAvatarKey: userProfile.avatarKey,
      viewerVoteType: forumQuestionVote.voteType,
      myActivityAt: myActivityAt.mapWith(String),
    })
    .from(forumQuestion)
    .innerJoin(forumCategory, eq(forumCategory.id, forumQuestion.categoryId))
    .innerJoin(user, eq(user.id, forumQuestion.authorId))
    .leftJoin(userProfile, eq(userProfile.userId, user.id))
    .leftJoin(
      forumQuestionVote,
      and(
        eq(forumQuestionVote.questionId, forumQuestion.id),
        eq(forumQuestionVote.voterId, viewerId),
      ),
    )
}

function buildMyActivityFilter(viewerId: string): SQL<unknown> | undefined {
  return or(
    eq(forumQuestion.authorId, viewerId),
    sql`exists (
      select 1
      from ${forumAnswer}
      where ${forumAnswer.questionId} = ${forumQuestion.id}
        and ${forumAnswer.authorId} = ${viewerId}
        and ${forumAnswer.status} = 'PUBLISHED'
    )`,
    sql`exists (
      select 1
      from ${forumQuestionVote}
      where ${forumQuestionVote.questionId} = ${forumQuestion.id}
        and ${forumQuestionVote.voterId} = ${viewerId}
    )`,
  );
}

function buildQuestionsCursorFilter(
  viewerId: string,
  sortBy: QuestionSortBy,
  cursor?: QuestionsPageCursor,
): SQL<unknown> | undefined {
  if (!cursor) {
    return undefined;
  }

  if (sortBy === "topRated" && cursor.sortBy === "topRated") {
    return or(
      sql`${QUESTION_SCORE_SQL} < ${cursor.score}`,
      and(
        sql`${QUESTION_SCORE_SQL} = ${cursor.score}`,
        lt(forumQuestion.createdAt, cursor.createdAt),
      ),
      and(
        sql`${QUESTION_SCORE_SQL} = ${cursor.score}`,
        eq(forumQuestion.createdAt, cursor.createdAt),
        lt(forumQuestion.id, cursor.id),
      ),
    );
  }

  if (sortBy === "myActivity" && cursor.sortBy === "myActivity") {
    const myActivityTimestampSql = buildMyActivityTimestampSql(viewerId);
    return or(
      sql`${myActivityTimestampSql} < ${cursor.activityAt}`,
      and(
        sql`${myActivityTimestampSql} = ${cursor.activityAt}`,
        lt(forumQuestion.id, cursor.id),
      ),
    );
  }

  if (
    (sortBy === "recent" && cursor.sortBy === "recent") ||
    (sortBy === "unanswered" && cursor.sortBy === "unanswered")
  ) {
    return or(
      lt(forumQuestion.createdAt, cursor.createdAt),
      and(
        eq(forumQuestion.createdAt, cursor.createdAt),
        lt(forumQuestion.id, cursor.id),
      ),
    );
  }

  return undefined;
}

function buildQuestionsWhereClause(
  viewerId: string,
  categoryId?: string,
  tagId?: string,
  sortBy: QuestionSortBy = "recent",
  cursor?: QuestionsPageCursor,
) {
  const filters = [inArray(forumQuestion.status, VISIBLE_QUESTION_STATUSES)];

  if (categoryId) {
    filters.push(eq(forumQuestion.categoryId, categoryId));
  }

  if (tagId) {
    filters.push(
      sql`exists (
        select 1
        from ${forumQuestionTag}
        where ${forumQuestionTag.questionId} = ${forumQuestion.id}
          and ${forumQuestionTag.tagId} = ${tagId}
      )`,
    );
  }

  if (sortBy === "unanswered") {
    filters.push(eq(forumQuestion.answerCount, 0));
  }

  if (sortBy === "myActivity") {
    const myActivityFilter = buildMyActivityFilter(viewerId);
    if (myActivityFilter) {
      filters.push(myActivityFilter);
    }
  }

  const cursorFilter = buildQuestionsCursorFilter(viewerId, sortBy, cursor);
  if (cursorFilter) {
    filters.push(cursorFilter);
  }

  return and(...filters);
}

function buildQuestionsOrderBy(sortBy: QuestionSortBy, viewerId: string) {
  if (sortBy === "topRated") {
    return [
      desc(QUESTION_SCORE_SQL),
      desc(forumQuestion.createdAt),
      desc(forumQuestion.id),
    ] as const;
  }

  if (sortBy === "myActivity") {
    return [
      desc(buildMyActivityTimestampSql(viewerId)),
      desc(forumQuestion.id),
    ] as const;
  }

  return [desc(forumQuestion.createdAt), desc(forumQuestion.id)] as const;
}

async function attachTagsToQuestions(
  questions: BaseQuestionHydrationRow[],
): Promise<ForumQuestionWithTags[]> {
  if (questions.length === 0) {
    return [];
  }

  const questionIds = questions.map((row) => row.question.id);
  const tagRows = await db
    .select({
      questionId: forumQuestionTag.questionId,
      tagId: forumTag.id,
      tagName: forumTag.name,
    })
    .from(forumQuestionTag)
    .innerJoin(forumTag, eq(forumTag.id, forumQuestionTag.tagId))
    .where(inArray(forumQuestionTag.questionId, questionIds));

  const tagsByQuestionId = new Map<string, QuestionTag[]>();
  for (const row of tagRows) {
    const tagsForQuestion = tagsByQuestionId.get(row.questionId);
    if (!tagsForQuestion) {
      tagsByQuestionId.set(row.questionId, [
        { id: row.tagId, name: row.tagName },
      ]);
      continue;
    }

    if (!tagsForQuestion.some((tag) => tag.id === row.tagId)) {
      tagsForQuestion.push({ id: row.tagId, name: row.tagName });
    }
  }

  return questions.map((row) =>
    hydrateQuestion(row, tagsByQuestionId.get(row.question.id) ?? []),
  );
}

export async function findQuestionRowById(
  id: string,
): Promise<ForumQuestionRow | null> {
  const rows = await db
    .select()
    .from(forumQuestion)
    .where(eq(forumQuestion.id, id));
  return rows[0] ?? null;
}

export async function findQuestionById(
  id: string,
  viewerId: string,
): Promise<ForumQuestionWithTags | null> {
  const rows = await db
    .select({
      question: forumQuestion,
      categoryName: forumCategory.name,
      authorDisplayName: userProfile.displayName,
      authorFullName: user.name,
      authorAvatarKey: userProfile.avatarKey,
      viewerVoteType: forumQuestionVote.voteType,
      tagId: forumTag.id,
      tagName: forumTag.name,
    })
    .from(forumQuestion)
    .innerJoin(forumCategory, eq(forumCategory.id, forumQuestion.categoryId))
    .innerJoin(user, eq(user.id, forumQuestion.authorId))
    .leftJoin(userProfile, eq(userProfile.userId, user.id))
    .leftJoin(
      forumQuestionVote,
      and(
        eq(forumQuestionVote.questionId, forumQuestion.id),
        eq(forumQuestionVote.voterId, viewerId),
      ),
    )
    .leftJoin(
      forumQuestionTag,
      eq(forumQuestionTag.questionId, forumQuestion.id),
    )
    .leftJoin(forumTag, eq(forumTag.id, forumQuestionTag.tagId))
    .where(
      and(
        eq(forumQuestion.id, id),
        inArray(forumQuestion.status, VISIBLE_QUESTION_STATUSES),
      ),
    );

  if (rows.length === 0) {
    return null;
  }

  const questionRow: QuestionDetailRow = {
    question: rows[0].question,
    categoryName: rows[0].categoryName,
    authorDisplayName: rows[0].authorDisplayName,
    authorFullName: rows[0].authorFullName,
    authorAvatarKey: rows[0].authorAvatarKey,
    viewerVoteType: rows[0].viewerVoteType,
  };
  const tags = Array.from(
    new Map(
      rows
        .filter(
          (row): row is typeof row & { tagId: string; tagName: string } =>
            typeof row.tagId === "string" && typeof row.tagName === "string",
        )
        .map((row) => [row.tagId, { id: row.tagId, name: row.tagName }]),
    ).values(),
  );

  return hydrateQuestion(questionRow, tags);
}

export async function findQuestions(
  { categoryId, tagId, limit, sortBy, cursor }: GetQuestionsQuery,
  viewerId: string,
): Promise<QuestionsListResult> {
  const whereClause = buildQuestionsWhereClause(
    viewerId,
    categoryId,
    tagId,
    sortBy,
    cursor,
  );
  const baseQuery = buildQuestionsBaseQuery(viewerId)
    .where(whereClause)
    .orderBy(...buildQuestionsOrderBy(sortBy, viewerId));

  const rows = await baseQuery.limit(limit + 1);
  const hasMore = rows.length > limit;
  const questionRows: QuestionListRow[] = hasMore ? rows.slice(0, limit) : rows;
  const questions = await attachTagsToQuestions(questionRows);
  const lastQuestionRow =
    questionRows.length > 0 ? questionRows[questionRows.length - 1] : null;
  const nextCursor =
    hasMore && lastQuestionRow
      ? buildNextQuestionsCursor(sortBy, lastQuestionRow)
      : null;

  return {
    questions,
    pagination: {
      limit,
      hasMore,
      nextCursor,
    },
  };
}

export async function getTrendingTags({
  categoryId,
}: GetTrendingTagsQuery): Promise<TrendingTagResult[]> {
  const tagCount = sql<number>`count(${forumQuestionTag.tagId})`;
  const filters = [inArray(forumQuestion.status, VISIBLE_QUESTION_STATUSES)];

  if (categoryId) {
    filters.push(eq(forumQuestion.categoryId, categoryId));
  }

  return db
    .select({
      id: forumTag.id,
      name: forumTag.name,
      count: tagCount.mapWith(Number),
    })
    .from(forumTag)
    .innerJoin(forumQuestionTag, eq(forumTag.id, forumQuestionTag.tagId))
    .innerJoin(forumQuestion, eq(forumQuestion.id, forumQuestionTag.questionId))
    .where(and(...filters))
    .groupBy(forumTag.id, forumTag.name)
    .having(gte(tagCount, MIN_TRENDING_TAG_COUNT))
    .orderBy(desc(tagCount), forumTag.name)
    .limit(MAX_TRENDING_TAG_AMOUNT);
}

export async function createQuestion(
  data: CreateQuestionInput,
  authorId: string,
): Promise<ForumQuestionWithTags> {
  const newQuestionId = await db.transaction(async (tx) => {
    const insertData: ForumQuestionInsert = {
      categoryId: data.categoryId,
      authorId,
      title: data.title,
      body: data.body,
      status: data.status ?? "PUBLISHED",
      upvoteCount: 0,
      downvoteCount: 0,
    };

    const [newQuestion] = await tx
      .insert(forumQuestion)
      .values(insertData)
      .returning();

    const normalizedTags = Array.from(
      new Map(
        (data.tags ?? []).map((tag) => [normalizeTagName(tag), tag.trim()]),
      ).entries(),
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
          normalizedTags.map((tag) => tag.normalizedName),
        ),
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

  const createdQuestion = await findQuestionById(newQuestionId, authorId);
  if (!createdQuestion) {
    throw new Error("Created question could not be loaded");
  }

  return createdQuestion;
}

export async function updateQuestion(
  questionId: string,
  authorId: string,
  data: EditQuestionInput,
): Promise<ForumQuestionWithTags | null> {
  const updateData: Partial<ForumQuestionInsert> = {};

  if (data.categoryId !== undefined) {
    updateData.categoryId = data.categoryId;
  }
  if (data.title !== undefined) {
    updateData.title = data.title;
  }
  if (data.body !== undefined) {
    updateData.body = data.body;
  }
  if (data.status !== undefined) {
    updateData.status = data.status;
  }

  const updateResult = await db.transaction(async (tx) => {
    // Update the question
    const [updatedQuestion] = await tx
      .update(forumQuestion)
      .set({ ...updateData, updatedAt: sql`now()` })
      .where(
        and(
          eq(forumQuestion.id, questionId),
          eq(forumQuestion.authorId, authorId),
          inArray(forumQuestion.status, VISIBLE_QUESTION_STATUSES),
        ),
      )
      .returning();

    if (!updatedQuestion) {
      return null;
    }

    // If tags are provided, update tags
    if (data.tags !== undefined) {
      const normalizedTags = Array.from(
        new Map(
          data.tags.map((tag) => [normalizeTagName(tag), tag.trim()]),
        ).entries(),
      ).map(([normalizedName, name]) => ({ normalizedName, name }));

      // Delete existing tags
      await tx
        .delete(forumQuestionTag)
        .where(eq(forumQuestionTag.questionId, questionId));

      if (normalizedTags.length > 0) {
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
          })
          .from(forumTag)
          .where(
            inArray(
              forumTag.normalizedName,
              normalizedTags.map((tag) => tag.normalizedName),
            ),
          );

        if (tagRows.length > 0) {
          const questionTagValues: ForumQuestionTagInsert[] = tagRows.map(
            (tag) => ({
              questionId: questionId,
              tagId: tag.id,
            }),
          );

          await tx
            .insert(forumQuestionTag)
            .values(questionTagValues)
            .onConflictDoNothing({
              target: [forumQuestionTag.questionId, forumQuestionTag.tagId],
            });
        }
      }
    }

    return updatedQuestion;
  });

  if (!updateResult) {
    return null;
  }

  // Return the updated question
  return await findQuestionById(questionId, authorId);
}

export async function softDeleteQuestion(
  questionId: string,
  authorId: string,
): Promise<ForumQuestionRow | null> {
  const [deletedQuestion] = await db
    .update(forumQuestion)
    .set({
      status: "DELETED",
      deletedAt: sql`now()`,
      updatedAt: sql`now()`,
    })
    .where(
      and(
        eq(forumQuestion.id, questionId),
        eq(forumQuestion.authorId, authorId),
        inArray(forumQuestion.status, VISIBLE_QUESTION_STATUSES),
      ),
    )
    .returning();

  return deletedQuestion ?? null;
}

export async function setQuestionVote(
  questionId: string,
  voterId: string,
  voteIntent: VoteIntent,
): Promise<ForumQuestionWithTags | null> {
  const updatedQuestionId = await db.transaction(async (tx) => {
    // Serialize vote updates per question inside the forum advisory-lock namespace.
    await tx.execute(
      sql`select pg_advisory_xact_lock(${FORUM_ADVISORY_LOCK_NAMESPACE}, hashtext(${questionId}))`,
    );

    const [question] = await tx
      .select()
      .from(forumQuestion)
      .where(
        and(
          eq(forumQuestion.id, questionId),
          eq(forumQuestion.status, "PUBLISHED"),
        ),
      );

    if (!question) {
      return null;
    }

    if (voteIntent === "NONE") {
      await tx
        .delete(forumQuestionVote)
        .where(
          and(
            eq(forumQuestionVote.questionId, questionId),
            eq(forumQuestionVote.voterId, voterId),
          ),
        );
    } else {
      const voteInsertData: ForumQuestionVoteInsert = {
        questionId,
        voterId,
        voteType: voteIntent,
      };

      await tx
        .insert(forumQuestionVote)
        .values(voteInsertData)
        .onConflictDoUpdate({
          target: [forumQuestionVote.questionId, forumQuestionVote.voterId],
          set: {
            voteType: voteIntent,
            updatedAt: sql`now()`,
          },
        });
    }

    const [voteCountRow] = await tx
      .select({
        upvoteCount: sql`coalesce(sum(case when ${forumQuestionVote.voteType} = 'UPVOTE' then 1 else 0 end), 0)`,
        downvoteCount: sql`coalesce(sum(case when ${forumQuestionVote.voteType} = 'DOWNVOTE' then 1 else 0 end), 0)`,
      })
      .from(forumQuestionVote)
      .where(eq(forumQuestionVote.questionId, questionId));

    const normalizedUpvoteCount = toInteger(voteCountRow?.upvoteCount);
    const normalizedDownvoteCount = toInteger(voteCountRow?.downvoteCount);

    const [updatedQuestion] = await tx
      .update(forumQuestion)
      .set({
        upvoteCount: normalizedUpvoteCount,
        downvoteCount: normalizedDownvoteCount,
        updatedAt: sql`now()`,
      })
      .where(eq(forumQuestion.id, questionId))
      .returning({ id: forumQuestion.id });

    return updatedQuestion?.id ?? null;
  });

  if (!updatedQuestionId) {
    return null;
  }

  const votedQuestion = await findQuestionById(updatedQuestionId, voterId);
  if (!votedQuestion) {
    throw new Error("Voted question could not be loaded");
  }

  return votedQuestion;
}
