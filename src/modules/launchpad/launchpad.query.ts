import { sql, eq, and, ilike, inArray, isNull } from "drizzle-orm";
import { db } from "../../db";
import {
  LAUNCHPAD_ADVISORY_LOCK_NAMESPACE,
  LAUNCHPAD_CATEGORY_TOTAL_LAUNCHPAD_LOCK_KEY,
} from "./lib/constants";
import {
  CreateLaunchpadRequestInput,
  GetLaunchpadQueryListInput,
  UpdateLaunchpadRequestInput,
  encodeLaunchpadPageCursor,
} from "./schema/launchpad.request.schema";
import {
  city,
  launchpad,
  launchpadActionLog,
  launchpadApplication,
  launchpadCategory,
  launchpadRole,
  launchpadSave,
  user,
  userProfile,
  workspaceCandidateBlock,
} from "../../db/schema";

type launchpadInsert = typeof launchpad.$inferInsert;
type launchpadRoleInsert = typeof launchpadRole.$inferInsert;
type LaunchpadStatus = (typeof launchpad.$inferSelect)["status"];
type LaunchpadTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
const PUBLIC_PROFILE_LAUNCHPAD_STATUSES = [
  "LIVE",
  "IN_PROGRESS",
  "COMPLETED",
] as const;

export class LaunchpadRoleNotFoundError extends Error {
  constructor() {
    super("Launchpad role not found");
    this.name = "LaunchpadRoleNotFoundError";
  }
}

export class LaunchpadRoleRemovalBlockedError extends Error {
  constructor() {
    super("Launchpad role cannot be removed while it has applications");
    this.name = "LaunchpadRoleRemovalBlockedError";
  }
}

export class LaunchpadRoleCapacityError extends Error {
  constructor() {
    super("Role capacity cannot be lower than confirmed applications");
    this.name = "LaunchpadRoleCapacityError";
  }
}

export class LaunchpadPatchStatusError extends Error {
  constructor() {
    super("Launchpad can only be edited while it is live or draft");
    this.name = "LaunchpadPatchStatusError";
  }
}

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
  viewerBlocked: boolean;
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
  ownerId?: string,
  publicProfileOnly = false,
) {
  const conditions = [isNull(launchpad.deletedAt)];

  if (publicProfileOnly) {
    conditions.push(inArray(launchpad.status, PUBLIC_PROFILE_LAUNCHPAD_STATUSES));
  }

  if (ownerId) {
    conditions.push(eq(launchpad.createdBy, ownerId));
  }

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

export async function findActiveLaunchpadCategoryById(
  categoryId: string,
): Promise<{ id: string; name: string } | null> {
  const [category] = await db
    .select({
      id: launchpadCategory.id,
      name: launchpadCategory.name,
    })
    .from(launchpadCategory)
    .where(
      and(
        eq(launchpadCategory.id, categoryId),
        eq(launchpadCategory.status, "ACTIVE"),
      ),
    )
    .limit(1);

  return category ?? null;
}

export async function findLaunchpadCityById(
  cityId: string,
): Promise<{ id: string; name: string } | null> {
  const [cityData] = await db
    .select({
      id: city.id,
      name: city.name,
    })
    .from(city)
    .where(and(eq(city.id, cityId), eq(city.isActive, true)))
    .limit(1);

  return cityData ?? null;
}

export async function findLaunchpadEditTargetById(
  launchpadId: string,
): Promise<{ id: string; createdBy: string; status: LaunchpadStatus } | null> {
  const [row] = await db
    .select({
      id: launchpad.id,
      createdBy: launchpad.createdBy,
      status: launchpad.status,
    })
    .from(launchpad)
    .where(and(eq(launchpad.id, launchpadId), isNull(launchpad.deletedAt)))
    .limit(1);

  return row ?? null;
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

type LaunchpadPatchLogData = Record<string, unknown>;

type LaunchpadRoleLogData = {
  id: string;
  title: string;
  description: string | null;
  capacity: number;
};

function addLaunchpadPatchLogValue(
  fromData: LaunchpadPatchLogData,
  toData: LaunchpadPatchLogData,
  key: string,
  beforeValue: unknown,
  afterValue: unknown,
) {
  if (JSON.stringify(beforeValue) === JSON.stringify(afterValue)) {
    return;
  }

  fromData[key] = beforeValue;
  toData[key] = afterValue;
}

async function getLaunchpadRoleLogData(
  tx: LaunchpadTransaction,
  launchpadId: string,
): Promise<LaunchpadRoleLogData[]> {
  const roles = await tx
    .select({
      id: launchpadRole.id,
      title: launchpadRole.title,
      description: launchpadRole.description,
      capacity: launchpadRole.capacity,
    })
    .from(launchpadRole)
    .where(eq(launchpadRole.launchpadId, launchpadId));

  return roles.map((role) => ({
    id: role.id,
    title: role.title,
    description: role.description,
    capacity: role.capacity,
  }));
}

async function getApplicationCountsByRoleIds(
  tx: LaunchpadTransaction,
  roleIds: string[],
): Promise<Map<string, number>> {
  const uniqueRoleIds = [...new Set(roleIds)];
  if (uniqueRoleIds.length === 0) {
    return new Map();
  }

  const rows = await tx
    .select({
      roleId: launchpadApplication.launchpadRoleId,
      applicationCount: sql<number>`count(*)::int`.as("application_count"),
    })
    .from(launchpadApplication)
    .where(
      and(
        inArray(launchpadApplication.launchpadRoleId, uniqueRoleIds),
        sql`${launchpadApplication.status} <> 'WITHDRAWN'`,
      ),
    )
    .groupBy(launchpadApplication.launchpadRoleId);

  return new Map(
    rows.map((row) => [row.roleId, Number(row.applicationCount ?? 0)]),
  );
}

async function getConfirmedApplicationCountsByRoleIds(
  tx: LaunchpadTransaction,
  roleIds: string[],
): Promise<Map<string, number>> {
  const uniqueRoleIds = [...new Set(roleIds)];
  if (uniqueRoleIds.length === 0) {
    return new Map();
  }

  const rows = await tx
    .select({
      roleId: launchpadApplication.launchpadRoleId,
      confirmedCount: sql<number>`count(*)::int`.as("confirmed_count"),
    })
    .from(launchpadApplication)
    .where(
      and(
        inArray(launchpadApplication.launchpadRoleId, uniqueRoleIds),
        eq(launchpadApplication.status, "CONFIRMED"),
      ),
    )
    .groupBy(launchpadApplication.launchpadRoleId);

  return new Map(
    rows.map((row) => [row.roleId, Number(row.confirmedCount ?? 0)]),
  );
}

async function updateLaunchpadRoles(
  tx: LaunchpadTransaction,
  launchpadId: string,
  roles: NonNullable<UpdateLaunchpadRequestInput["role"]>,
  userId: string,
) {
  const existingRoles = await tx
    .select({
      id: launchpadRole.id,
      launchpadId: launchpadRole.launchpadId,
    })
    .from(launchpadRole)
    .where(eq(launchpadRole.launchpadId, launchpadId))
    .for("update");

  const existingRoleIds = new Set(existingRoles.map((role) => role.id));
  const incomingExistingRoleIds = roles
    .map((role) => role.id)
    .filter((roleId): roleId is string => Boolean(roleId));

  if (incomingExistingRoleIds.some((roleId) => !existingRoleIds.has(roleId))) {
    throw new LaunchpadRoleNotFoundError();
  }

  const removedRoleIds = existingRoles
    .map((role) => role.id)
    .filter((roleId) => !incomingExistingRoleIds.includes(roleId));

  const removedApplicationCounts = await getApplicationCountsByRoleIds(
    tx,
    removedRoleIds,
  );
  const confirmedApplicationCounts =
    await getConfirmedApplicationCountsByRoleIds(tx, incomingExistingRoleIds);

  if (
    removedRoleIds.some(
      (roleId) => (removedApplicationCounts.get(roleId) ?? 0) > 0,
    )
  ) {
    throw new LaunchpadRoleRemovalBlockedError();
  }

  for (const roleInput of roles) {
    if (!roleInput.id) {
      continue;
    }

    const confirmedCount = confirmedApplicationCounts.get(roleInput.id) ?? 0;
    if (roleInput.capacity < confirmedCount) {
      throw new LaunchpadRoleCapacityError();
    }
  }

  if (removedRoleIds.length > 0) {
    await tx
      .delete(launchpadRole)
      .where(inArray(launchpadRole.id, removedRoleIds));
  }

  for (const roleInput of roles) {
    if (roleInput.id) {
      await tx
        .update(launchpadRole)
        .set({
          title: roleInput.name,
          description: roleInput.description,
          capacity: roleInput.capacity,
          updatedBy: userId,
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(launchpadRole.id, roleInput.id),
            eq(launchpadRole.launchpadId, launchpadId),
          ),
        );
      continue;
    }

    await tx.insert(launchpadRole).values({
      launchpadId,
      title: roleInput.name,
      description: roleInput.description,
      capacity: roleInput.capacity,
      createdBy: userId,
    });
  }
}

export async function updateLaunchpad(
  launchpadId: string,
  ownerId: string,
  data: UpdateLaunchpadRequestInput,
): Promise<LaunchpadDetail | null> {
  const updated = await db.transaction(async (tx) => {
    const [existingLaunchpad] = await tx
      .select({
        id: launchpad.id,
        categoryId: launchpad.categoryId,
        cityId: launchpad.cityId,
        name: launchpad.name,
        description: launchpad.description,
        deadline: launchpad.deadline,
        logoKey: launchpad.logoKey,
        coverKey: launchpad.coverKey,
        documentKeys: launchpad.documentKeys,
        documentNames: launchpad.documentNames,
        phoneNumber: launchpad.phoneNumber,
        email: launchpad.email,
        telegramUsername: launchpad.telegramUsername,
        status: launchpad.status,
      })
      .from(launchpad)
      .where(
        and(
          eq(launchpad.id, launchpadId),
          eq(launchpad.createdBy, ownerId),
          isNull(launchpad.deletedAt),
        ),
      )
      .for("update")
      .limit(1);

    if (!existingLaunchpad) {
      return false;
    }

    if (
      existingLaunchpad.status !== "LIVE" &&
      existingLaunchpad.status !== "DRAFT"
    ) {
      throw new LaunchpadPatchStatusError();
    }

    const beforeRoles =
      data.role !== undefined
        ? await getLaunchpadRoleLogData(tx, launchpadId)
        : null;

    const launchpadUpdate: Partial<typeof launchpad.$inferInsert> = {};

    if (data.categoryId !== undefined) {
      launchpadUpdate.categoryId = data.categoryId;
    }
    if (data.cityId !== undefined) launchpadUpdate.cityId = data.cityId;
    if (data.name !== undefined) launchpadUpdate.name = data.name;
    if (data.description !== undefined) {
      launchpadUpdate.description = data.description;
    }
    if (data.deadline !== undefined) launchpadUpdate.deadline = data.deadline;
    if (data.logoKey !== undefined) launchpadUpdate.logoKey = data.logoKey;
    if (data.coverKey !== undefined) launchpadUpdate.coverKey = data.coverKey;
    if (data.materialDocumentKey !== undefined) {
      launchpadUpdate.documentKeys = data.materialDocumentKey;
    }
    if (data.materialDocumentName !== undefined) {
      launchpadUpdate.documentNames = data.materialDocumentName;
    }
    if (data.phoneNumber !== undefined) {
      launchpadUpdate.phoneNumber = data.phoneNumber;
    }
    if (data.email !== undefined) launchpadUpdate.email = data.email;
    if (data.telegramUsername !== undefined) {
      launchpadUpdate.telegramUsername = data.telegramUsername;
    }

    if (
      data.categoryId !== undefined &&
      data.categoryId !== existingLaunchpad.categoryId
    ) {
      await tx.execute(
        sql`select pg_advisory_xact_lock(${LAUNCHPAD_ADVISORY_LOCK_NAMESPACE}, ${LAUNCHPAD_CATEGORY_TOTAL_LAUNCHPAD_LOCK_KEY})`,
      );

      if (existingLaunchpad.categoryId) {
        await updateCategoryTotalLaunchpadCount(
          tx,
          existingLaunchpad.categoryId,
          -1,
        );
      }
      await updateCategoryTotalLaunchpadCount(tx, data.categoryId, 1);
    }

    if (Object.keys(launchpadUpdate).length > 0 || data.role !== undefined) {
      await tx
        .update(launchpad)
        .set({
          ...launchpadUpdate,
          updatedBy: ownerId,
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(launchpad.id, launchpadId),
            eq(launchpad.createdBy, ownerId),
            isNull(launchpad.deletedAt),
          ),
        );
    }

    if (data.role !== undefined) {
      await updateLaunchpadRoles(tx, launchpadId, data.role, ownerId);
    }

    const fromData: LaunchpadPatchLogData = {};
    const toData: LaunchpadPatchLogData = {};

    addLaunchpadPatchLogValue(
      fromData,
      toData,
      "categoryId",
      existingLaunchpad.categoryId,
      data.categoryId ?? existingLaunchpad.categoryId,
    );
    addLaunchpadPatchLogValue(
      fromData,
      toData,
      "cityId",
      existingLaunchpad.cityId,
      data.cityId ?? existingLaunchpad.cityId,
    );

    const patchableFields = [
      "name",
      "description",
      "deadline",
      "logoKey",
      "coverKey",
      "phoneNumber",
      "email",
      "telegramUsername",
    ] as const;

    for (const field of patchableFields) {
      if (data[field] === undefined) {
        continue;
      }

      addLaunchpadPatchLogValue(
        fromData,
        toData,
        field,
        existingLaunchpad[field],
        data[field],
      );
    }

    if (data.materialDocumentKey !== undefined) {
      addLaunchpadPatchLogValue(
        fromData,
        toData,
        "materialDocumentKey",
        existingLaunchpad.documentKeys,
        data.materialDocumentKey,
      );
    }

    if (data.materialDocumentName !== undefined) {
      addLaunchpadPatchLogValue(
        fromData,
        toData,
        "materialDocumentName",
        existingLaunchpad.documentNames,
        data.materialDocumentName,
      );
    }

    if (beforeRoles) {
      const afterRoles = await getLaunchpadRoleLogData(tx, launchpadId);
      addLaunchpadPatchLogValue(
        fromData,
        toData,
        "role",
        beforeRoles,
        afterRoles,
      );
    }

    if (Object.keys(toData).length > 0) {
      await tx.insert(launchpadActionLog).values({
        launchpadId,
        name: "Launchpad updated",
        description: `Updated ${Object.keys(toData).join(", ")}`,
        fromData,
        toData,
        status: existingLaunchpad.status,
        createdBy: ownerId,
      });
    }

    return true;
  });

  if (!updated) {
    return null;
  }

  return findLaunchpadById(launchpadId);
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
      viewerBlocked: false,
    };
  });
}

export async function findLaunchpadById(
  launchpadId: string,
  viewerId?: string,
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

  const viewerBlocked = viewerId
    ? (
        await db
          .select({ id: workspaceCandidateBlock.id })
          .from(workspaceCandidateBlock)
          .where(
            and(
              eq(workspaceCandidateBlock.sourceType, "PROJECT"),
              eq(workspaceCandidateBlock.postingId, launchpadId),
              eq(workspaceCandidateBlock.candidateId, viewerId),
              eq(workspaceCandidateBlock.status, "ACTIVE"),
            ),
          )
          .limit(1)
      ).length > 0
    : false;

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
    viewerBlocked,
  };
}

export async function findLaunchpads(
  params: GetLaunchpadQueryListInput,
  viewerId?: string,
  ownerId?: string,
  publicProfileOnly = false,
): Promise<{ launchpads: LaunchpadListItem[]; nextCursor: string | null }> {
  const whereClause = buildLaunchpadWhereClause(
    params.cursor,
    params.categoryId,
    params.cityId,
    params.search,
    ownerId,
    publicProfileOnly,
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

export async function findLaunchpadsPostedByUserId(
  userId: string,
  params: GetLaunchpadQueryListInput,
  viewerId?: string,
): Promise<{ launchpads: LaunchpadListItem[]; nextCursor: string | null }> {
  return findLaunchpads(params, viewerId, userId, true);
}

export async function countLaunchpadsPostedByUserId(
  userId: string,
): Promise<number> {
  const [result] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(launchpad)
    .where(
      buildLaunchpadWhereClause(
        undefined,
        undefined,
        undefined,
        undefined,
        userId,
        true,
      ),
    );

  return Number(result?.total ?? 0);
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
