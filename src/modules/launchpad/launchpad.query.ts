import { sql, eq } from "drizzle-orm";
import { db } from "../../db";
import {
  LAUNCHPAD_ADVISORY_LOCK_NAMESPACE,
  LAUNCHPAD_CATEGORY_TOTAL_ROLES_LOCK_KEY,
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
  user,
  userProfile,
  volunteerApplication,
} from "../../db/schema";

type launchpadInsert = typeof launchpad.$inferInsert;
type launchpadRoleInsert = typeof launchpadRole.$inferInsert;

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
  logoKey: string | null;
  coverKey: string | null;
  documentKeys: string[];
  phoneNumber: string | null;
  email: string | null;
  telegramUsername: string | null;
  createdBy: {
    id: string;
    name: string;
    avatarKey: string | null;
    volunteerCount: number;
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
  logoKey: string | null;
  coverKey: string | null;
  documentKeys: string[];
  phoneNumber: string | null;
  email: string | null;
  telegramUsername: string | null;
  createdBy: {
    id: string;
    name: string;
    avatarKey: string | null;
    volunteerCount: number;
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
};

function buildLaunchpadBaseQuery() {
  const volunteerCountSubquery = db
    .select({
      userId: volunteerApplication.applicantId,
      count: sql<number>`cast(count(${volunteerApplication.id}) as int)`,
    })
    .from(volunteerApplication)
    .where(eq(volunteerApplication.status, "ACCEPTED"))
    .groupBy(volunteerApplication.applicantId)
    .as("volunteer_count");

  return db
    .select({
      launchpad: launchpad,
      category: launchpadCategory,
      city: city,
      createdBy: user,
      createdByProfile: userProfile,
      volunteerCount: sql<number>`coalesce(${volunteerCountSubquery.count}, 0)`,
      totalRoles: sql<number>`cast(count(${launchpadRole.id}) as int)`,
    })
    .from(launchpad)
    .leftJoin(launchpadCategory, eq(launchpad.categoryId, launchpadCategory.id))
    .leftJoin(city, eq(launchpad.cityId, city.id))
    .leftJoin(user, eq(launchpad.createdBy, user.id))
    .leftJoin(userProfile, eq(user.id, userProfile.userId))
    .leftJoin(volunteerCountSubquery, eq(user.id, volunteerCountSubquery.userId))
    .leftJoin(launchpadRole, eq(launchpad.id, launchpadRole.launchpadId))
    .groupBy(launchpad.id, launchpadCategory.id, city.id, user.id, userProfile.id, volunteerCountSubquery.count);
}

function buildLaunchpadWhereClause(
  cursor: GetLaunchpadQueryListInput["cursor"],
) {
  if (!cursor) {
    return undefined;
  }

  if (cursor.sortBy === "newest") {
    return sql`${launchpad.createdAt} < ${new Date(cursor.createdAt).toISOString()}::timestamptz OR (${launchpad.createdAt} = ${new Date(cursor.createdAt).toISOString()}::timestamptz AND ${launchpad.id} < ${cursor.id})`;
  } else if (cursor.sortBy === "oldest") {
    return sql`${launchpad.createdAt} > ${new Date(cursor.createdAt).toISOString()}::timestamptz OR (${launchpad.createdAt} = ${new Date(cursor.createdAt).toISOString()}::timestamptz AND ${launchpad.id} > ${cursor.id})`;
  }

  return undefined;
}

function buildLaunchpadOrderBy(sortBy: GetLaunchpadQueryListInput["sortBy"]) {
  if (sortBy === "newest") {
    return sql`${launchpad.createdAt} DESC, ${launchpad.id} DESC`;
  } else {
    return sql`${launchpad.createdAt} ASC, ${launchpad.id} ASC`;
  }
}

async function updateCategoryTotalRolesCount(
  txOrDb: Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db,
  categoryId: string,
  roleCount: number,
): Promise<void> {
  await txOrDb
    .update(launchpadCategory)
    .set({
      totalRoles: sql`${launchpadCategory.totalRoles} + ${roleCount}`,
    })
    .where(eq(launchpadCategory.id, categoryId));
}

export async function createLaunchpad(
  data: CreateLaunchpadRequestInput,
  userId: string,
): Promise<LaunchpadDetail> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(${LAUNCHPAD_ADVISORY_LOCK_NAMESPACE}, ${LAUNCHPAD_CATEGORY_TOTAL_ROLES_LOCK_KEY})`,
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

    await updateCategoryTotalRolesCount(tx, data.categoryId, data.role.length);

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

    const [volunteerCountResult] = await tx
      .select({
        count: sql<number>`cast(count(${volunteerApplication.id}) as int)`,
      })
      .from(volunteerApplication)
      .where(
        sql`${volunteerApplication.applicantId} = ${userId} AND ${volunteerApplication.status} = 'ACCEPTED'`,
      );

    return {
      id: created.id,
      name: created.name,
      description: created.description,
      deadline: created.deadline ? new Date(created.deadline) : null,
      logoKey: created.logoKey,
      coverKey: created.coverKey,
      documentKeys: created.documentKeys as string[],
      phoneNumber: created.phoneNumber,
      email: created.email,
      telegramUsername: created.telegramUsername,
      createdBy: createdByUser
        ? {
            id: createdByUser.user.id,
            name: createdByUser.user.name,
            avatarKey: createdByUser.profile?.avatarKey ?? null,
            volunteerCount: volunteerCountResult?.count ?? 0,
          }
        : {
            id: userId,
            name: "Unknown",
            avatarKey: null,
            volunteerCount: 0,
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
    .where(eq(launchpad.id, launchpadId))
    .limit(1);

  if (!row) {
    return null;
  }

  const roles = await db
    .select()
    .from(launchpadRole)
    .where(eq(launchpadRole.launchpadId, launchpadId));

  const [volunteerCountResult] = await db
    .select({
      count: sql<number>`cast(count(${volunteerApplication.id}) as int)`,
    })
    .from(volunteerApplication)
    .where(
      sql`${volunteerApplication.applicantId} = ${row.launchpad.createdBy} AND ${volunteerApplication.status} = 'ACCEPTED'`,
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
    logoKey: row.launchpad.logoKey,
    coverKey: row.launchpad.coverKey,
    documentKeys: row.launchpad.documentKeys as string[],
    phoneNumber: row.launchpad.phoneNumber,
    email: row.launchpad.email,
    telegramUsername: row.launchpad.telegramUsername,
    createdBy: row.createdBy
      ? {
          id: row.createdBy.id,
          name: row.createdBy.name,
          avatarKey: row.createdByProfile?.avatarKey ?? null,
          volunteerCount: volunteerCountResult?.count ?? 0,
        }
      : {
          id: row.launchpad.createdBy,
          name: "Unknown",
          avatarKey: null,
          volunteerCount: 0,
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
): Promise<{ launchpads: LaunchpadListItem[]; nextCursor: string | null }> {
  const whereClause = buildLaunchpadWhereClause(params.cursor);
  const orderByClause = buildLaunchpadOrderBy(params.sortBy);

  const baseQuery = buildLaunchpadBaseQuery()
    .where(whereClause)
    .orderBy(orderByClause);

  const rows = await baseQuery.limit(params.limit + 1);

  // Determine if there's a next page
  const hasNextPage = rows.length > params.limit;
  const launchpadRows = hasNextPage ? rows.slice(0, params.limit) : rows;

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
    logoKey: row.launchpad.logoKey,
    coverKey: row.launchpad.coverKey,
    documentKeys: row.launchpad.documentKeys as string[],
    phoneNumber: row.launchpad.phoneNumber,
    email: row.launchpad.email,
    telegramUsername: row.launchpad.telegramUsername,
    createdBy: row.createdBy
      ? {
          id: row.createdBy.id,
          name: row.createdBy.name,
          avatarKey: row.createdByProfile?.avatarKey ?? null,
          volunteerCount: row.volunteerCount ?? 0,
        }
      : {
          id: row.launchpad.createdBy,
          name: "Unknown",
          avatarKey: null,
          volunteerCount: 0,
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
  }));

  return {
    launchpads,
    nextCursor,
  };
}
