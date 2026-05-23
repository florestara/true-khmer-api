import {
  and,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  sql,
  type SQL,
  type SQLWrapper,
} from "drizzle-orm";
import { env } from "../../config/env";
import { db } from "../../db";
import {
  city,
  country,
  forumCategory,
  forumQuestion,
  forumQuestionSave,
  forumQuestionTag,
  forumQuestionVote,
  forumTag,
  launchpad,
  launchpadCategory,
  launchpadRole,
  launchpadSave,
  user,
  userProfile,
  volunteerApplication,
  volunteerCategory,
  volunteerOpportunity,
  volunteerOpportunitySave,
  volunteerRole,
} from "../../db/schema";
import {
  normalizePaginationTotal,
  type CursorPagination,
} from "../../utils/pagination.helper";
import {
  encodeSavedItemsPageCursor,
  type GetSavedItemsQuery,
  type SavedItemType,
  type SavedItemsPageCursor,
} from "./schema/saved.schema";

const TYPE_ORDER: Record<SavedItemType, number> = {
  project: 0,
  volunteer: 1,
  forum: 2,
};

const VISIBLE_FORUM_QUESTION_STATUSES = ["PUBLISHED", "CLOSED"] as const;
const CAMBODIA_NORMALIZED_NAME = env.VOLUNTEER_COUNTRY_NORMALIZED_NAME;

type SavedProjectItem = {
  id: string;
  name: string;
  description: string | null;
  deadline: string | null;
  status: "DRAFT" | "LIVE" | "IN_PROGRESS" | "COMPLETED" | "CANCELED";
  logoKey: string | null;
  coverKey: string | null;
  documentKeys: string[];
  documentNames: string[];
  phoneNumber: string | null;
  email: string | null;
  telegramUsername: string | null;
  createdBy: {
    id: string;
    name: string;
    avatarKey: string | null;
    launchpadCount: number;
  };
  createdAt: string;
  category?: {
    id: string;
    name: string;
  };
  city?: {
    id: string;
    name: string;
  };
  totalRoles: number;
  totalView: number;
  isSaved: true;
  savedAt: string;
};

type SavedVolunteerItem = {
  id: string;
  title: string;
  overview: string;
  startDate: string | null;
  endDate: string | null;
  commitmentLabel: string | null;
  commitmentDescription: string | null;
  applicationDeadline: string;
  applicationCount: number;
  capacity: number;
  filled: boolean;
  totalView: number;
  coverImageKey: string;
  createdAt: string;
  viewerSave: true;
  category: {
    id: string;
    name: string;
  };
  location: {
    id: string;
    name: string;
  };
};

type SavedForumItem = {
  id: string;
  title: string;
  body: string;
  imageKey: string | null;
  status: "PUBLISHED" | "CLOSED" | "DELETED";
  upvoteCount: number;
  downvoteCount: number;
  answerCount: number;
  bestAnswerId: string | null;
  bestAnswerSelectedAt: string | null;
  score: number;
  viewerVote: "UPVOTE" | "DOWNVOTE" | null;
  viewerSave: true;
  category: {
    id: string;
    name: string;
  };
  author: {
    id: string;
    name: string;
    avatarKey: string | null;
  };
  tags: Array<{
    id: string;
    name: string;
  }>;
  createdAt: string;
  updatedAt: string;
};

export type SavedItem =
  | {
      type: "project";
      savedAt: string;
      id: string;
      item: SavedProjectItem;
    }
  | {
      type: "volunteer";
      savedAt: string;
      id: string;
      item: SavedVolunteerItem;
    }
  | {
      type: "forum";
      savedAt: string;
      id: string;
      item: SavedForumItem;
    };

export type SavedItemsResult = {
  items: Array<Omit<SavedItem, "id">>;
  pagination: CursorPagination;
  counts: {
    all: number;
    project: number;
    volunteer: number;
    forum: number;
  };
};

function toInteger(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toIsoDateTimeString(value: string): string {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : value;
}

function toNullableIsoDateTimeString(value: string | null): string | null {
  return value === null ? null : toIsoDateTimeString(value);
}

function resolveAuthorName(row: {
  authorDisplayName: string | null;
  authorFullName: string;
}) {
  const displayName = row.authorDisplayName?.trim();
  const fullName = row.authorFullName.trim();
  return displayName && displayName.length > 0 ? displayName : fullName;
}

function buildSavedCursorFilter(
  type: SavedItemType,
  savedAtColumn: SQLWrapper,
  idColumn: SQLWrapper,
  cursor: SavedItemsPageCursor | undefined,
) {
  if (!cursor) {
    return undefined;
  }

  if (TYPE_ORDER[type] > TYPE_ORDER[cursor.type]) {
    return sql`(${savedAtColumn} < ${cursor.savedAt}::timestamptz OR ${savedAtColumn} = ${cursor.savedAt}::timestamptz)`;
  }

  if (TYPE_ORDER[type] < TYPE_ORDER[cursor.type]) {
    return sql`${savedAtColumn} < ${cursor.savedAt}::timestamptz`;
  }

  return sql`(${savedAtColumn} < ${cursor.savedAt}::timestamptz OR (${savedAtColumn} = ${cursor.savedAt}::timestamptz AND ${idColumn} < ${cursor.id}::uuid))`;
}

function compareSavedItems(left: SavedItem, right: SavedItem) {
  const savedAtDelta =
    Date.parse(right.savedAt) - Date.parse(left.savedAt);
  if (savedAtDelta !== 0) {
    return savedAtDelta;
  }

  const typeDelta = TYPE_ORDER[left.type] - TYPE_ORDER[right.type];
  if (typeDelta !== 0) {
    return typeDelta;
  }

  if (right.id > left.id) {
    return 1;
  }
  if (right.id < left.id) {
    return -1;
  }
  return 0;
}

function buildPagination(
  rows: SavedItem[],
  limit: number,
  total: number,
): Pick<SavedItemsResult, "items" | "pagination"> {
  const sortedRows = [...rows].sort(compareSavedItems);
  const hasMore = sortedRows.length > limit;
  const pageRows = hasMore ? sortedRows.slice(0, limit) : sortedRows;
  const lastRow = pageRows.length > 0 ? pageRows[pageRows.length - 1] : null;

  return {
    items: pageRows.map(({ id: _id, ...row }) => row),
    pagination: {
      limit,
      hasMore,
      nextCursor:
        hasMore && lastRow
          ? encodeSavedItemsPageCursor({
              savedAt: lastRow.savedAt,
              type: lastRow.type,
              id: lastRow.id,
            })
          : null,
      total,
    },
  };
}

async function countSavedProjects(userId: string) {
  const [result] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(launchpadSave)
    .innerJoin(launchpad, eq(launchpad.id, launchpadSave.launchpadId))
    .where(and(eq(launchpadSave.saverId, userId), isNull(launchpad.deletedAt)));

  return normalizePaginationTotal(result?.total);
}

async function findSavedProjects(
  userId: string,
  limit: number,
  cursor: SavedItemsPageCursor | undefined,
): Promise<SavedItem[]> {
  const cursorFilter = buildSavedCursorFilter(
    "project",
    launchpadSave.createdAt,
    launchpad.id,
    cursor,
  );
  const filters: SQL<unknown>[] = [
    eq(launchpadSave.saverId, userId),
    isNull(launchpad.deletedAt),
  ];

  if (cursorFilter) {
    filters.push(cursorFilter);
  }

  const launchpadCountSubquery = db
    .select({
      userId: launchpad.createdBy,
      count: sql<number>`cast(count(${launchpad.id}) as int)`.as("count"),
    })
    .from(launchpad)
    .where(isNull(launchpad.deletedAt))
    .groupBy(launchpad.createdBy)
    .as("launchpad_count");

  const rows = await db
    .select({
      launchpad,
      category: {
        id: launchpadCategory.id,
        name: launchpadCategory.name,
      },
      city: {
        id: city.id,
        name: city.name,
      },
      createdByUser: user,
      createdByProfile: userProfile,
      launchpadCount: sql<number>`coalesce(${launchpadCountSubquery.count}, 0)`,
      totalRoles: sql<number>`cast(count(${launchpadRole.id}) as int)`.as(
        "totalRoles",
      ),
      savedAt: launchpadSave.createdAt,
    })
    .from(launchpadSave)
    .innerJoin(launchpad, eq(launchpad.id, launchpadSave.launchpadId))
    .leftJoin(launchpadCategory, eq(launchpad.categoryId, launchpadCategory.id))
    .leftJoin(city, eq(launchpad.cityId, city.id))
    .leftJoin(user, eq(launchpad.createdBy, user.id))
    .leftJoin(userProfile, eq(user.id, userProfile.userId))
    .leftJoin(
      launchpadCountSubquery,
      eq(user.id, launchpadCountSubquery.userId),
    )
    .leftJoin(launchpadRole, eq(launchpad.id, launchpadRole.launchpadId))
    .where(and(...filters))
    .groupBy(
      launchpad.id,
      launchpadCategory.id,
      city.id,
      user.id,
      userProfile.id,
      launchpadCountSubquery.count,
      launchpadSave.createdAt,
    )
    .orderBy(desc(launchpadSave.createdAt), desc(launchpad.id))
    .limit(limit + 1);

  return rows.map((row) => {
    const savedAt = toIsoDateTimeString(row.savedAt);
    const item: SavedProjectItem = {
      id: row.launchpad.id,
      name: row.launchpad.name,
      description: row.launchpad.description,
      deadline: toNullableIsoDateTimeString(row.launchpad.deadline),
      status: row.launchpad.status as SavedProjectItem["status"],
      logoKey: row.launchpad.logoKey,
      coverKey: row.launchpad.coverKey,
      documentKeys: row.launchpad.documentKeys as string[],
      documentNames: row.launchpad.documentNames as string[],
      phoneNumber: row.launchpad.phoneNumber,
      email: row.launchpad.email,
      telegramUsername: row.launchpad.telegramUsername,
      createdBy: row.createdByUser
        ? {
            id: row.createdByUser.id,
            name: row.createdByUser.name,
            avatarKey: row.createdByProfile?.avatarKey ?? null,
            launchpadCount: row.launchpadCount ?? 0,
          }
        : {
            id: row.launchpad.createdBy,
            name: "Unknown",
            avatarKey: null,
            launchpadCount: 0,
          },
      createdAt: toIsoDateTimeString(row.launchpad.createdAt),
      category: row.category
        ? {
            id: row.category.id,
            name: row.category.name,
          }
        : undefined,
      city: row.city
        ? {
            id: row.city.id,
            name: row.city.name,
          }
        : undefined,
      totalRoles: toInteger(row.totalRoles),
      totalView: toInteger(row.launchpad.totalView),
      isSaved: true,
      savedAt,
    };

    return {
      type: "project",
      savedAt,
      id: row.launchpad.id,
      item,
    };
  });
}

async function countSavedVolunteerOpportunities(userId: string) {
  const [result] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(volunteerOpportunitySave)
    .innerJoin(
      volunteerOpportunity,
      eq(volunteerOpportunity.id, volunteerOpportunitySave.opportunityId),
    )
    .innerJoin(
      volunteerCategory,
      eq(volunteerCategory.id, volunteerOpportunity.categoryId),
    )
    .innerJoin(city, eq(city.id, volunteerOpportunity.cityId))
    .innerJoin(country, eq(country.id, city.countryId))
    .where(
      and(
        eq(volunteerOpportunitySave.saverId, userId),
        eq(volunteerOpportunity.status, "LIVE"),
        isNull(volunteerOpportunity.deletedAt),
        eq(volunteerCategory.status, "ACTIVE"),
        eq(city.isActive, true),
        eq(country.isActive, true),
        eq(country.normalizedName, CAMBODIA_NORMALIZED_NAME),
        isNotNull(volunteerOpportunity.publishedAt),
      ),
    );

  return normalizePaginationTotal(result?.total);
}

async function getVolunteerApplicationCounts(opportunityIds: string[]) {
  const uniqueOpportunityIds = [...new Set(opportunityIds)];
  if (uniqueOpportunityIds.length === 0) {
    return new Map<string, number>();
  }

  const rows = await db
    .select({
      opportunityId: volunteerApplication.opportunityId,
      applicationCount: sql<number>`count(*)::int`.as("application_count"),
    })
    .from(volunteerApplication)
    .where(
      and(
        inArray(volunteerApplication.opportunityId, uniqueOpportunityIds),
        eq(volunteerApplication.status, "CONFIRMED"),
      ),
    )
    .groupBy(volunteerApplication.opportunityId);

  return new Map(
    rows.map((row) => [row.opportunityId, toInteger(row.applicationCount)]),
  );
}

async function getVolunteerCapacities(opportunityIds: string[]) {
  const uniqueOpportunityIds = [...new Set(opportunityIds)];
  if (uniqueOpportunityIds.length === 0) {
    return new Map<string, number>();
  }

  const rows = await db
    .select({
      opportunityId: volunteerRole.opportunityId,
      capacity:
        sql<number>`coalesce(sum(${volunteerRole.capacity}), 0)::int`.as(
          "capacity",
        ),
    })
    .from(volunteerRole)
    .where(inArray(volunteerRole.opportunityId, uniqueOpportunityIds))
    .groupBy(volunteerRole.opportunityId);

  return new Map(
    rows.map((row) => [row.opportunityId, toInteger(row.capacity)]),
  );
}

async function findSavedVolunteerOpportunities(
  userId: string,
  limit: number,
  cursor: SavedItemsPageCursor | undefined,
): Promise<SavedItem[]> {
  const cursorFilter = buildSavedCursorFilter(
    "volunteer",
    volunteerOpportunitySave.createdAt,
    volunteerOpportunity.id,
    cursor,
  );
  const filters: SQL<unknown>[] = [
    eq(volunteerOpportunitySave.saverId, userId),
    eq(volunteerOpportunity.status, "LIVE"),
    isNull(volunteerOpportunity.deletedAt),
    eq(volunteerCategory.status, "ACTIVE"),
    eq(city.isActive, true),
    eq(country.isActive, true),
    eq(country.normalizedName, CAMBODIA_NORMALIZED_NAME),
    isNotNull(volunteerOpportunity.publishedAt),
  ];

  if (cursorFilter) {
    filters.push(cursorFilter);
  }

  const rows = await db
    .select({
      opportunity: volunteerOpportunity,
      category: {
        id: volunteerCategory.id,
        name: volunteerCategory.name,
      },
      location: {
        id: city.id,
        name: city.name,
      },
      savedAt: volunteerOpportunitySave.createdAt,
    })
    .from(volunteerOpportunitySave)
    .innerJoin(
      volunteerOpportunity,
      eq(volunteerOpportunity.id, volunteerOpportunitySave.opportunityId),
    )
    .innerJoin(
      volunteerCategory,
      eq(volunteerCategory.id, volunteerOpportunity.categoryId),
    )
    .innerJoin(city, eq(city.id, volunteerOpportunity.cityId))
    .innerJoin(country, eq(country.id, city.countryId))
    .where(and(...filters))
    .orderBy(desc(volunteerOpportunitySave.createdAt), desc(volunteerOpportunity.id))
    .limit(limit + 1);

  const opportunityIds = rows.map((row) => row.opportunity.id);
  const [applicationCountByOpportunityId, capacityByOpportunityId] =
    await Promise.all([
      getVolunteerApplicationCounts(opportunityIds),
      getVolunteerCapacities(opportunityIds),
    ]);

  return rows.map((row) => {
    const savedAt = toIsoDateTimeString(row.savedAt);
    const item: SavedVolunteerItem = {
      id: row.opportunity.id,
      title: row.opportunity.title,
      overview: row.opportunity.overview,
      startDate: toNullableIsoDateTimeString(row.opportunity.startDate),
      endDate: toNullableIsoDateTimeString(row.opportunity.endDate),
      commitmentLabel: row.opportunity.commitmentLabel,
      commitmentDescription: row.opportunity.commitmentDescription,
      applicationDeadline: toIsoDateTimeString(
        row.opportunity.applicationDeadline,
      ),
      applicationCount:
        applicationCountByOpportunityId.get(row.opportunity.id) ?? 0,
      capacity: capacityByOpportunityId.get(row.opportunity.id) ?? 0,
      filled: row.opportunity.filled,
      totalView: toInteger(row.opportunity.totalView),
      coverImageKey: row.opportunity.coverImageKey,
      createdAt: toIsoDateTimeString(row.opportunity.createdAt),
      viewerSave: true,
      category: row.category,
      location: row.location,
    };

    return {
      type: "volunteer",
      savedAt,
      id: row.opportunity.id,
      item,
    };
  });
}

async function countSavedForumQuestions(userId: string) {
  const [result] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(forumQuestionSave)
    .innerJoin(forumQuestion, eq(forumQuestion.id, forumQuestionSave.questionId))
    .where(
      and(
        eq(forumQuestionSave.saverId, userId),
        inArray(forumQuestion.status, VISIBLE_FORUM_QUESTION_STATUSES),
      ),
    );

  return normalizePaginationTotal(result?.total);
}

async function getForumTagsByQuestionIds(questionIds: string[]) {
  const uniqueQuestionIds = [...new Set(questionIds)];
  if (uniqueQuestionIds.length === 0) {
    return new Map<string, Array<{ id: string; name: string }>>();
  }

  const rows = await db
    .select({
      questionId: forumQuestionTag.questionId,
      tag: {
        id: forumTag.id,
        name: forumTag.name,
      },
    })
    .from(forumQuestionTag)
    .innerJoin(forumTag, eq(forumTag.id, forumQuestionTag.tagId))
    .where(inArray(forumQuestionTag.questionId, uniqueQuestionIds));

  const tagsByQuestionId = new Map<string, Array<{ id: string; name: string }>>();
  for (const row of rows) {
    const tags = tagsByQuestionId.get(row.questionId);
    if (!tags) {
      tagsByQuestionId.set(row.questionId, [row.tag]);
      continue;
    }

    tags.push(row.tag);
  }

  return tagsByQuestionId;
}

async function findSavedForumQuestions(
  userId: string,
  limit: number,
  cursor: SavedItemsPageCursor | undefined,
): Promise<SavedItem[]> {
  const cursorFilter = buildSavedCursorFilter(
    "forum",
    forumQuestionSave.createdAt,
    forumQuestion.id,
    cursor,
  );
  const filters: SQL<unknown>[] = [
    eq(forumQuestionSave.saverId, userId),
    inArray(forumQuestion.status, VISIBLE_FORUM_QUESTION_STATUSES),
  ];

  if (cursorFilter) {
    filters.push(cursorFilter);
  }

  const rows = await db
    .select({
      question: forumQuestion,
      categoryName: forumCategory.name,
      authorDisplayName: userProfile.displayName,
      authorFullName: user.name,
      authorAvatarKey: userProfile.avatarKey,
      viewerVoteType: forumQuestionVote.voteType,
      savedAt: forumQuestionSave.createdAt,
    })
    .from(forumQuestionSave)
    .innerJoin(forumQuestion, eq(forumQuestion.id, forumQuestionSave.questionId))
    .innerJoin(forumCategory, eq(forumCategory.id, forumQuestion.categoryId))
    .innerJoin(user, eq(user.id, forumQuestion.authorId))
    .leftJoin(userProfile, eq(userProfile.userId, user.id))
    .leftJoin(
      forumQuestionVote,
      and(
        eq(forumQuestionVote.questionId, forumQuestion.id),
        eq(forumQuestionVote.voterId, userId),
      ),
    )
    .where(and(...filters))
    .orderBy(desc(forumQuestionSave.createdAt), desc(forumQuestion.id))
    .limit(limit + 1);

  const tagsByQuestionId = await getForumTagsByQuestionIds(
    rows.map((row) => row.question.id),
  );

  return rows.map((row) => {
    const savedAt = toIsoDateTimeString(row.savedAt);
    const item: SavedForumItem = {
      id: row.question.id,
      title: row.question.title,
      body: row.question.body,
      imageKey: row.question.imageKey,
      status: row.question.status as SavedForumItem["status"],
      upvoteCount: row.question.upvoteCount,
      downvoteCount: row.question.downvoteCount,
      answerCount: row.question.answerCount,
      bestAnswerId: row.question.bestAnswerId,
      bestAnswerSelectedAt: toNullableIsoDateTimeString(
        row.question.bestAnswerSelectedAt,
      ),
      score: row.question.upvoteCount - row.question.downvoteCount,
      viewerVote: row.viewerVoteType,
      viewerSave: true,
      category: {
        id: row.question.categoryId,
        name: row.categoryName,
      },
      author: {
        id: row.question.authorId,
        name: resolveAuthorName(row),
        avatarKey: row.authorAvatarKey,
      },
      tags: tagsByQuestionId.get(row.question.id) ?? [],
      createdAt: toIsoDateTimeString(row.question.createdAt),
      updatedAt: toIsoDateTimeString(row.question.updatedAt),
    };

    return {
      type: "forum",
      savedAt,
      id: row.question.id,
      item,
    };
  });
}

export async function getSavedItems(
  userId: string,
  query: GetSavedItemsQuery,
): Promise<SavedItemsResult> {
  const fetchLimit = query.limit + 1;
  const shouldFetchProject =
    query.filter === "all" || query.filter === "project";
  const shouldFetchVolunteer =
    query.filter === "all" || query.filter === "volunteer";
  const shouldFetchForum = query.filter === "all" || query.filter === "forum";

  const [
    projects,
    volunteers,
    forumQuestions,
    projectTotal,
    volunteerTotal,
    forumTotal,
  ] = await Promise.all([
      shouldFetchProject
        ? findSavedProjects(userId, fetchLimit, query.cursor)
        : Promise.resolve([]),
      shouldFetchVolunteer
        ? findSavedVolunteerOpportunities(userId, fetchLimit, query.cursor)
        : Promise.resolve([]),
      shouldFetchForum
        ? findSavedForumQuestions(userId, fetchLimit, query.cursor)
        : Promise.resolve([]),
      countSavedProjects(userId),
      countSavedVolunteerOpportunities(userId),
      countSavedForumQuestions(userId),
    ]);

  const counts = {
    project: projectTotal,
    volunteer: volunteerTotal,
    forum: forumTotal,
  };
  const totalByFilter =
    query.filter === "all"
      ? counts.project + counts.volunteer + counts.forum
      : counts[query.filter];

  return {
    ...buildPagination(
      [...projects, ...volunteers, ...forumQuestions],
      query.limit,
      totalByFilter,
    ),
    counts: {
      all: counts.project + counts.volunteer + counts.forum,
      ...counts,
    },
  };
}
