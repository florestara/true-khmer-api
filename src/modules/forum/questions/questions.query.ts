import {
  aliasedTable,
  and,
  asc,
  desc,
  eq,
  exists,
  gt,
  gte,
  ilike,
  inArray,
  lt,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { env } from "../../../config/env";
import { db } from "../../../db/index";
import {
  forumAnswer,
  forumCategory,
  forumQuestion,
  forumQuestionSave,
  forumQuestionTag,
  forumQuestionVote,
  forumTag,
  user,
  userProfile,
} from "../../../db/schema";
import {
  buildCursorPagination,
  normalizePaginationTotal,
  type CursorPagination,
} from "../../../utils/pagination.helper";
import { FORUM_ADVISORY_LOCK_NAMESPACE } from "../lib/constants";
import {
  encodeSavedQuestionsPageCursor,
  encodeQuestionsPageCursor,
  type CreateQuestionInput,
  type EditQuestionInput,
  type GetSavedQuestionsQuery,
  type GetTrendingTagsQuery,
  type GetQuestionsQuery,
  type QuestionSortBy,
  type QuestionVoteType,
  type SavedQuestionsPageCursor,
  type QuestionsPageCursor,
  type VoteIntent,
} from "./questions.schema";

type ForumQuestionRow = typeof forumQuestion.$inferSelect;
type ForumQuestionInsert = typeof forumQuestion.$inferInsert;
type ForumQuestionSaveInsert = typeof forumQuestionSave.$inferInsert;
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
  viewerSavedQuestionId: string | null;
  voteCount: number;
  trendingScore: number;
  trendingEngagementScore: number;
  trendingRankingTimestamp: string | null;
  trendingLastActivityAt: string | null;
};
type QuestionListRow = BaseQuestionHydrationRow;
type QuestionDetailRow = BaseQuestionHydrationRow;
type PublicQuestionHydrationRow = Omit<
  BaseQuestionHydrationRow,
  "viewerVoteType"
>;
type ForumQuestionWithTags = Omit<
  ForumQuestionRow,
  "categoryId" | "authorId" | "deletedAt"
> & {
  score: number;
  viewerVote: QuestionVoteType | null;
  viewerSave: boolean;
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
type QuestionsListResult = {
  questions: ForumQuestionWithTags[];
  pagination: CursorPagination;
};
type TrendingTagResult = {
  id: string;
  name: string;
  count: number;
};
type SavedQuestionListRow = BaseQuestionHydrationRow & {
  savedAt: string;
};
type NormalizedQuestionTag = {
  normalizedName: string;
  name: string;
};

const VISIBLE_QUESTION_STATUSES = ["PUBLISHED", "CLOSED"] as const;
const MIN_TRENDING_TAG_COUNT = env.FORUM_MIN_TRENDING_TAG_COUNT;
const MAX_TRENDING_TAG_AMOUNT = env.FORUM_MAX_TRENDING_TAG_AMOUNT;
const QUESTION_SCORE_SQL = sql<number>`${forumQuestion.upvoteCount} - ${forumQuestion.downvoteCount}`;
const QUESTION_VOTE_COUNT_SQL = sql<number>`${forumQuestion.upvoteCount} + ${forumQuestion.downvoteCount}`;
const TRENDING_WINDOW_HOURS = env.FORUM_TRENDING_WINDOW_HOURS;
const MIN_TRENDING_ENGAGEMENT_SCORE =
  env.FORUM_MIN_TRENDING_ENGAGEMENT_SCORE;
const TRENDING_WINDOW_SQL = sql`${TRENDING_WINDOW_HOURS} * interval '1 hour'`;
const TRENDING_UPVOTE_WEIGHT = 3;
const TRENDING_ANSWER_WEIGHT = 10;
const TRENDING_UNIQUE_PARTICIPANT_WEIGHT = 5;
const TRENDING_DECAY_OFFSET_HOURS = 2;
const TRENDING_DECAY_EXPONENT = 1.2;
const forumQuestionTagSearch = aliasedTable(
  forumQuestionTag,
  "forum_question_tag_search",
);
const forumQuestionSaveList = aliasedTable(
  forumQuestionSave,
  "forum_question_save_list",
);
const forumTagSearch = aliasedTable(forumTag, "forum_tag_search");
const forumAnswerSearch = aliasedTable(forumAnswer, "forum_answer_search");
const forumAnswerAuthorSearch = aliasedTable(user, "forum_answer_author_search");
const forumAnswerAuthorProfileSearch = aliasedTable(
  userProfile,
  "forum_answer_author_profile_search",
);

function normalizeTagName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

function normalizeQuestionTags(tags: string[]): NormalizedQuestionTag[] {
  return Array.from(
    new Map(tags.map((tag) => [normalizeTagName(tag), tag.trim()])),
    ([normalizedName, name]) => ({ normalizedName, name }),
  );
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

function buildQuestionTagSearchExists(searchPattern: string) {
  return exists(
    db
      .select({ id: forumQuestionTagSearch.id })
      .from(forumQuestionTagSearch)
      .innerJoin(
        forumTagSearch,
        eq(forumTagSearch.id, forumQuestionTagSearch.tagId),
      )
      .where(
        and(
          eq(forumQuestionTagSearch.questionId, forumQuestion.id),
          or(
            ilike(forumTagSearch.name, searchPattern),
            ilike(forumTagSearch.normalizedName, searchPattern),
          ),
        ),
      ),
  );
}

function buildQuestionAnswerSearchExists(searchPattern: string) {
  return exists(
    db
      .select({ id: forumAnswerSearch.id })
      .from(forumAnswerSearch)
      .innerJoin(
        forumAnswerAuthorSearch,
        eq(forumAnswerAuthorSearch.id, forumAnswerSearch.authorId),
      )
      .leftJoin(
        forumAnswerAuthorProfileSearch,
        eq(
          forumAnswerAuthorProfileSearch.userId,
          forumAnswerAuthorSearch.id,
        ),
      )
      .where(
        and(
          eq(forumAnswerSearch.questionId, forumQuestion.id),
          eq(forumAnswerSearch.status, "PUBLISHED"),
          or(
            ilike(forumAnswerSearch.body, searchPattern),
            ilike(forumAnswerAuthorSearch.name, searchPattern),
            ilike(forumAnswerAuthorSearch.firstName, searchPattern),
            ilike(forumAnswerAuthorSearch.lastName, searchPattern),
            ilike(forumAnswerAuthorSearch.occupation, searchPattern),
            ilike(forumAnswerAuthorProfileSearch.displayName, searchPattern),
            ilike(forumAnswerAuthorProfileSearch.bio, searchPattern),
          ),
        ),
      ),
  );
}

function buildTrendingRankingTimestampSql(cursor?: QuestionsPageCursor): SQL {
  if (cursor?.sortBy === "trending") {
    return sql`${cursor.rankingTimestamp}::timestamptz`;
  }

  return sql`statement_timestamp()`;
}

function buildTrendingRecentUpvotesSql(rankingTimestampSql: SQL) {
  return sql<number>`(
    select count(*)::int
    from ${forumQuestionVote}
    where ${forumQuestionVote.questionId} = ${forumQuestion.id}
      and ${forumQuestionVote.voteType} = 'UPVOTE'
      and ${forumQuestionVote.createdAt} >= ${rankingTimestampSql} - ${TRENDING_WINDOW_SQL}
  )`;
}

function buildTrendingRecentAnswersSql(rankingTimestampSql: SQL) {
  return sql<number>`(
    select count(*)::int
    from ${forumAnswer}
    where ${forumAnswer.questionId} = ${forumQuestion.id}
      and ${forumAnswer.status} = 'PUBLISHED'
      and ${forumAnswer.createdAt} >= ${rankingTimestampSql} - ${TRENDING_WINDOW_SQL}
  )`;
}

function buildTrendingRecentUniqueParticipantsSql(rankingTimestampSql: SQL) {
  return sql<number>`(
    select count(distinct participant_user_id)::int
    from (
      select ${forumAnswer.authorId} as participant_user_id
      from ${forumAnswer}
      where ${forumAnswer.questionId} = ${forumQuestion.id}
        and ${forumAnswer.status} = 'PUBLISHED'
        and ${forumAnswer.createdAt} >= ${rankingTimestampSql} - ${TRENDING_WINDOW_SQL}
      union all
      select ${forumQuestionVote.voterId} as participant_user_id
      from ${forumQuestionVote}
      where ${forumQuestionVote.questionId} = ${forumQuestion.id}
        and ${forumQuestionVote.voteType} = 'UPVOTE'
        and ${forumQuestionVote.createdAt} >= ${rankingTimestampSql} - ${TRENDING_WINDOW_SQL}
    ) trending_participants
  )`;
}

function buildTrendingRecentEngagementScoreSql(rankingTimestampSql: SQL) {
  const recentUpvotesSql = buildTrendingRecentUpvotesSql(rankingTimestampSql);
  const recentAnswersSql = buildTrendingRecentAnswersSql(rankingTimestampSql);
  const uniqueParticipantsSql =
    buildTrendingRecentUniqueParticipantsSql(rankingTimestampSql);

  return sql<number>`(
    (${recentUpvotesSql} * ${TRENDING_UPVOTE_WEIGHT}) +
    (${recentAnswersSql} * ${TRENDING_ANSWER_WEIGHT}) +
    (${uniqueParticipantsSql} * ${TRENDING_UNIQUE_PARTICIPANT_WEIGHT})
  )`;
}

function buildTrendingLastActivitySql(rankingTimestampSql: SQL) {
  return sql<string | null>`greatest(
    coalesce(
      (
        select max(${forumAnswer.createdAt})
        from ${forumAnswer}
        where ${forumAnswer.questionId} = ${forumQuestion.id}
          and ${forumAnswer.status} = 'PUBLISHED'
          and ${forumAnswer.createdAt} >= ${rankingTimestampSql} - ${TRENDING_WINDOW_SQL}
      ),
      '-infinity'::timestamptz
    ),
    coalesce(
      (
        select max(${forumQuestionVote.createdAt})
        from ${forumQuestionVote}
        where ${forumQuestionVote.questionId} = ${forumQuestion.id}
          and ${forumQuestionVote.voteType} = 'UPVOTE'
          and ${forumQuestionVote.createdAt} >= ${rankingTimestampSql} - ${TRENDING_WINDOW_SQL}
      ),
      '-infinity'::timestamptz
    )
  )::text`;
}

function buildTrendingScoreSql(rankingTimestampSql: SQL) {
  const engagementScoreSql =
    buildTrendingRecentEngagementScoreSql(rankingTimestampSql);
  const lastActivitySql = buildTrendingLastActivitySql(rankingTimestampSql);

  return sql<number>`case
    when ${engagementScoreSql} <= 0
      or ${lastActivitySql} = '-infinity'
    then 0
    else (
      ${engagementScoreSql}::double precision /
      power(
        (
          extract(epoch from (${rankingTimestampSql} - (${lastActivitySql})::timestamptz)) /
          3600.0
        ) + ${TRENDING_DECAY_OFFSET_HOURS},
        ${TRENDING_DECAY_EXPONENT}
      )
    )
  end`;
}

function buildNextQuestionsCursor(
  sortBy: QuestionSortBy,
  row: QuestionListRow,
  isTrending = false,
): string {
  if (isTrending) {
    if (
      !row.trendingRankingTimestamp ||
      !row.trendingLastActivityAt ||
      row.trendingLastActivityAt === "-infinity"
    ) {
      throw new Error("Cannot build trending cursor without last activity");
    }

    return encodeQuestionsPageCursor({
      sortBy: "trending",
      trendingScore: row.trendingScore,
      engagementScore: row.trendingEngagementScore,
      rankingTimestamp: row.trendingRankingTimestamp,
      lastActivityAt: row.trendingLastActivityAt,
      createdAt: row.question.createdAt,
      id: row.question.id,
    });
  }

  if (sortBy === "mostVoted") {
    return encodeQuestionsPageCursor({
      sortBy: "mostVoted",
      score: row.question.upvoteCount - row.question.downvoteCount,
      createdAt: row.question.createdAt,
      id: row.question.id,
    });
  }

  if (sortBy === "mostRelevant") {
    return encodeQuestionsPageCursor({
      sortBy: "mostRelevant",
      score: row.question.upvoteCount - row.question.downvoteCount,
      answerCount: row.question.answerCount,
      createdAt: row.question.createdAt,
      id: row.question.id,
    });
  }

  if (sortBy === "mostAnswered") {
    return encodeQuestionsPageCursor({
      sortBy: "mostAnswered",
      answerCount: row.question.answerCount,
      createdAt: row.question.createdAt,
      id: row.question.id,
    });
  }

  return encodeQuestionsPageCursor({
    sortBy: sortBy === "oldest" ? "oldest" : "newest",
    createdAt: row.question.createdAt,
    id: row.question.id,
  });
}

function buildNextSavedQuestionsCursor(row: SavedQuestionListRow): string {
  return encodeSavedQuestionsPageCursor({
    savedAt: row.savedAt,
    questionId: row.question.id,
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
    viewerSave: row.viewerSavedQuestionId !== null,
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

function hydratePublicQuestion(
  row: PublicQuestionHydrationRow,
  tags: QuestionTag[],
): ForumQuestionWithTags {
  return hydrateQuestion(
    {
      ...row,
      viewerVoteType: null,
      viewerSavedQuestionId: null,
    },
    tags,
  );
}

function buildQuestionsBaseQuery(
  viewerId: string,
  trendingRankingTimestampSql: SQL = sql`statement_timestamp()`,
) {
  const trendingScore = buildTrendingScoreSql(trendingRankingTimestampSql);
  const trendingEngagementScore =
    buildTrendingRecentEngagementScoreSql(trendingRankingTimestampSql);
  const trendingLastActivityAt =
    buildTrendingLastActivitySql(trendingRankingTimestampSql);
  return db
    .select({
      question: forumQuestion,
      categoryName: forumCategory.name,
      authorDisplayName: userProfile.displayName,
      authorFullName: user.name,
      authorAvatarKey: userProfile.avatarKey,
      viewerVoteType: forumQuestionVote.voteType,
      viewerSavedQuestionId: forumQuestionSave.questionId,
      voteCount: QUESTION_VOTE_COUNT_SQL.mapWith(toInteger),
      trendingScore: trendingScore.mapWith(Number),
      trendingEngagementScore: trendingEngagementScore.mapWith(toInteger),
      trendingRankingTimestamp: sql<string>`${trendingRankingTimestampSql}::text`.mapWith(String),
      trendingLastActivityAt: trendingLastActivityAt.mapWith(String),
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
      forumQuestionSave,
      and(
        eq(forumQuestionSave.questionId, forumQuestion.id),
        eq(forumQuestionSave.saverId, viewerId),
      ),
    );
}

function buildSavedQuestionsBaseQuery(viewerId: string) {
  return db
    .select({
      question: forumQuestion,
      categoryName: forumCategory.name,
      authorDisplayName: userProfile.displayName,
      authorFullName: user.name,
      authorAvatarKey: userProfile.avatarKey,
      viewerVoteType: forumQuestionVote.voteType,
      viewerSavedQuestionId: forumQuestionSaveList.questionId,
      voteCount: QUESTION_VOTE_COUNT_SQL.mapWith(toInteger),
      trendingScore: sql<number>`0`.mapWith(Number),
      trendingEngagementScore: sql<number>`0`.mapWith(toInteger),
      trendingRankingTimestamp: sql<string | null>`null`,
      trendingLastActivityAt: sql<string | null>`null`,
      savedAt: forumQuestionSaveList.createdAt,
    })
    .from(forumQuestionSaveList)
    .innerJoin(forumQuestion, eq(forumQuestion.id, forumQuestionSaveList.questionId))
    .innerJoin(forumCategory, eq(forumCategory.id, forumQuestion.categoryId))
    .innerJoin(user, eq(user.id, forumQuestion.authorId))
    .leftJoin(userProfile, eq(userProfile.userId, user.id))
    .leftJoin(
      forumQuestionVote,
      and(
        eq(forumQuestionVote.questionId, forumQuestion.id),
        eq(forumQuestionVote.voterId, viewerId),
      ),
    );
}

function buildSavedQuestionsCursorFilter(
  cursor?: SavedQuestionsPageCursor,
): SQL<unknown> | undefined {
  if (!cursor) {
    return undefined;
  }

  return or(
    lt(forumQuestionSaveList.createdAt, cursor.savedAt),
    and(
      eq(forumQuestionSaveList.createdAt, cursor.savedAt),
      lt(forumQuestion.id, cursor.questionId),
    ),
  );
}

function buildQuestionsCursorFilter(
  sortBy: QuestionSortBy,
  isTrending: boolean,
  trendingRankingTimestampSql: SQL,
  cursor?: QuestionsPageCursor,
): SQL<unknown> | undefined {
  if (!cursor) {
    return undefined;
  }

  if (isTrending && cursor.sortBy === "trending") {
    const trendingScoreSql = buildTrendingScoreSql(trendingRankingTimestampSql);
    const engagementScoreSql =
      buildTrendingRecentEngagementScoreSql(trendingRankingTimestampSql);
    const lastActivitySql =
      buildTrendingLastActivitySql(trendingRankingTimestampSql);

    return or(
      sql`${trendingScoreSql} < ${cursor.trendingScore}`,
      and(
        sql`${trendingScoreSql} = ${cursor.trendingScore}`,
        sql`${engagementScoreSql} < ${cursor.engagementScore}`,
      ),
      and(
        sql`${trendingScoreSql} = ${cursor.trendingScore}`,
        sql`${engagementScoreSql} = ${cursor.engagementScore}`,
        sql`${lastActivitySql}::timestamptz < ${cursor.lastActivityAt}::timestamptz`,
      ),
      and(
        sql`${trendingScoreSql} = ${cursor.trendingScore}`,
        sql`${engagementScoreSql} = ${cursor.engagementScore}`,
        sql`${lastActivitySql}::timestamptz = ${cursor.lastActivityAt}::timestamptz`,
        lt(forumQuestion.createdAt, cursor.createdAt),
      ),
      and(
        sql`${trendingScoreSql} = ${cursor.trendingScore}`,
        sql`${engagementScoreSql} = ${cursor.engagementScore}`,
        sql`${lastActivitySql}::timestamptz = ${cursor.lastActivityAt}::timestamptz`,
        eq(forumQuestion.createdAt, cursor.createdAt),
        lt(forumQuestion.id, cursor.id),
      ),
    );
  }

  const scoreCursorFilter = (
    score: number,
    createdAt: string,
    id: string,
  ) =>
    or(
      lt(QUESTION_SCORE_SQL, score),
      and(
        eq(QUESTION_SCORE_SQL, score),
        lt(forumQuestion.createdAt, createdAt),
      ),
      and(
        eq(QUESTION_SCORE_SQL, score),
        eq(forumQuestion.createdAt, createdAt),
        lt(forumQuestion.id, id),
      ),
    );

  if (sortBy === "mostVoted" && cursor.sortBy === "mostVoted") {
    return scoreCursorFilter(cursor.score, cursor.createdAt, cursor.id);
  }

  if (sortBy === "mostRelevant" && cursor.sortBy === "mostRelevant") {
    return or(
      lt(QUESTION_SCORE_SQL, cursor.score),
      and(
        eq(QUESTION_SCORE_SQL, cursor.score),
        lt(forumQuestion.answerCount, cursor.answerCount),
      ),
      and(
        eq(QUESTION_SCORE_SQL, cursor.score),
        eq(forumQuestion.answerCount, cursor.answerCount),
        lt(forumQuestion.createdAt, cursor.createdAt),
      ),
      and(
        eq(QUESTION_SCORE_SQL, cursor.score),
        eq(forumQuestion.answerCount, cursor.answerCount),
        eq(forumQuestion.createdAt, cursor.createdAt),
        lt(forumQuestion.id, cursor.id),
      ),
    );
  }

  if (sortBy === "mostAnswered" && cursor.sortBy === "mostAnswered") {
    return or(
      lt(forumQuestion.answerCount, cursor.answerCount),
      and(
        eq(forumQuestion.answerCount, cursor.answerCount),
        lt(forumQuestion.createdAt, cursor.createdAt),
      ),
      and(
        eq(forumQuestion.answerCount, cursor.answerCount),
        eq(forumQuestion.createdAt, cursor.createdAt),
        lt(forumQuestion.id, cursor.id),
      ),
    );
  }

  if (sortBy === "newest" && cursor.sortBy === "newest") {
    return or(
      lt(forumQuestion.createdAt, cursor.createdAt),
      and(
        eq(forumQuestion.createdAt, cursor.createdAt),
        lt(forumQuestion.id, cursor.id),
      ),
    );
  }

  if (sortBy === "oldest" && cursor.sortBy === "oldest") {
    return or(
      gt(forumQuestion.createdAt, cursor.createdAt),
      and(
        eq(forumQuestion.createdAt, cursor.createdAt),
        gt(forumQuestion.id, cursor.id),
      ),
    );
  }

  return undefined;
}

function buildPublicQuestionsBaseQuery(
  trendingRankingTimestampSql: SQL = sql`statement_timestamp()`,
) {
  const trendingScore = buildTrendingScoreSql(trendingRankingTimestampSql);
  const trendingEngagementScore =
    buildTrendingRecentEngagementScoreSql(trendingRankingTimestampSql);
  const trendingLastActivityAt =
    buildTrendingLastActivitySql(trendingRankingTimestampSql);
  return db
    .select({
      question: forumQuestion,
      categoryName: forumCategory.name,
      authorDisplayName: userProfile.displayName,
      authorFullName: user.name,
      authorAvatarKey: userProfile.avatarKey,
      viewerVoteType: sql<string | null>`null`,
      viewerSavedQuestionId: sql<string | null>`null`,
      voteCount: QUESTION_VOTE_COUNT_SQL.mapWith(toInteger),
      trendingScore: trendingScore.mapWith(Number),
      trendingEngagementScore: trendingEngagementScore.mapWith(toInteger),
      trendingRankingTimestamp: sql<string>`${trendingRankingTimestampSql}::text`.mapWith(String),
      trendingLastActivityAt: trendingLastActivityAt.mapWith(String),
    })
    .from(forumQuestion)
    .innerJoin(forumCategory, eq(forumCategory.id, forumQuestion.categoryId))
    .innerJoin(user, eq(user.id, forumQuestion.authorId))
    .leftJoin(userProfile, eq(userProfile.userId, user.id));
}

function buildQuestionsWhereClause(
  categoryId?: string,
  tagId?: string,
  search?: string,
  isUnanswered = false,
  isTrending = false,
  trendingRankingTimestampSql: SQL = sql`statement_timestamp()`,
  sortBy: QuestionSortBy = "newest",
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

  if (search) {
    const searchPattern = `%${escapeLikePattern(search)}%`;
    const tagMatchExists = buildQuestionTagSearchExists(searchPattern);
    const answerMatchExists = buildQuestionAnswerSearchExists(searchPattern);
    const searchFilter = or(
      ilike(forumQuestion.title, searchPattern),
      ilike(forumQuestion.body, searchPattern),
      ilike(forumCategory.name, searchPattern),
      ilike(forumCategory.description, searchPattern),
      ilike(forumCategory.slug, searchPattern),
      ilike(user.name, searchPattern),
      ilike(user.firstName, searchPattern),
      ilike(user.lastName, searchPattern),
      ilike(user.occupation, searchPattern),
      ilike(userProfile.displayName, searchPattern),
      ilike(userProfile.bio, searchPattern),
      tagMatchExists,
      answerMatchExists,
    );

    if (searchFilter) {
      filters.push(searchFilter);
    }
  }

  if (isUnanswered) {
    filters.push(eq(forumQuestion.answerCount, 0));
  }

  if (sortBy === "mostAnswered" && !isUnanswered && !isTrending) {
    filters.push(gt(forumQuestion.answerCount, 0));
  }

  if (isTrending) {
    filters.push(
      sql`${buildTrendingRecentEngagementScoreSql(trendingRankingTimestampSql)} >= ${MIN_TRENDING_ENGAGEMENT_SCORE}`,
    );
  }

  const cursorFilter = buildQuestionsCursorFilter(
    sortBy,
    isTrending,
    trendingRankingTimestampSql,
    cursor,
  );
  if (cursorFilter) {
    filters.push(cursorFilter);
  }

  return and(...filters);
}

async function countQuestions(
  {
    categoryId,
    tagId,
    search,
    isUnanswered,
    isTrending,
    sortBy,
  }: Omit<GetQuestionsQuery, "limit" | "cursor">,
  trendingRankingTimestampSql: SQL,
) {
  const [result] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(forumQuestion)
    .innerJoin(forumCategory, eq(forumCategory.id, forumQuestion.categoryId))
    .innerJoin(user, eq(user.id, forumQuestion.authorId))
    .leftJoin(userProfile, eq(userProfile.userId, user.id))
    .where(
      buildQuestionsWhereClause(
        categoryId,
        tagId,
        search,
        isUnanswered,
        isTrending,
        trendingRankingTimestampSql,
        sortBy,
      ),
    );

  return normalizePaginationTotal(result?.total);
}

function buildQuestionsOrderBy(
  sortBy: QuestionSortBy,
  isTrending = false,
  trendingRankingTimestampSql: SQL = sql`statement_timestamp()`,
) {
  if (isTrending) {
    const trendingScore = buildTrendingScoreSql(trendingRankingTimestampSql);
    const engagementScore =
      buildTrendingRecentEngagementScoreSql(trendingRankingTimestampSql);
    const lastActivityAt =
      buildTrendingLastActivitySql(trendingRankingTimestampSql);

    return [
      desc(trendingScore),
      desc(engagementScore),
      desc(sql`${lastActivityAt}::timestamptz`),
      desc(forumQuestion.createdAt),
      desc(forumQuestion.id),
    ] as const;
  }

  if (sortBy === "oldest") {
    return [
      asc(forumQuestion.createdAt),
      asc(forumQuestion.id),
    ] as const;
  }

  if (sortBy === "mostVoted") {
    return [
      desc(QUESTION_SCORE_SQL),
      desc(forumQuestion.createdAt),
      desc(forumQuestion.id),
    ] as const;
  }

  if (sortBy === "mostRelevant") {
    return [
      desc(QUESTION_SCORE_SQL),
      desc(forumQuestion.answerCount),
      desc(forumQuestion.createdAt),
      desc(forumQuestion.id),
    ] as const;
  }

  if (sortBy === "mostAnswered") {
    return [
      desc(forumQuestion.answerCount),
      desc(forumQuestion.createdAt),
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
      viewerSavedQuestionId: forumQuestionSave.questionId,
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
      forumQuestionSave,
      and(
        eq(forumQuestionSave.questionId, forumQuestion.id),
        eq(forumQuestionSave.saverId, viewerId),
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
    viewerSavedQuestionId: rows[0].viewerSavedQuestionId,
    voteCount: toInteger(
      rows[0].question.upvoteCount + rows[0].question.downvoteCount,
    ),
    trendingScore: 0,
    trendingEngagementScore: 0,
    trendingRankingTimestamp: null,
    trendingLastActivityAt: null,
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

export async function findQuestionByIdPublic(
  id: string,
): Promise<ForumQuestionWithTags | null> {
  const rows = await db
    .select({
      question: forumQuestion,
      categoryName: forumCategory.name,
      authorDisplayName: userProfile.displayName,
      authorFullName: user.name,
      authorAvatarKey: userProfile.avatarKey,
      viewerSavedQuestionId: sql<string | null>`null`,
      tagId: forumTag.id,
      tagName: forumTag.name,
    })
    .from(forumQuestion)
    .innerJoin(forumCategory, eq(forumCategory.id, forumQuestion.categoryId))
    .innerJoin(user, eq(user.id, forumQuestion.authorId))
    .leftJoin(userProfile, eq(userProfile.userId, user.id))
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

  const questionRow: PublicQuestionHydrationRow = {
    question: rows[0].question,
    categoryName: rows[0].categoryName,
    authorDisplayName: rows[0].authorDisplayName,
    authorFullName: rows[0].authorFullName,
    authorAvatarKey: rows[0].authorAvatarKey,
    viewerSavedQuestionId: rows[0].viewerSavedQuestionId,
    voteCount: toInteger(
      rows[0].question.upvoteCount + rows[0].question.downvoteCount,
    ),
    trendingScore: 0,
    trendingEngagementScore: 0,
    trendingRankingTimestamp: null,
    trendingLastActivityAt: null,
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

  return hydratePublicQuestion(questionRow, tags);
}

export async function findQuestions(
  {
    categoryId,
    tagId,
    search,
    isUnanswered,
    isTrending,
    limit,
    sortBy,
    cursor,
  }: GetQuestionsQuery,
  viewerId: string,
): Promise<QuestionsListResult> {
  const trendingRankingTimestampSql =
    buildTrendingRankingTimestampSql(cursor);
  const whereClause = buildQuestionsWhereClause(
    categoryId,
    tagId,
    search,
    isUnanswered,
    isTrending,
    trendingRankingTimestampSql,
    sortBy,
    cursor,
  );
  const baseQuery = buildQuestionsBaseQuery(
    viewerId,
    trendingRankingTimestampSql,
  )
    .where(whereClause)
    .orderBy(
      ...buildQuestionsOrderBy(
        sortBy,
        isTrending,
        trendingRankingTimestampSql,
      ),
    );

  const [rows, total] = await Promise.all([
    baseQuery.limit(limit + 1),
    countQuestions(
      {
        categoryId,
        tagId,
        search,
        isUnanswered,
        isTrending,
        sortBy,
      },
      trendingRankingTimestampSql,
    ),
  ]);
  const { pageRows: questionRows, pagination } =
    buildCursorPagination<QuestionListRow>({
      rows,
      limit,
      total,
      getNextCursor: (lastQuestionRow) =>
        buildNextQuestionsCursor(sortBy, lastQuestionRow, isTrending),
    });
  const questions = await attachTagsToQuestions(questionRows);

  return {
    questions,
    pagination,
  };
}

export async function findQuestionsByAuthorId(
  authorId: string,
): Promise<ForumQuestionWithTags[]> {
  const rows = await buildQuestionsBaseQuery(authorId)
    .where(
      and(
        eq(forumQuestion.authorId, authorId),
        inArray(forumQuestion.status, VISIBLE_QUESTION_STATUSES),
      ),
    )
    .orderBy(desc(forumQuestion.createdAt), desc(forumQuestion.id));

  return attachTagsToQuestions(rows);
}

export async function findSavedQuestionsByUserId(
  userId: string,
  { limit, cursor }: GetSavedQuestionsQuery,
): Promise<QuestionsListResult> {
  const cursorFilter = buildSavedQuestionsCursorFilter(cursor);
  const filters = [
    eq(forumQuestionSaveList.saverId, userId),
    inArray(forumQuestion.status, VISIBLE_QUESTION_STATUSES),
  ];

  if (cursorFilter) {
    filters.push(cursorFilter);
  }

  const rowsQuery = buildSavedQuestionsBaseQuery(userId)
    .where(and(...filters))
    .orderBy(desc(forumQuestionSaveList.createdAt), desc(forumQuestion.id))
    .limit(limit + 1);

  const countFilters = [
    eq(forumQuestionSaveList.saverId, userId),
    inArray(forumQuestion.status, VISIBLE_QUESTION_STATUSES),
  ];
  const countQuery = db
    .select({ total: sql<number>`count(*)::int` })
    .from(forumQuestionSaveList)
    .innerJoin(
      forumQuestion,
      eq(forumQuestion.id, forumQuestionSaveList.questionId),
    )
    .where(and(...countFilters));

  const [rows, countResult] = await Promise.all([rowsQuery, countQuery]);
  const total = normalizePaginationTotal(countResult[0]?.total);
  const { pageRows: questionRows, pagination } =
    buildCursorPagination<SavedQuestionListRow>({
      rows,
      limit,
      total,
      getNextCursor: buildNextSavedQuestionsCursor,
    });
  const questions = await attachTagsToQuestions(questionRows);

  return {
    questions,
    pagination,
  };
}

export async function findQuestionsPublic({
  categoryId,
  tagId,
  search,
  isUnanswered,
  isTrending,
  limit,
  sortBy,
  cursor,
}: GetQuestionsQuery): Promise<QuestionsListResult> {
  const trendingRankingTimestampSql =
    buildTrendingRankingTimestampSql(cursor);
  const whereClause = buildQuestionsWhereClause(
    categoryId,
    tagId,
    search,
    isUnanswered,
    isTrending,
    trendingRankingTimestampSql,
    sortBy,
    cursor,
  );
  const baseQuery = buildPublicQuestionsBaseQuery(
    trendingRankingTimestampSql,
  )
    .where(whereClause)
    .orderBy(
      ...buildQuestionsOrderBy(
        sortBy,
        isTrending,
        trendingRankingTimestampSql,
      ),
    );

  const [rows, total] = await Promise.all([
    baseQuery.limit(limit + 1),
    countQuestions(
      {
        categoryId,
        tagId,
        search,
        isUnanswered,
        isTrending,
        sortBy,
      },
      trendingRankingTimestampSql,
    ),
  ]);
  const { pageRows: questionRows, pagination } =
    buildCursorPagination<PublicQuestionHydrationRow>({
      rows,
      limit,
      total,
      getNextCursor: (lastQuestionRow) =>
        buildNextQuestionsCursor(
          sortBy,
          {
            ...lastQuestionRow,
            viewerVoteType: null,
          },
          isTrending,
        ),
    });

  const questions = await attachPublicTagsToQuestions(questionRows);

  return {
    questions,
    pagination,
  };
}

async function attachPublicTagsToQuestions(
  questions: PublicQuestionHydrationRow[],
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
    const current = tagsByQuestionId.get(row.questionId);
    if (!current) {
      tagsByQuestionId.set(row.questionId, [
        { id: row.tagId, name: row.tagName },
      ]);
      continue;
    }

    if (!current.some((tag) => tag.id === row.tagId)) {
      current.push({ id: row.tagId, name: row.tagName });
    }
  }

  return questions.map((row) =>
    hydratePublicQuestion(row, tagsByQuestionId.get(row.question.id) ?? []),
  );
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

    const normalizedTags = normalizeQuestionTags(data.tags ?? []);

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
      const normalizedTags = normalizeQuestionTags(data.tags);

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

export async function saveQuestionForUser(
  questionId: string,
  userId: string,
): Promise<{ questionId: string; created: boolean } | null> {
  return db.transaction(async (tx) => {
    const [question] = await tx
      .select({ id: forumQuestion.id })
      .from(forumQuestion)
      .where(
        and(
          eq(forumQuestion.id, questionId),
          inArray(forumQuestion.status, VISIBLE_QUESTION_STATUSES),
        ),
      );

    if (!question) {
      return null;
    }

    const saveInsertData: ForumQuestionSaveInsert = {
      questionId,
      saverId: userId,
    };

    const insertedSaves = await tx
      .insert(forumQuestionSave)
      .values(saveInsertData)
      .onConflictDoNothing({
        target: [forumQuestionSave.questionId, forumQuestionSave.saverId],
      })
      .returning({ questionId: forumQuestionSave.questionId });

    return {
      questionId: question.id,
      created: insertedSaves.length > 0,
    };
  });
}

export async function unsaveQuestionForUser(
  questionId: string,
  userId: string,
): Promise<boolean> {
  const savedQuestionId = await db.transaction(async (tx) => {
    const [question] = await tx
      .select({ id: forumQuestion.id })
      .from(forumQuestion)
      .where(
        and(
          eq(forumQuestion.id, questionId),
          inArray(forumQuestion.status, VISIBLE_QUESTION_STATUSES),
        ),
      );

    if (!question) {
      return null;
    }

    await tx
      .delete(forumQuestionSave)
      .where(
        and(
          eq(forumQuestionSave.questionId, questionId),
          eq(forumQuestionSave.saverId, userId),
        ),
      );

    return question.id;
  });

  return Boolean(savedQuestionId);
}
