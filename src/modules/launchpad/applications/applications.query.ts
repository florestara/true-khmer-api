import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../../../db";
import {
  launchpad,
  launchpadApplication,
  launchpadApplicationLog,
  launchpadApplicationStatusEnum,
  launchpadRole,
  workspaceCandidateBlock,
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
  createdBy: string;
  deadline: string | null;
  status: (typeof launchpad.$inferSelect)["status"];
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
      createdBy: launchpad.createdBy,
      deadline: launchpad.deadline,
      status: launchpad.status,
      roleId: launchpadRole.id,
      roleTitle: launchpadRole.title,
    })
    .from(launchpadRole)
    .innerJoin(launchpad, eq(launchpad.id, launchpadRole.launchpadId))
    .where(
      and(
        eq(launchpadRole.id, roleId),
        eq(launchpadRole.launchpadId, launchpadId),
        isNull(launchpad.deletedAt),
      ),
    )
    .limit(1);

  return row ?? null;
}

export async function findLaunchpadApplicationTargetsByRoleIds(
  launchpadId: string,
  roleIds: string[],
): Promise<LaunchpadApplicationTarget[]> {
  if (roleIds.length === 0) {
    return [];
  }

  return db
    .select({
      launchpadId: launchpad.id,
      launchpadName: launchpad.name,
      createdBy: launchpad.createdBy,
      deadline: launchpad.deadline,
      status: launchpad.status,
      roleId: launchpadRole.id,
      roleTitle: launchpadRole.title,
    })
    .from(launchpadRole)
    .innerJoin(launchpad, eq(launchpad.id, launchpadRole.launchpadId))
    .where(
      and(
        inArray(launchpadRole.id, roleIds),
        eq(launchpadRole.launchpadId, launchpadId),
        isNull(launchpad.deletedAt),
      ),
    );
}

export async function findLaunchpadTopPickedRoleId(
  launchpadId: string,
  createdBy: string,
): Promise<string | null> {
  const [row] = await db
    .select({ roleId: launchpadApplication.launchpadRoleId })
    .from(launchpadApplication)
    .where(
      and(
        eq(launchpadApplication.launchpadId, launchpadId),
        eq(launchpadApplication.createdBy, createdBy),
        eq(launchpadApplication.topPick, true),
        sql`${launchpadApplication.status} in ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'CONFIRMED', 'COMPLETED')`,
      ),
    )
    .limit(1);

  return row?.roleId ?? null;
}

export async function createApplicationLog(
  txOrDb: Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db,
  options: {
    applicationId: string;
    status: ApplicationStatus;
    declinedBy?: "POSTER" | "APPLICANT" | "SYSTEM" | null;
    createdBy: string;
  },
): Promise<LaunchpadApplicationLog> {
  const [log] = await txOrDb
    .insert(launchpadApplicationLog)
    .values({
      launchpadApplicationId: options.applicationId,
      status: options.status,
      declinedBy: options.declinedBy ?? null,
      createdBy: options.createdBy,
    })
    .returning();

  return log;
}

export async function createLaunchpadApplication(data: {
  launchpadId: string;
  launchpadRoleId: string;
  motivation: string;
  relevantExperience: string;
  portfolio?: string | null;
  documentKeys?: string[];
  documentNames?: string[];
  topPickRoleId?: string | null;
  createdBy: string;
}): Promise<LaunchpadApplicationDetail> {
  return db.transaction(async (tx) => {
    const [application] = await tx
      .insert(launchpadApplication)
      .values({
        launchpadId: data.launchpadId,
        launchpadRoleId: data.launchpadRoleId,
        motivation: data.motivation,
        relevantExperience: data.relevantExperience,
        portfolio: data.portfolio ?? null,
        topPick: data.topPickRoleId === data.launchpadRoleId,
        documentKeys: data.documentKeys ?? [],
        documentNames: data.documentNames ?? [],
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

export async function createLaunchpadApplicationsBatch(data: {
  launchpadId: string;
  roles: Array<{
    roleId: string;
    roleTitle: string;
  }>;
  motivation: string;
  relevantExperience: string;
  portfolio?: string | null;
  documentKeys?: string[];
  documentNames?: string[];
  topPickRoleId?: string | null;
  createdBy: string;
}): Promise<LaunchpadApplicationDetail[]> {
  return db.transaction(async (tx) => {
    const applications = await tx
      .insert(launchpadApplication)
      .values(
        data.roles.map((role) => ({
          launchpadId: data.launchpadId,
          launchpadRoleId: role.roleId,
          motivation: data.motivation,
          relevantExperience: data.relevantExperience,
          portfolio: data.portfolio ?? null,
          topPick: data.topPickRoleId === role.roleId,
          documentKeys: data.documentKeys ?? [],
          documentNames: data.documentNames ?? [],
          status: "SUBMITTED" as const,
          createdBy: data.createdBy,
        })),
      )
      .returning();

    const logs = await tx
      .insert(launchpadApplicationLog)
      .values(
        applications.map((application) => ({
          launchpadApplicationId: application.id,
          status: "SUBMITTED" as const,
          declinedBy: null,
          createdBy: data.createdBy,
        })),
      )
      .returning();

    const logsByApplicationId = new Map(
      logs.map((log) => [log.launchpadApplicationId, log]),
    );
    const applicationByRoleId = new Map(
      applications.map((application) => [application.launchpadRoleId, application]),
    );

    return data.roles
      .map((role) => applicationByRoleId.get(role.roleId))
      .filter((application) => application !== undefined)
      .map((application) => ({
        ...application,
        logs: logsByApplicationId.has(application.id)
          ? [logsByApplicationId.get(application.id)!]
          : [],
      }));
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
        sql`${launchpadApplication.status} <> 'WITHDRAWN'`,
      ),
    )
    .limit(1);

  return row ?? null;
}

export async function findExistingApplicationRoleIds(
  launchpadRoleIds: string[],
  createdBy: string,
): Promise<string[]> {
  if (launchpadRoleIds.length === 0) {
    return [];
  }

  const rows = await db
    .select({ roleId: launchpadApplication.launchpadRoleId })
    .from(launchpadApplication)
    .where(
      and(
        eq(launchpadApplication.createdBy, createdBy),
        inArray(launchpadApplication.launchpadRoleId, launchpadRoleIds),
        sql`${launchpadApplication.status} <> 'WITHDRAWN'`,
      ),
    );

  return rows.map((row) => row.roleId);
}

export async function hasLaunchpadApprovedOrConfirmedApplication(
  launchpadId: string,
  createdBy: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: launchpadApplication.id })
    .from(launchpadApplication)
    .where(
      and(
        eq(launchpadApplication.launchpadId, launchpadId),
        eq(launchpadApplication.createdBy, createdBy),
        sql`${launchpadApplication.status} in ('APPROVED', 'CONFIRMED')`,
      ),
    )
    .limit(1);

  return row !== undefined;
}

export async function hasLaunchpadApplicationBlock(
  launchpadId: string,
  createdBy: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: workspaceCandidateBlock.id })
    .from(workspaceCandidateBlock)
    .where(
      and(
        eq(workspaceCandidateBlock.sourceType, "PROJECT"),
        eq(workspaceCandidateBlock.postingId, launchpadId),
        eq(workspaceCandidateBlock.candidateId, createdBy),
        eq(workspaceCandidateBlock.status, "ACTIVE"),
      ),
    )
    .limit(1);

  return row !== undefined;
}
