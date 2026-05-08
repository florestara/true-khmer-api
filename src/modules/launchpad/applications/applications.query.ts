import { and, desc, eq } from "drizzle-orm";
import { db } from "../../../db";
import {
  launchpad,
  launchpadApplication,
  launchpadApplicationLog,
  launchpadApplicationStatusEnum,
  launchpadRole,
} from "../../../db/schema";

export type ApplicationStatus =
  (typeof launchpadApplicationStatusEnum.enumValues)[number];

export type LaunchpadApplicationLog =
  typeof launchpadApplicationLog.$inferSelect;

export type LaunchpadApplicationDetail =
  typeof launchpadApplication.$inferSelect & {
    logs: LaunchpadApplicationLog[];
  };

export type LaunchpadApplicationTarget = {
  launchpadId: string;
  launchpadName: string;
  roleId: string;
  roleTitle: string;
};

export async function findLaunchpadApplicationTarget(
  launchpadId: string,
  roleId: string,
): Promise<LaunchpadApplicationTarget | null> {
  const [row] = await db
    .select({
      launchpadId: launchpad.id,
      launchpadName: launchpad.name,
      roleId: launchpadRole.id,
      roleTitle: launchpadRole.title,
    })
    .from(launchpadRole)
    .innerJoin(launchpad, eq(launchpad.id, launchpadRole.launchpadId))
    .where(
      and(
        eq(launchpadRole.id, roleId),
        eq(launchpadRole.launchpadId, launchpadId),
      ),
    )
    .limit(1);

  return row ?? null;
}

export async function createApplicationLog(
  txOrDb: Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db,
  options: {
    applicationId: string;
    status: ApplicationStatus;
    createdBy: string;
  },
): Promise<LaunchpadApplicationLog> {
  const [log] = await txOrDb
    .insert(launchpadApplicationLog)
    .values({
      launchpadApplicationId: options.applicationId,
      status: options.status,
      createdBy: options.createdBy,
    })
    .returning();

  return log;
}

export async function createLaunchpadApplication(data: {
  launchpadId: string;
  launchpadRoleId: string;
  motivation: string;
  portfolio: string;
  documentKeys: string[];
  documentNames: string[];
  createdBy: string;
}): Promise<LaunchpadApplicationDetail> {
  return db.transaction(async (tx) => {
    const [application] = await tx
      .insert(launchpadApplication)
      .values({
        launchpadId: data.launchpadId,
        launchpadRoleId: data.launchpadRoleId,
        motivation: data.motivation,
        portfolio: data.portfolio,
        documentKeys: data.documentKeys,
        documentNames: data.documentNames,
        status: "SUBMITTED",
        createdBy: data.createdBy,
      })
      .returning();

    const log = await createApplicationLog(tx, {
      applicationId: application.id,
      status: "SUBMITTED",
      createdBy: data.createdBy,
    });

    return { ...application, logs: [log] };
  });
}

export async function findLaunchpadApplicationById(
  applicationId: string,
  launchpadId: string,
): Promise<LaunchpadApplicationDetail | null> {
  const [row] = await db
    .select()
    .from(launchpadApplication)
    .where(
      and(
        eq(launchpadApplication.id, applicationId),
        eq(launchpadApplication.launchpadId, launchpadId),
      ),
    )
    .limit(1);

  if (!row) return null;

  const logs = await db
    .select()
    .from(launchpadApplicationLog)
    .where(eq(launchpadApplicationLog.launchpadApplicationId, applicationId))
    .orderBy(desc(launchpadApplicationLog.createdAt));

  return { ...row, logs };
}

export async function findExistingApplication(
  launchpadRoleId: string,
  createdBy: string,
): Promise<typeof launchpadApplication.$inferSelect | null> {
  const [row] = await db
    .select()
    .from(launchpadApplication)
    .where(
      and(
        eq(launchpadApplication.launchpadRoleId, launchpadRoleId),
        eq(launchpadApplication.createdBy, createdBy),
      ),
    )
    .limit(1);

  return row ?? null;
}
