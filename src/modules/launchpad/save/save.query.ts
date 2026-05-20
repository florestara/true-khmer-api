import { and, desc, eq, inArray, lt, or, sql, aliasedTable } from "drizzle-orm";
import { db } from "../../../db";
import {
  city,
  launchpad,
  launchpadCategory,
  launchpadRole,
  launchpadSave,
  user,
  userProfile,
} from "../../../db/schema";
import type { GetSavedLaunchpadsQuery } from "./schema/save.request.schema";
import {
  encodeSavedLaunchpadsPageCursor,
  type SavedLaunchpadsPageCursor,
} from "./schema/save.request.schema";

const launchpadSaveList = aliasedTable(launchpadSave, "launchpad_save_list");
type LaunchpadStatus = (typeof launchpad.$inferSelect)["status"];

export type SavedLaunchpadListResult = {
  launchpads: SavedLaunchpadListItem[];
  pagination: {
    nextCursor: string | null;
  };
};

export type SavedLaunchpadListItem = {
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
  isSaved: true;
  savedAt: Date;
};

type LaunchpadSaveInsert = typeof launchpadSave.$inferInsert;

function resolveLaunchpadStatus(status: LaunchpadStatus): LaunchpadStatus {
  return status;
}

function buildSavedLaunchpadsCursorFilter(
  cursor: SavedLaunchpadsPageCursor | undefined,
) {
  if (!cursor) return undefined;
  return or(
    lt(launchpadSaveList.createdAt, cursor.savedAt),
    and(
      eq(launchpadSaveList.createdAt, cursor.savedAt),
      lt(launchpad.id, cursor.launchpadId),
    ),
  );
}

export async function getSavedLaunchpads(
  userId: string,
  { limit, cursor }: GetSavedLaunchpadsQuery,
): Promise<SavedLaunchpadListResult> {
  const cursorFilter = buildSavedLaunchpadsCursorFilter(cursor);

  const filters: Parameters<typeof and>[0][] = [
    eq(launchpadSaveList.saverId, userId),
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
    .groupBy(launchpad.createdBy)
    .as("launchpad_count");

  const rowsQuery = db
    .select({
      launchpad: launchpad,
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
      savedAt: launchpadSaveList.createdAt,
    })
    .from(launchpadSaveList)
    .innerJoin(launchpad, eq(launchpad.id, launchpadSaveList.launchpadId))
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
      launchpadSaveList.createdAt,
    )
    .orderBy(desc(launchpadSaveList.createdAt), desc(launchpad.id))
    .limit(limit + 1);

  const rows = await rowsQuery;

  let nextCursor: string | null = null;
  if (rows.length > limit) {
    const lastRow = rows[limit - 1];
    nextCursor = encodeSavedLaunchpadsPageCursor({
      savedAt: lastRow.savedAt,
      launchpadId: lastRow.launchpad.id,
    });
    rows.pop();
  }

  const launchpads: SavedLaunchpadListItem[] = rows.map((row) => ({
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
    isSaved: true as const,
    savedAt: new Date(row.savedAt),
  }));

  return {
    launchpads,
    pagination: {
      nextCursor,
    },
  };
}

export async function saveLaunchpadForUser(
  launchpadId: string,
  userId: string,
): Promise<{ launchpad: SavedLaunchpadListItem; created: boolean } | null> {
  const [existing] = await db
    .select()
    .from(launchpad)
    .where(eq(launchpad.id, launchpadId))
    .limit(1);

  if (!existing) {
    return null;
  }

  const saveInsertData: LaunchpadSaveInsert = {
    launchpadId,
    saverId: userId,
  };

  const insertedSaves = await db
    .insert(launchpadSave)
    .values(saveInsertData)
    .onConflictDoNothing({
      target: [launchpadSave.launchpadId, launchpadSave.saverId],
    })
    .returning({ savedAt: launchpadSave.createdAt });

  if (insertedSaves.length === 0) {
    const [existingSave] = await db
      .select({ savedAt: launchpadSave.createdAt })
      .from(launchpadSave)
      .where(
        and(
          eq(launchpadSave.launchpadId, launchpadId),
          eq(launchpadSave.saverId, userId),
        ),
      )
      .limit(1);

    if (!existingSave) {
      return null;
    }

    const [category] = await db
      .select()
      .from(launchpadCategory)
      .where(eq(launchpadCategory.id, existing.categoryId ?? ""))
      .limit(1);

    const [cityRow] = await db
      .select()
      .from(city)
      .where(eq(city.id, existing.cityId ?? ""))
      .limit(1);

    const [createdByUser] = await db
      .select({
        user: user,
        profile: userProfile,
      })
      .from(user)
      .leftJoin(userProfile, eq(user.id, userProfile.userId))
      .where(eq(user.id, existing.createdBy))
      .limit(1);

    const [launchpadCountResult] = await db
      .select({
        count: sql<number>`cast(count(${launchpad.id}) as int)`,
      })
      .from(launchpad)
      .where(eq(launchpad.createdBy, existing.createdBy));

    const [roleCount] = await db
      .select({
        count: sql<number>`cast(count(${launchpadRole.id}) as int)`,
      })
      .from(launchpadRole)
      .where(eq(launchpadRole.launchpadId, launchpadId));

    return {
      launchpad: {
        id: existing.id,
        name: existing.name,
        description: existing.description,
        deadline: existing.deadline ? new Date(existing.deadline) : null,
        status: resolveLaunchpadStatus(existing.status),
        logoKey: existing.logoKey,
        coverKey: existing.coverKey,
        documentKeys: existing.documentKeys as string[],
        documentNames: existing.documentNames as string[],
        phoneNumber: existing.phoneNumber,
        email: existing.email,
        telegramUsername: existing.telegramUsername,
        totalView: existing.totalView ?? 0,
        createdBy: createdByUser
          ? {
              id: createdByUser.user.id,
              name: createdByUser.user.name,
              avatarKey: createdByUser.profile?.avatarKey ?? null,
              launchpadCount: launchpadCountResult?.count ?? 0,
            }
          : {
              id: existing.createdBy,
              name: "Unknown",
              avatarKey: null,
              launchpadCount: 0,
            },
        createdAt: new Date(existing.createdAt),
        category: category
          ? {
              id: category.id,
              name: category.name,
            }
          : undefined,
        city: cityRow
          ? {
              id: cityRow.id,
              name: cityRow.name,
            }
          : undefined,
        totalRoles: roleCount?.count ?? 0,
        isSaved: true as const,
        savedAt: new Date(existingSave.savedAt),
      },
      created: false,
    };
  }

  const [category] = await db
    .select()
    .from(launchpadCategory)
    .where(eq(launchpadCategory.id, existing.categoryId ?? ""))
    .limit(1);

  const [cityRow] = await db
    .select()
    .from(city)
    .where(eq(city.id, existing.cityId ?? ""))
    .limit(1);

  const [createdByUser] = await db
    .select({
      user: user,
      profile: userProfile,
    })
    .from(user)
    .leftJoin(userProfile, eq(user.id, userProfile.userId))
    .where(eq(user.id, existing.createdBy))
    .limit(1);

  const [launchpadCountResult] = await db
    .select({
      count: sql<number>`cast(count(${launchpad.id}) as int)`,
    })
    .from(launchpad)
    .where(eq(launchpad.createdBy, existing.createdBy));

  const [roleCount] = await db
    .select({
      count: sql<number>`cast(count(${launchpadRole.id}) as int)`,
    })
    .from(launchpadRole)
    .where(eq(launchpadRole.launchpadId, launchpadId));

  return {
    launchpad: {
      id: existing.id,
      name: existing.name,
      description: existing.description,
      deadline: existing.deadline ? new Date(existing.deadline) : null,
      status: resolveLaunchpadStatus(existing.status),
      logoKey: existing.logoKey,
      coverKey: existing.coverKey,
      documentKeys: existing.documentKeys as string[],
      documentNames: existing.documentNames as string[],
      phoneNumber: existing.phoneNumber,
      email: existing.email,
      telegramUsername: existing.telegramUsername,
      totalView: existing.totalView ?? 0,
      createdBy: createdByUser
        ? {
            id: createdByUser.user.id,
            name: createdByUser.user.name,
            avatarKey: createdByUser.profile?.avatarKey ?? null,
            launchpadCount: launchpadCountResult?.count ?? 0,
          }
        : {
            id: existing.createdBy,
            name: "Unknown",
            avatarKey: null,
            launchpadCount: 0,
          },
      createdAt: new Date(existing.createdAt),
      category: category
        ? {
            id: category.id,
            name: category.name,
          }
        : undefined,
      city: cityRow
        ? {
            id: cityRow.id,
            name: cityRow.name,
          }
        : undefined,
      totalRoles: roleCount?.count ?? 0,
      isSaved: true as const,
      savedAt: new Date(insertedSaves[0].savedAt),
    },
    created: true,
  };
}

export async function unsaveLaunchpadForUser(
  launchpadId: string,
  userId: string,
): Promise<boolean> {
  const [deletedSave] = await db
    .delete(launchpadSave)
    .where(
      and(
        eq(launchpadSave.launchpadId, launchpadId),
        eq(launchpadSave.saverId, userId),
      ),
    )
    .returning({ launchpadId: launchpadSave.launchpadId });

  return Boolean(deletedSave);
}

export async function getSavedLaunchpadIdsByLaunchpadIds(
  launchpadIds: string[],
  viewerId?: string,
): Promise<Set<string>> {
  const uniqueLaunchpadIds = [...new Set(launchpadIds)];
  if (!viewerId || uniqueLaunchpadIds.length === 0) {
    return new Set();
  }

  const rows = await db
    .select({
      launchpadId: launchpadSave.launchpadId,
    })
    .from(launchpadSave)
    .where(
      and(
        inArray(launchpadSave.launchpadId, uniqueLaunchpadIds),
        eq(launchpadSave.saverId, viewerId),
      ),
    );

  return new Set(rows.map((row) => row.launchpadId));
}
