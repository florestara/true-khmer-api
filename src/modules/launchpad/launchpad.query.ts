import { sql, eq } from "drizzle-orm";
import { db } from "../../db";
import {
  LAUNCHPAD_ADVISORY_LOCK_NAMESPACE,
  LAUNCHPAD_CATEGORY_TOTAL_ROLES_LOCK_KEY,
} from "./lib/constants";
import { CreateLaunchpadRequestInput } from "./schema/launchpad.request.schema";
import { launchpad, launchpadCategory, launchpadRole } from "../../db/schema";

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
  categoryId: string;
  cityId: string;
  description: string | null;
  deadline: Date | null;
  logoKey: string | null;
  coverKey: string | null;
  documentKeys: string[];
  phoneNumber: string | null;
  email: string | null;
  telegramUsername: string | null;
  createdBy: string;
  createdAt: Date;
  roles: LaunchpadRole[];
};

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

    if (!created.categoryId || !created.cityId) {
      throw new Error("Launchpad must have valid categoryId and cityId");
    }

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

    return {
      id: created.id,
      name: created.name,
      categoryId: created.categoryId,
      cityId: created.cityId,
      description: created.description,
      deadline: created.deadline ? new Date(created.deadline) : null,
      logoKey: created.logoKey,
      coverKey: created.coverKey,
      documentKeys: created.documentKeys as string[],
      phoneNumber: created.phoneNumber,
      email: created.email,
      telegramUsername: created.telegramUsername,
      createdBy: created.createdBy,
      createdAt: new Date(created.createdAt),
      roles: insertedRoles.map((role) => ({
        id: role.id,
        title: role.title,
        description: role.description,
        capacity: role.capacity,
      })),
    };
  });
}
