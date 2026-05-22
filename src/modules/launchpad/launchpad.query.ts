import { sql, eq, and, ilike, inArray, isNull } from "drizzle-orm";
import { db } from "../../db";
import {
  LAUNCHPAD_ADVISORY_LOCK_NAMESPACE,
  LAUNCHPAD_CATEGORY_TOTAL_LAUNCHPAD_LOCK_KEY,
} from "./lib/constants";
import {
  CreateLaunchpadRequestInput,
  GetLaunchpadQueryListInput,
  encodeLaunchpadPageCursor,
} from "./schema/launchpad.request.schema";
import {
  city,
  launchpad,
  launchpadCategory,
  launchpadRole,
  launchpadSave,
  user,
  userProfile,
} from "../../db/schema";

type launchpadInsert = typeof launchpad.$inferInsert;
type launchpadRoleInsert = typeof launchpadRole.$inferInsert;
type LaunchpadStatus = (typeof launchpad.$inferSelect)["status"];

export type LaunchpadRole = {
  id: string;
  title: string;
  description: string | null;
  capacity: number;
};

export type LaunchpadDetail = {
  id: string;
  name: string;
  description: string | null;
  deadline: Date | null;
  status: LaunchpadStatus;
  logoKey: string | null;
  coverKey: string | null;
  documentKeys: string[];
  documentNames: string[];
  phoneNumber: string | null;
  email: string | null;
  telegramUsername: string | null;
  totalView: number;
  createdBy: {
    id: string;
    name: string;
    avatarKey: string | null;
    launchpadCount: number;
  };
  createdAt: Date;
  category?: {
    id: string;
    name: string;
  };
  city?: {
    id: string;
    name: string;
  };
  roles: LaunchpadRole[];
};

export type LaunchpadListItem = {
  id: string;
  name: string;
  description: string | null;
  deadline: Date | null;
  status: LaunchpadStatus;
  logoKey: string | null;
  coverKey: string | null;
  documentKeys: string[];
  documentNames: string[];
  phoneNumber: string | null;
  email: string | null;
  telegramUsername: string | null;
  totalView: number;
  createdBy: {
    id: string;
    name: string;
    avatarKey: string | null;
    launchpadCount: number;
  };
  createdAt: Date;
  category?: {
    id: string;
    name: string;
  };
  city?: {
    id: string;
    name: string;
  };
  totalRoles: number;
  isSaved: boolean;
};

function buildLaunchpadBaseQuery() {
  const launchpadCountSubquery = db
    .select({
      userId: launchpad.createdBy,
      count: sql<number>`cast(count(${launchpad.id}) as int)`.as("count"),
    })
    .from(launchpad)
    .where(isNull(launchpad.deletedAt))
    .groupBy(launchpad.createdBy)
    .as("launchpad_count");

  return db
    .select({
      launchpad: launchpad,
      category: launchpadCategory,
      city: city,
      createdBy: user,
      createdByProfile: userProfile,
      launchpadCount: sql<number>`coalesce(${launchpadCountSubquery.count}, 0)`,
      totalRoles: sql<number>`cast(count(${launchpadRole.id}) as int)`.as(
        "totalRoles",
      ),
    })
    .from(launchpad)
    .leftJoin(launchpadCategory, eq(launchpad.categoryId, launchpadCategory.id))
    .leftJoin(city, eq(launchpad.cityId, city.id))
    .leftJoin(user, eq(launchpad.createdBy, user.id))
    .leftJoin(userProfile, eq(user.id, userProfile.userId))
    .leftJoin(
      launchpadCountSubquery,
      eq(user.id, launchpadCountSubquery.userId),
    )
    .leftJoin(launchpadRole, eq(launchpad.id, launchpadRole.launchpadId))
    .groupBy(
      launchpad.id,
      launchpadCategory.id,
      city.id,
      user.id,
      userProfile.id,
      launchpadCountSubquery.count,
    );
}

function resolveLaunchpadStatus(status: LaunchpadStatus): LaunchpadStatus {
  return status;
}

function buildLaunchpadWhereClause(
  cursor: GetLaunchpadQueryListInput["cursor"],
  categoryId?: string,
  cityId?: string,
  search?: string,
) {
  const conditions = [isNull(launchpad.deletedAt)];

  if (categoryId) {
    conditions.push(eq(launchpad.categoryId, categoryId));
  }

  if (cityId) {
    conditions.push(eq(launchpad.cityId, cityId));
  }

  if (search) {
    conditions.push(ilike(launchpad.name, `%${search}%`));
  }

  if (cursor) {
    if (cursor.sortBy === "newest") {
      conditions.push(
        sql`(${launchpad.createdAt} < ${new Date(cursor.createdAt).toISOString()}::timestamptz OR (${launchpad.createdAt} = ${new Date(cursor.createdAt).toISOString()}::timestamptz AND ${launchpad.id} < ${cursor.id}))`,
      );
    } else if (cursor.sortBy === "oldest") {
      conditions.push(
        sql`(${launchpad.createdAt} > ${new Date(cursor.createdAt).toISOString()}::timestamptz OR (${launchpad.createdAt} = ${new Date(cursor.createdAt).toISOString()}::timestamptz AND ${launchpad.id} > ${cursor.id}))`,
      );
    }
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

function buildLaunchpadOrderBy(sortBy: GetLaunchpadQueryListInput["sortBy"]) {
  if (sortBy === "newest") {
    return sql`${launchpad.createdAt} DESC, ${launchpad.id} DESC`;
  } else {
    return sql`${launchpad.createdAt} ASC, ${launchpad.id} ASC`;
  }
}

async function updateCategoryTotalLaunchpadCount(
  txOrDb: Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db,
  categoryId: string,
  launchpadCount: number,
): Promise<void> {
  await txOrDb
    .update(launchpadCategory)
    .set({
      totalLaunchpad: sql`${launchpadCategory.totalLaunchpad} + ${launchpadCount}`,
    })
    .where(eq(launchpadCategory.id, categoryId));
}

export async function incrementLaunchpadViewCount(
  launchpadId: string,
): Promise<void> {
  await db
    .update(launchpad)
    .set({
      totalView: sql`${launchpad.totalView} + 1`,
    })
    .where(and(eq(launchpad.id, launchpadId), isNull(launchpad.deletedAt)));
}

export async function createLaunchpad(
  data: CreateLaunchpadRequestInput,
  userId: string,
): Promise<LaunchpadDetail> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(${LAUNCHPAD_ADVISORY_LOCK_NAMESPACE}, ${LAUNCHPAD_CATEGORY_TOTAL_LAUNCHPAD_LOCK_KEY})`,
    );

    const fieldToInsert: launchpadInsert = {
      categoryId: data.categoryId,
      cityId: data.cityId,
      name: data.name,
      description: data.description,
      deadline: data.deadline,
      logoKey: data.logoKey,
      coverKey: data.coverKey,
      documentKeys: data.materialDocumentKey,
      documentNames: data.materialDocumentName,
      phoneNumber: data.phoneNumber,
      email: data.email,
      telegramUsername: data.telegramUsername,
      createdBy: userId,
    };

    const [created] = await tx
      .insert(launchpad)
      .values(fieldToInsert)
      .returning();

    const roleData: launchpadRoleInsert[] = data.role.map((role) => ({
      title: role.name,
      launchpadId: created.id,
      description: role.description,
      capacity: role.capacity,
      createdBy: userId,
    }));

    const insertedRoles = await tx
      .insert(launchpadRole)
      .values(roleData)
      .returning();

    await updateCategoryTotalLaunchpadCount(tx, data.categoryId, 1);

    const [category] = await tx
      .select()
      .from(launchpadCategory)
      .where(eq(launchpadCategory.id, data.categoryId))
      .limit(1);

    const [cityData] = await tx
      .select()
      .from(city)
      .where(eq(city.id, data.cityId))
      .limit(1);

    const [createdByUser] = await tx
      .select({
        user: user,
        profile: userProfile,
      })
      .from(user)
      .leftJoin(userProfile, eq(user.id, userProfile.userId))
      .where(eq(user.id, userId))
      .limit(1);

    const [launchpadCountResult] = await tx
      .select({
        count: sql<number>`cast(count(${launchpad.id}) as int)`,
      })
      .from(launchpad)
      .where(and(eq(launchpad.createdBy, userId), isNull(launchpad.deletedAt)));

    return {
      id: created.id,
      name: created.name,
      description: created.description,
      deadline: created.deadline ? new Date(created.deadline) : null,
      status: resolveLaunchpadStatus(created.status),
      logoKey: created.logoKey,
      coverKey: created.coverKey,
      documentKeys: created.documentKeys as string[],
      documentNames: created.documentNames as string[],
      phoneNumber: created.phoneNumber,
      email: created.email,
      telegramUsername: created.telegramUsername,
      totalView: created.totalView ?? 0,
      createdBy: createdByUser
        ? {
            id: createdByUser.user.id,
            name: createdByUser.user.name,
            avatarKey: createdByUser.profile?.avatarKey ?? null,
            launchpadCount: launchpadCountResult?.count ?? 0,
          }
        : {
            id: userId,
            name: "Unknown",
            avatarKey: null,
            launchpadCount: 0,
          },
      createdAt: new Date(created.createdAt),
      category: category
        ? {
            id: category.id,
            name: category.name,
          }
        : undefined,
      city: cityData
        ? {
            id: cityData.id,
            name: cityData.name,
          }
        : undefined,
      roles: insertedRoles.map((role) => ({
        id: role.id,
        title: role.title,
        description: role.description,
        capacity: role.capacity,
      })),
    };
  });
}

export async function findLaunchpadById(
  launchpadId: string,
): Promise<LaunchpadDetail | null> {
  const [row] = await db
    .select({
      launchpad: launchpad,
      category: launchpadCategory,
      city: city,
      createdBy: user,
      createdByProfile: userProfile,
    })
    .from(launchpad)
    .leftJoin(launchpadCategory, eq(launchpad.categoryId, launchpadCategory.id))
    .leftJoin(city, eq(launchpad.cityId, city.id))
    .leftJoin(user, eq(launchpad.createdBy, user.id))
    .leftJoin(userProfile, eq(user.id, userProfile.userId))
    .where(and(eq(launchpad.id, launchpadId), isNull(launchpad.deletedAt)))
    .limit(1);

  if (!row) {
    return null;
  }

  const roles = await db
    .select()
    .from(launchpadRole)
    .where(eq(launchpadRole.launchpadId, launchpadId));

  const [launchpadCountResult] = await db
    .select({
      count: sql<number>`cast(count(${launchpad.id}) as int)`,
    })
    .from(launchpad)
    .where(
      and(
        eq(launchpad.createdBy, row.launchpad.createdBy),
        isNull(launchpad.deletedAt),
      ),
    );

  return {
    id: row.launchpad.id,
    name: row.launchpad.name,
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
    description: row.launchpad.description,
    deadline: row.launchpad.deadline ? new Date(row.launchpad.deadline) : null,
    status: resolveLaunchpadStatus(row.launchpad.status),
    logoKey: row.launchpad.logoKey,
    coverKey: row.launchpad.coverKey,
    documentKeys: row.launchpad.documentKeys as string[],
    documentNames: row.launchpad.documentNames as string[],
    phoneNumber: row.launchpad.phoneNumber,
    email: row.launchpad.email,
    telegramUsername: row.launchpad.telegramUsername,
    totalView: row.launchpad.totalView ?? 0,
    createdBy: row.createdBy
      ? {
          id: row.createdBy.id,
          name: row.createdBy.name,
          avatarKey: row.createdByProfile?.avatarKey ?? null,
          launchpadCount: launchpadCountResult?.count ?? 0,
        }
      : {
          id: row.launchpad.createdBy,
          name: "Unknown",
          avatarKey: null,
          launchpadCount: 0,
        },
    createdAt: new Date(row.launchpad.createdAt),
    roles: roles.map((role) => ({
      id: role.id,
      title: role.title,
      description: role.description,
      capacity: role.capacity,
    })),
  };
}

export async function findLaunchpads(
  params: GetLaunchpadQueryListInput,
  viewerId?: string,
): Promise<{ launchpads: LaunchpadListItem[]; nextCursor: string | null }> {
  const whereClause = buildLaunchpadWhereClause(
    params.cursor,
    params.categoryId,
    params.cityId,
    params.search,
  );
  const orderByClause = buildLaunchpadOrderBy(params.sortBy);

  const baseQuery = buildLaunchpadBaseQuery()
    .where(whereClause)
    .orderBy(orderByClause);

  const rows = await baseQuery.limit(params.limit + 1);

  // Determine if there's a next page
  const hasNextPage = rows.length > params.limit;
  const launchpadRows = hasNextPage ? rows.slice(0, params.limit) : rows;

  // Get saved IDs for viewer
  const launchpadIds = launchpadRows.map((row) => row.launchpad.id);
  const savedIds = await getSavedLaunchpadIdsByLaunchpadIds(
    launchpadIds,
    viewerId,
  );

  // Generate next cursor if there are more results
  let nextCursor: string | null = null;
  if (hasNextPage && launchpadRows.length > 0) {
    const lastRow = launchpadRows[launchpadRows.length - 1];
    nextCursor = encodeLaunchpadPageCursor({
      sortBy: params.sortBy,
      createdAt: lastRow.launchpad.createdAt,
      id: lastRow.launchpad.id,
    });
  }

  const launchpads = launchpadRows.map((row) => ({
    id: row.launchpad.id,
    name: row.launchpad.name,
    description: row.launchpad.description,
    deadline: row.launchpad.deadline ? new Date(row.launchpad.deadline) : null,
    status: resolveLaunchpadStatus(row.launchpad.status),
    logoKey: row.launchpad.logoKey,
    coverKey: row.launchpad.coverKey,
    documentKeys: row.launchpad.documentKeys as string[],
    documentNames: row.launchpad.documentNames as string[],
    phoneNumber: row.launchpad.phoneNumber,
    email: row.launchpad.email,
    telegramUsername: row.launchpad.telegramUsername,
    totalView: row.launchpad.totalView ?? 0,
    createdBy: row.createdBy
      ? {
          id: row.createdBy.id,
          name: row.createdBy.name,
          avatarKey: row.createdByProfile?.avatarKey ?? null,
          launchpadCount: row.launchpadCount ?? 0,
        }
      : {
          id: row.launchpad.createdBy,
          name: "Unknown",
          avatarKey: null,
          launchpadCount: 0,
        },
    createdAt: new Date(row.launchpad.createdAt),
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
    totalRoles: row.totalRoles,
    isSaved: savedIds.has(row.launchpad.id),
  }));

  return {
    launchpads,
    nextCursor,
  };
}

async function getSavedLaunchpadIdsByLaunchpadIds(
  launchpadIds: string[],
  viewerId?: string,
): Promise<Set<string>> {
  const uniqueIds = [...new Set(launchpadIds)];
  if (!viewerId || uniqueIds.length === 0) {
    return new Set();
  }

  const rows = await db
    .select({ launchpadId: launchpadSave.launchpadId })
    .from(launchpadSave)
    .where(
      and(
        inArray(launchpadSave.launchpadId, uniqueIds),
        eq(launchpadSave.saverId, viewerId),
      ),
    );

  return new Set(rows.map((row) => row.launchpadId));
}
