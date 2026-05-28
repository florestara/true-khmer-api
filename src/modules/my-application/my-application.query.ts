import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  city,
  launchpad,
  launchpadApplication,
  launchpadApplicationLog,
  launchpadCategory,
  launchpadRole,
  user,
  userProfile,
  volunteerApplication,
  volunteerApplicationLog,
  volunteerCategory,
  volunteerOpportunity,
  volunteerRole,
  volunteerRoleRequirement,
} from "../../db/schema";
import type {
  ChangeMyApplicationArchiveParam,
  ChangeMyApplicationStatusParam,
} from "./schema/my-application.request.schema";
import { findVolunteerApplicationsByApplicantId } from "../volunteer/post-volunteer/post-volunteer.query";

export type MySpaceVolunteerApplication =
  Awaited<ReturnType<typeof findVolunteerApplicationsByApplicantId>>[number];

export type MySpaceProjectApplication = Awaited<
  ReturnType<typeof findProjectApplicationsByApplicantId>
>[number];

export async function findMyVolunteerApplications(userId: string) {
  return findVolunteerApplicationsByApplicantId(userId);
}

export async function findProjectApplicationsByApplicantId(applicantId: string) {
  return db
    .select({
      id: launchpadApplication.id,
      roleId: launchpadRole.id,
      title: launchpadRole.title,
      imageKey: launchpad.coverKey,
      appliedAt: launchpadApplication.createdAt,
      deadline: launchpad.deadline,
      status: launchpadApplication.status,
      archived: launchpadApplication.archived,
      opportunity: {
        id: launchpad.id,
        title: launchpad.name,
      },
      category: {
        id: launchpadCategory.id,
        name: launchpadCategory.name,
      },
      location: {
        id: city.id,
        name: city.name,
      },
    })
    .from(launchpadApplication)
    .innerJoin(
      launchpadRole,
      eq(launchpadRole.id, launchpadApplication.launchpadRoleId),
    )
    .innerJoin(launchpad, eq(launchpad.id, launchpadApplication.launchpadId))
    .leftJoin(launchpadCategory, eq(launchpadCategory.id, launchpad.categoryId))
    .leftJoin(city, eq(city.id, launchpad.cityId))
    .where(eq(launchpadApplication.createdBy, applicantId))
    .orderBy(desc(launchpadApplication.createdAt));
}

export async function findMyProjectApplications(userId: string) {
  return findProjectApplicationsByApplicantId(userId);
}

function buildApplicationTimeline(
  logs: Array<{
    status:
      | "SUBMITTED"
      | "UNDER_REVIEW"
      | "APPROVED"
      | "DECLINED"
      | "CONFIRMED"
      | "COMPLETED"
      | string;
    createdAt: string;
    declinedBy: "POSTER" | "APPLICANT" | "SYSTEM" | null;
  }>,
) {
  return logs.reduce(
    (timeline, log) => {
      if (log.status === "SUBMITTED") {
        timeline.submitted ??= log.createdAt;
      } else if (log.status === "UNDER_REVIEW") {
        timeline.underReview ??= log.createdAt;
      } else if (log.status === "APPROVED") {
        timeline.approved ??= log.createdAt;
      } else if (log.status === "DECLINED") {
        if (!timeline.declined.at) {
          timeline.declined = {
            at: log.createdAt,
            by: log.declinedBy,
          };
        }
      } else if (log.status === "CONFIRMED") {
        timeline.confirmed ??= log.createdAt;
      } else if (log.status === "COMPLETED") {
        timeline.completed ??= log.createdAt;
      }

      return timeline;
    },
    {
      submitted: null,
      underReview: null,
      approved: null,
      declined: {
        at: null,
        by: null,
      },
      confirmed: null,
      completed: null,
    } as {
      submitted: string | null;
      underReview: string | null;
      approved: string | null;
      declined: {
        at: string | null;
        by: "POSTER" | "APPLICANT" | "SYSTEM" | null;
      };
      confirmed: string | null;
      completed: string | null;
    },
  );
}

function normalizeNullableReference(
  reference: { id: string | null; name: string | null } | null,
) {
  if (!reference?.id || !reference.name) {
    return null;
  }

  return {
    id: reference.id,
    name: reference.name,
  };
}

function resolveApplicationGroupStatus(statuses: string[]) {
  if (statuses.some((status) => status === "COMPLETED")) {
    return "COMPLETED";
  }

  if (statuses.some((status) => status === "CONFIRMED")) {
    return "CONFIRMED";
  }

  if (statuses.some((status) => status === "APPROVED")) {
    return "APPROVED";
  }

  if (statuses.some((status) => status === "UNDER_REVIEW")) {
    return "UNDER_REVIEW";
  }

  if (statuses.some((status) => status === "SUBMITTED")) {
    return "SUBMITTED";
  }

  if (statuses.every((status) => status === "DECLINED")) {
    return "DECLINED";
  }

  if (statuses.every((status) => status === "WITHDRAWN")) {
    return "WITHDRAWN";
  }

  return "DECLINED";
}

function buildRoleActions(status: string) {
  return {
    canConfirm: status === "APPROVED",
    canDecline: status === "APPROVED",
    canWithdraw: status === "SUBMITTED" || status === "UNDER_REVIEW",
  };
}

export async function findMyVolunteerApplicationDetail(
  applicantId: string,
  postingId: string,
) {
  const postedCounts = db
    .select({
      userId: volunteerOpportunity.createdBy,
      count: sql<number>`count(*)::int`.as("count"),
    })
    .from(volunteerOpportunity)
    .groupBy(volunteerOpportunity.createdBy)
    .as("volunteer_posted_counts");

  const rows = await db
    .select({
      application: volunteerApplication,
      opportunity: volunteerOpportunity,
      role: volunteerRole,
      category: {
        id: volunteerCategory.id,
        name: volunteerCategory.name,
      },
      location: {
        id: city.id,
        name: city.name,
      },
      owner: {
        id: user.id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        telegramUsername: user.telegramUsername,
        avatarUrl: userProfile.avatarUrl,
        avatarKey: userProfile.avatarKey,
      },
      postedCount: sql<number>`coalesce(${postedCounts.count}, 0)::int`,
    })
    .from(volunteerApplication)
    .innerJoin(volunteerRole, eq(volunteerRole.id, volunteerApplication.roleId))
    .innerJoin(
      volunteerOpportunity,
      eq(volunteerOpportunity.id, volunteerApplication.opportunityId),
    )
    .innerJoin(
      volunteerCategory,
      eq(volunteerCategory.id, volunteerOpportunity.categoryId),
    )
    .innerJoin(city, eq(city.id, volunteerOpportunity.cityId))
    .innerJoin(user, eq(user.id, volunteerOpportunity.createdBy))
    .leftJoin(userProfile, eq(userProfile.userId, user.id))
    .leftJoin(postedCounts, eq(postedCounts.userId, user.id))
    .where(
      and(
        eq(volunteerApplication.opportunityId, postingId),
        eq(volunteerApplication.applicantId, applicantId),
      ),
    )
    .orderBy(desc(volunteerApplication.createdAt));

  if (rows.length === 0) {
    return null;
  }

  const firstRow = rows[0]!;
  const applicationIds = rows.map((row) => row.application.id);
  const roleIds = rows.map((row) => row.role.id);
  const [requirements, logs] = await Promise.all([
    db
      .select({
        roleId: volunteerRoleRequirement.roleId,
        text: volunteerRoleRequirement.requirementText,
      })
      .from(volunteerRoleRequirement)
      .where(inArray(volunteerRoleRequirement.roleId, roleIds))
      .orderBy(asc(volunteerRoleRequirement.displayOrder)),
    db
      .select({
        applicationId: volunteerApplicationLog.volunteerApplicationId,
        status: volunteerApplicationLog.status,
        createdAt: volunteerApplicationLog.createdAt,
        declinedBy: volunteerApplicationLog.declinedBy,
      })
      .from(volunteerApplicationLog)
      .where(inArray(volunteerApplicationLog.volunteerApplicationId, applicationIds))
      .orderBy(asc(volunteerApplicationLog.createdAt)),
  ]);
  const requirementsByRoleId = new Map<string, string[]>();
  for (const requirement of requirements) {
    const current = requirementsByRoleId.get(requirement.roleId) ?? [];
    current.push(requirement.text);
    requirementsByRoleId.set(requirement.roleId, current);
  }
  const logsByApplicationId = new Map<string, typeof logs>();
  for (const log of logs) {
    const current = logsByApplicationId.get(log.applicationId) ?? [];
    current.push(log);
    logsByApplicationId.set(log.applicationId, current);
  }
  const roles = rows
    .map((row) => ({
      applicationId: row.application.id,
      roleId: row.role.id,
      title: row.role.title,
      description: null,
      responsibilities: row.role.responsibilities as string[],
      requirements: requirementsByRoleId.get(row.role.id) ?? [],
      status: row.application.status,
      appliedAt: row.application.createdAt,
      archived: row.application.archived,
      actions: buildRoleActions(row.application.status),
      timeline: buildApplicationTimeline(
        logsByApplicationId.get(row.application.id) ?? [],
      ),
    }))
    .sort(
      (left, right) =>
        Date.parse(right.appliedAt) - Date.parse(left.appliedAt),
    );
  const statuses = roles.map((role) => role.status);
  const approvedRole =
    roles.find((role) => role.status === "APPROVED") ?? null;

  return {
    id: firstRow.opportunity.id,
    sourceType: "VOLUNTEER" as const,
    title: firstRow.opportunity.title,
    imageKey: firstRow.opportunity.coverImageKey,
    status: resolveApplicationGroupStatus(statuses),
    appliedAt: roles[0]?.appliedAt ?? firstRow.application.createdAt,
    deadline: firstRow.opportunity.applicationDeadline,
    archived: roles.every((role) => role.archived),
    needAttention: approvedRole !== null,
    totalRoleApplied: roles.length,
    canArchive: canArchiveApplicationGroup(statuses),
    opportunity: {
      id: firstRow.opportunity.id,
      title: firstRow.opportunity.title,
      overview: firstRow.opportunity.overview,
      category: firstRow.category,
      location: firstRow.location,
      startDate: firstRow.opportunity.startDate,
      endDate: firstRow.opportunity.endDate,
      commitmentLabel: firstRow.opportunity.commitmentLabel,
      commitmentDescription: firstRow.opportunity.commitmentDescription,
      filled: firstRow.opportunity.filled,
      impactRewardPoints: null,
    },
    owner: {
      id: firstRow.owner.id,
      name: firstRow.owner.name,
      avatarUrl: firstRow.owner.avatarUrl,
      avatarKey: firstRow.owner.avatarKey,
      postedCount: Number(firstRow.postedCount),
      contact: {
        email: firstRow.owner.email,
        phoneNumber: firstRow.owner.phoneNumber,
        telegramUsername: firstRow.owner.telegramUsername,
      },
    },
    roles,
    approvedRole: approvedRole
      ? {
          applicationId: approvedRole.applicationId,
          roleId: approvedRole.roleId,
          title: approvedRole.title,
          status: approvedRole.status,
          appliedAt: approvedRole.appliedAt,
        }
      : null,
  };
}

export async function findMyProjectApplicationDetail(
  applicantId: string,
  postingId: string,
) {
  const postedCounts = db
    .select({
      userId: launchpad.createdBy,
      count: sql<number>`count(*)::int`.as("count"),
    })
    .from(launchpad)
    .groupBy(launchpad.createdBy)
    .as("launchpad_posted_counts");

  const rows = await db
    .select({
      application: launchpadApplication,
      opportunity: launchpad,
      role: launchpadRole,
      category: {
        id: launchpadCategory.id,
        name: launchpadCategory.name,
      },
      location: {
        id: city.id,
        name: city.name,
      },
      owner: {
        id: user.id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        telegramUsername: user.telegramUsername,
        avatarUrl: userProfile.avatarUrl,
        avatarKey: userProfile.avatarKey,
      },
      postedCount: sql<number>`coalesce(${postedCounts.count}, 0)::int`,
    })
    .from(launchpadApplication)
    .innerJoin(
      launchpadRole,
      eq(launchpadRole.id, launchpadApplication.launchpadRoleId),
    )
    .innerJoin(launchpad, eq(launchpad.id, launchpadApplication.launchpadId))
    .leftJoin(launchpadCategory, eq(launchpadCategory.id, launchpad.categoryId))
    .leftJoin(city, eq(city.id, launchpad.cityId))
    .innerJoin(user, eq(user.id, launchpad.createdBy))
    .leftJoin(userProfile, eq(userProfile.userId, user.id))
    .leftJoin(postedCounts, eq(postedCounts.userId, user.id))
    .where(
      and(
        eq(launchpadApplication.launchpadId, postingId),
        eq(launchpadApplication.createdBy, applicantId),
      ),
    )
    .orderBy(desc(launchpadApplication.createdAt));

  if (rows.length === 0) {
    return null;
  }

  const firstRow = rows[0]!;
  const applicationIds = rows.map((row) => row.application.id);
  const logs = await db
    .select({
      applicationId: launchpadApplicationLog.launchpadApplicationId,
      status: launchpadApplicationLog.status,
      createdAt: launchpadApplicationLog.createdAt,
      declinedBy: launchpadApplicationLog.declinedBy,
    })
    .from(launchpadApplicationLog)
    .where(inArray(launchpadApplicationLog.launchpadApplicationId, applicationIds))
    .orderBy(asc(launchpadApplicationLog.createdAt));
  const logsByApplicationId = new Map<string, typeof logs>();
  for (const log of logs) {
    const current = logsByApplicationId.get(log.applicationId) ?? [];
    current.push(log);
    logsByApplicationId.set(log.applicationId, current);
  }
  const roles = rows
    .map((row) => ({
      applicationId: row.application.id,
      roleId: row.role.id,
      title: row.role.title,
      description: row.role.description,
      responsibilities: [],
      requirements: [],
      status: row.application.status,
      appliedAt: row.application.createdAt,
      archived: row.application.archived,
      actions: buildRoleActions(row.application.status),
      timeline: buildApplicationTimeline(
        logsByApplicationId.get(row.application.id) ?? [],
      ),
    }))
    .sort(
      (left, right) =>
        Date.parse(right.appliedAt) - Date.parse(left.appliedAt),
    );
  const statuses = roles.map((role) => role.status);
  const approvedRole =
    roles.find((role) => role.status === "APPROVED") ?? null;

  return {
    id: firstRow.opportunity.id,
    sourceType: "PROJECT" as const,
    title: firstRow.opportunity.name,
    imageKey: firstRow.opportunity.coverKey,
    status: resolveApplicationGroupStatus(statuses),
    appliedAt: roles[0]?.appliedAt ?? firstRow.application.createdAt,
    deadline: firstRow.opportunity.deadline,
    archived: roles.every((role) => role.archived),
    needAttention: approvedRole !== null,
    totalRoleApplied: roles.length,
    canArchive: canArchiveApplicationGroup(statuses),
    opportunity: {
      id: firstRow.opportunity.id,
      title: firstRow.opportunity.name,
      overview: firstRow.opportunity.description,
      category: normalizeNullableReference(firstRow.category),
      location: normalizeNullableReference(firstRow.location),
      startDate: null,
      endDate: null,
      commitmentLabel: null,
      commitmentDescription: null,
      filled: false,
      impactRewardPoints: null,
    },
    owner: {
      id: firstRow.owner.id,
      name: firstRow.owner.name,
      avatarUrl: firstRow.owner.avatarUrl,
      avatarKey: firstRow.owner.avatarKey,
      postedCount: Number(firstRow.postedCount),
      contact: {
        email: firstRow.owner.email,
        phoneNumber: firstRow.owner.phoneNumber,
        telegramUsername: firstRow.owner.telegramUsername,
      },
    },
    roles,
    approvedRole: approvedRole
      ? {
          applicationId: approvedRole.applicationId,
          roleId: approvedRole.roleId,
          title: approvedRole.title,
          status: approvedRole.status,
          appliedAt: approvedRole.appliedAt,
        }
      : null,
  };
}

type MyApplicationStatusAction = ChangeMyApplicationStatusParam["statusAction"];
type ApplicantStatusChange = "CONFIRMED" | "DECLINED" | "WITHDRAWN";

function getApplicantStatusChange(
  statusAction: MyApplicationStatusAction,
): ApplicantStatusChange {
  if (statusAction === "confirm") {
    return "CONFIRMED";
  }

  return statusAction === "decline" ? "DECLINED" : "WITHDRAWN";
}

function canApplicantChangeStatus(
  currentStatus: string,
  nextStatus: ApplicantStatusChange,
) {
  if (nextStatus === "CONFIRMED" || nextStatus === "DECLINED") {
    return currentStatus === "APPROVED";
  }

  return currentStatus === "SUBMITTED" || currentStatus === "UNDER_REVIEW";
}

async function updateVolunteerApplicationStatus(
  applicantId: string,
  applicationId: string,
  nextStatus: ApplicantStatusChange,
) {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({
        id: volunteerApplication.id,
        status: volunteerApplication.status,
        opportunityId: volunteerApplication.opportunityId,
      })
      .from(volunteerApplication)
      .where(
        and(
          eq(volunteerApplication.id, applicationId),
          eq(volunteerApplication.applicantId, applicantId),
        ),
      )
      .limit(1);

    if (!current) {
      return "not_found" as const;
    }

    if (!canApplicantChangeStatus(current.status, nextStatus)) {
      return "conflict" as const;
    }

    const [updated] = await tx
      .update(volunteerApplication)
      .set({ status: nextStatus, updatedAt: sql`now()` })
      .where(
        and(
          eq(volunteerApplication.id, applicationId),
          eq(volunteerApplication.applicantId, applicantId),
          eq(volunteerApplication.status, current.status),
        ),
      )
      .returning({ id: volunteerApplication.id });

    if (!updated) {
      return "conflict" as const;
    }

    await tx.insert(volunteerApplicationLog).values({
      volunteerApplicationId: applicationId,
      status: nextStatus,
      declinedBy: nextStatus === "DECLINED" ? "APPLICANT" : null,
      createdBy: applicantId,
    });

    if (nextStatus === "CONFIRMED") {
      const autoDeclinedApplications = await tx
        .update(volunteerApplication)
        .set({ status: "DECLINED", updatedAt: sql`now()` })
        .where(
          and(
            eq(volunteerApplication.opportunityId, current.opportunityId),
            eq(volunteerApplication.applicantId, applicantId),
            sql`${volunteerApplication.id} <> ${current.id}`,
            sql`${volunteerApplication.status} in ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED')`,
          ),
        )
        .returning({ id: volunteerApplication.id });

      if (autoDeclinedApplications.length > 0) {
        await tx.insert(volunteerApplicationLog).values(
          autoDeclinedApplications.map((application) => ({
            volunteerApplicationId: application.id,
            status: "DECLINED" as const,
            declinedBy: "SYSTEM" as const,
            createdBy: applicantId,
          })),
        );
      }

      await tx
        .select({ id: volunteerOpportunity.id })
        .from(volunteerOpportunity)
        .where(eq(volunteerOpportunity.id, current.opportunityId))
        .for("update");

      const roleFilledRows = await tx
        .select({
          capacity: volunteerRole.capacity,
          confirmedCount: sql<number>`(
            select count(*)::int
            from ${volunteerApplication}
            where ${volunteerApplication.roleId} = ${volunteerRole.id}
              and ${volunteerApplication.status} = 'CONFIRMED'
          )`,
        })
        .from(volunteerRole)
        .where(eq(volunteerRole.opportunityId, current.opportunityId));
      const filled =
        roleFilledRows.length > 0 &&
        roleFilledRows.every(
          (role) => Number(role.confirmedCount ?? 0) >= role.capacity,
        );

      await tx
        .update(volunteerOpportunity)
        .set({
          filled,
          updatedAt: sql`now()`,
        })
        .where(eq(volunteerOpportunity.id, current.opportunityId));
    }

    return "updated" as const;
  });
}

async function updateProjectApplicationStatus(
  applicantId: string,
  applicationId: string,
  nextStatus: ApplicantStatusChange,
) {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({
        id: launchpadApplication.id,
        status: launchpadApplication.status,
        launchpadId: launchpadApplication.launchpadId,
      })
      .from(launchpadApplication)
      .where(
        and(
          eq(launchpadApplication.id, applicationId),
          eq(launchpadApplication.createdBy, applicantId),
        ),
      )
      .limit(1);

    if (!current) {
      return "not_found" as const;
    }

    if (!canApplicantChangeStatus(current.status, nextStatus)) {
      return "conflict" as const;
    }

    const [updated] = await tx
      .update(launchpadApplication)
      .set({ status: nextStatus, updatedAt: sql`now()` })
      .where(
        and(
          eq(launchpadApplication.id, applicationId),
          eq(launchpadApplication.createdBy, applicantId),
          eq(launchpadApplication.status, current.status),
        ),
      )
      .returning({ id: launchpadApplication.id });

    if (!updated) {
      return "conflict" as const;
    }

    await tx.insert(launchpadApplicationLog).values({
      launchpadApplicationId: applicationId,
      status: nextStatus,
      declinedBy: nextStatus === "DECLINED" ? "APPLICANT" : null,
      createdBy: applicantId,
    });

    if (nextStatus === "CONFIRMED") {
      const autoDeclinedApplications = await tx
        .update(launchpadApplication)
        .set({ status: "DECLINED", updatedAt: sql`now()` })
        .where(
          and(
            eq(launchpadApplication.launchpadId, current.launchpadId),
            eq(launchpadApplication.createdBy, applicantId),
            sql`${launchpadApplication.id} <> ${current.id}`,
            sql`${launchpadApplication.status} in ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED')`,
          ),
        )
        .returning({ id: launchpadApplication.id });

      if (autoDeclinedApplications.length > 0) {
        await tx.insert(launchpadApplicationLog).values(
          autoDeclinedApplications.map((application) => ({
            launchpadApplicationId: application.id,
            status: "DECLINED" as const,
            declinedBy: "SYSTEM" as const,
            createdBy: applicantId,
          })),
        );
      }
    }

    return "updated" as const;
  });
}

export async function updateMyApplicationStatus(
  applicantId: string,
  params: ChangeMyApplicationStatusParam,
) {
  const nextStatus = getApplicantStatusChange(params.statusAction);

  if (params.sourceType === "volunteer") {
    return updateVolunteerApplicationStatus(
      applicantId,
      params.applicationId,
      nextStatus,
    );
  }

  return updateProjectApplicationStatus(
    applicantId,
    params.applicationId,
    nextStatus,
  );
}

function canArchiveApplicationGroup(statuses: string[]) {
  if (statuses.length === 0) {
    return false;
  }

  if (statuses.some((status) => status === "COMPLETED")) {
    return true;
  }

  return statuses.every(
    (status) => status === "DECLINED" || status === "WITHDRAWN",
  );
}

async function updateVolunteerApplicationGroupArchived(
  applicantId: string,
  opportunityId: string,
  archived: boolean,
) {
  return db.transaction(async (tx) => {
    const applications = await tx
      .select({
        id: volunteerApplication.id,
        status: volunteerApplication.status,
      })
      .from(volunteerApplication)
      .where(
        and(
          eq(volunteerApplication.opportunityId, opportunityId),
          eq(volunteerApplication.applicantId, applicantId),
        ),
      );

    if (applications.length === 0) {
      return "not_found" as const;
    }

    if (!canArchiveApplicationGroup(applications.map((item) => item.status))) {
      return "conflict" as const;
    }

    const updated = await tx
      .update(volunteerApplication)
      .set({ archived, updatedAt: sql`now()` })
      .where(
        and(
          eq(volunteerApplication.opportunityId, opportunityId),
          eq(volunteerApplication.applicantId, applicantId),
        ),
      )
      .returning({ id: volunteerApplication.id });

    if (updated.length === 0) {
      return "conflict" as const;
    }

    return "updated" as const;
  });
}

async function updateProjectApplicationGroupArchived(
  applicantId: string,
  opportunityId: string,
  archived: boolean,
) {
  return db.transaction(async (tx) => {
    const applications = await tx
      .select({
        id: launchpadApplication.id,
        status: launchpadApplication.status,
      })
      .from(launchpadApplication)
      .where(
        and(
          eq(launchpadApplication.launchpadId, opportunityId),
          eq(launchpadApplication.createdBy, applicantId),
        ),
      );

    if (applications.length === 0) {
      return "not_found" as const;
    }

    if (!canArchiveApplicationGroup(applications.map((item) => item.status))) {
      return "conflict" as const;
    }

    const updated = await tx
      .update(launchpadApplication)
      .set({ archived, updatedAt: sql`now()` })
      .where(
        and(
          eq(launchpadApplication.launchpadId, opportunityId),
          eq(launchpadApplication.createdBy, applicantId),
        ),
      )
      .returning({ id: launchpadApplication.id });

    if (updated.length === 0) {
      return "conflict" as const;
    }

    return "updated" as const;
  });
}

export async function updateMyApplicationArchived(
  applicantId: string,
  params: ChangeMyApplicationArchiveParam,
) {
  const archived = params.archiveAction === "archive";

  if (params.sourceType === "volunteer") {
    return updateVolunteerApplicationGroupArchived(
      applicantId,
      params.opportunityId,
      archived,
    );
  }

  return updateProjectApplicationGroupArchived(
    applicantId,
    params.opportunityId,
    archived,
  );
}
