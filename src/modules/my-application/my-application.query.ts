import { and, asc, desc, eq, sql } from "drizzle-orm";
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

export type MySpaceVolunteerApplication =
  Awaited<ReturnType<typeof findVolunteerApplicationsByApplicantId>>[number];

export type MySpaceProjectApplication = Awaited<
  ReturnType<typeof findProjectApplicationsByApplicantId>
>[number];

function toIsoDateTimeString(value: string): string {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : value;
}

async function findVolunteerApplicationsByApplicantId(applicantId: string) {
  const rows = await db
    .select({
      application: volunteerApplication,
      role: {
        id: volunteerRole.id,
        title: volunteerRole.title,
      },
      opportunity: {
        id: volunteerOpportunity.id,
        title: volunteerOpportunity.title,
        coverImageKey: volunteerOpportunity.coverImageKey,
        applicationDeadline: volunteerOpportunity.applicationDeadline,
      },
      category: {
        id: volunteerCategory.id,
        name: volunteerCategory.name,
      },
      location: {
        id: city.id,
        name: city.name,
      },
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
    .where(eq(volunteerApplication.applicantId, applicantId))
    .orderBy(desc(volunteerApplication.createdAt));

  return rows.map((row) => ({
    id: row.application.id,
    opportunity: {
      ...row.opportunity,
      applicationDeadline: toIsoDateTimeString(
        row.opportunity.applicationDeadline,
      ),
      category: row.category,
      location: row.location,
    },
    role: row.role,
    availability: row.application.availability,
    relevantExperience: row.application.relevantExperience,
    supportingDocuments: row.application.supportingDocuments,
    topPick: row.application.topPick,
    status: row.application.status,
    archived: row.application.archived,
    createdAt: toIsoDateTimeString(row.application.createdAt),
    updatedAt: toIsoDateTimeString(row.application.updatedAt),
  }));
}

export async function findMyVolunteerApplications(userId: string) {
  return findVolunteerApplicationsByApplicantId(userId);
}

export async function findProjectApplicationsByApplicantId(applicantId: string) {
  return db
    .select({
      id: launchpadApplication.id,
      title: launchpadRole.title,
      role: {
        id: launchpadRole.id,
        title: launchpadRole.title,
        description: launchpadRole.description,
      },
      imageKey: launchpad.coverKey,
      appliedAt: launchpadApplication.createdAt,
      updatedAt: launchpadApplication.updatedAt,
      deadline: launchpad.deadline,
      status: launchpadApplication.status,
      archived: launchpadApplication.archived,
      topPick: launchpadApplication.topPick,
      motivation: launchpadApplication.motivation,
      portfolio: launchpadApplication.portfolio,
      documentKeys: launchpadApplication.documentKeys,
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
    declinedBy: "POSTER" | "APPLICANT" | null;
  }>,
) {
  return logs.reduce(
    (timeline, log) => {
      if (log.status === "SUBMITTED") {
        timeline.submitted ??= log.createdAt;
      } else if (log.status === "UNDER_REVIEW") {
        timeline.underReview ??= log.createdAt;
      } else if (log.status === "APPROVED") {
        timeline.passed ??= log.createdAt;
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
      passed: null,
      declined: {
        at: null,
        by: null,
      },
      confirmed: null,
      completed: null,
    } as {
      submitted: string | null;
      underReview: string | null;
      passed: string | null;
      declined: {
        at: string | null;
        by: "POSTER" | "APPLICANT" | null;
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

export async function findMyVolunteerApplicationDetail(
  applicantId: string,
  applicationId: string,
) {
  const postedCounts = db
    .select({
      userId: volunteerOpportunity.createdBy,
      count: sql<number>`count(*)::int`.as("count"),
    })
    .from(volunteerOpportunity)
    .groupBy(volunteerOpportunity.createdBy)
    .as("volunteer_posted_counts");

  const [row] = await db
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
        eq(volunteerApplication.id, applicationId),
        eq(volunteerApplication.applicantId, applicantId),
      ),
    )
    .limit(1);

  if (!row) {
    return null;
  }

  const [requirements, logs] = await Promise.all([
    db
      .select({
        text: volunteerRoleRequirement.requirementText,
      })
      .from(volunteerRoleRequirement)
      .where(eq(volunteerRoleRequirement.roleId, row.role.id))
      .orderBy(asc(volunteerRoleRequirement.displayOrder)),
    db
      .select({
        status: volunteerApplicationLog.status,
        createdAt: volunteerApplicationLog.createdAt,
        declinedBy: volunteerApplicationLog.declinedBy,
      })
      .from(volunteerApplicationLog)
      .where(eq(volunteerApplicationLog.volunteerApplicationId, applicationId))
      .orderBy(asc(volunteerApplicationLog.createdAt)),
  ]);

  return {
    id: row.application.id,
    sourceType: "VOLUNTEER" as const,
    title: row.role.title,
    imageKey: row.opportunity.coverImageKey,
    status: row.application.status,
    appliedAt: row.application.createdAt,
    deadline: row.opportunity.applicationDeadline,
    archived: row.application.archived,
    opportunity: {
      id: row.opportunity.id,
      title: row.opportunity.title,
      overview: row.opportunity.overview,
      category: row.category,
      location: row.location,
      startDate: row.opportunity.startDate,
      endDate: row.opportunity.endDate,
      commitmentLabel: row.opportunity.commitmentLabel,
      commitmentDescription: row.opportunity.commitmentDescription,
      filled: row.opportunity.filled,
      impactRewardPoints: null,
    },
    role: {
      id: row.role.id,
      title: row.role.title,
      description: null,
      responsibilities: row.role.responsibilities as string[],
      requirements: requirements.map((requirement) => requirement.text),
    },
    owner: {
      id: row.owner.id,
      name: row.owner.name,
      avatarUrl: row.owner.avatarUrl,
      avatarKey: row.owner.avatarKey,
      postedCount: Number(row.postedCount),
      contact: {
        email: row.owner.email,
        phoneNumber: row.owner.phoneNumber,
        telegramUsername: row.owner.telegramUsername,
      },
    },
    timeline: buildApplicationTimeline(logs),
  };
}

export async function findMyProjectApplicationDetail(
  applicantId: string,
  applicationId: string,
) {
  const postedCounts = db
    .select({
      userId: launchpad.createdBy,
      count: sql<number>`count(*)::int`.as("count"),
    })
    .from(launchpad)
    .groupBy(launchpad.createdBy)
    .as("launchpad_posted_counts");

  const [row] = await db
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
        eq(launchpadApplication.id, applicationId),
        eq(launchpadApplication.createdBy, applicantId),
      ),
    )
    .limit(1);

  if (!row) {
    return null;
  }

  const logs = await db
    .select({
      status: launchpadApplicationLog.status,
      createdAt: launchpadApplicationLog.createdAt,
      declinedBy: launchpadApplicationLog.declinedBy,
    })
    .from(launchpadApplicationLog)
    .where(eq(launchpadApplicationLog.launchpadApplicationId, applicationId))
    .orderBy(asc(launchpadApplicationLog.createdAt));

  return {
    id: row.application.id,
    sourceType: "PROJECT" as const,
    title: row.role.title,
    imageKey: row.opportunity.coverKey,
    status: row.application.status,
    appliedAt: row.application.createdAt,
    deadline: row.opportunity.deadline,
    archived: row.application.archived,
    opportunity: {
      id: row.opportunity.id,
      title: row.opportunity.name,
      overview: row.opportunity.description,
      category: normalizeNullableReference(row.category),
      location: normalizeNullableReference(row.location),
      startDate: null,
      endDate: null,
      commitmentLabel: null,
      commitmentDescription: null,
      filled: false,
      impactRewardPoints: null,
    },
    role: {
      id: row.role.id,
      title: row.role.title,
      description: row.role.description,
      responsibilities: [],
      requirements: [],
    },
    owner: {
      id: row.owner.id,
      name: row.owner.name,
      avatarUrl: row.owner.avatarUrl,
      avatarKey: row.owner.avatarKey,
      postedCount: Number(row.postedCount),
      contact: {
        email: row.owner.email,
        phoneNumber: row.owner.phoneNumber,
        telegramUsername: row.owner.telegramUsername,
      },
    },
    timeline: buildApplicationTimeline(logs),
  };
}

type MyApplicationStatusAction = ChangeMyApplicationStatusParam["statusAction"];
type ApplicantStatusChange = "CONFIRMED" | "DECLINED" | "WITHDRAWN";
type TerminalApplicationStatus = "DECLINED" | "COMPLETED" | "WITHDRAWN";

const ARCHIVABLE_APPLICATION_STATUSES = [
  "DECLINED",
  "COMPLETED",
  "WITHDRAWN",
] as const satisfies readonly TerminalApplicationStatus[];

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

function canArchiveApplicationStatus(
  status: string,
): status is TerminalApplicationStatus {
  return ARCHIVABLE_APPLICATION_STATUSES.includes(
    status as TerminalApplicationStatus,
  );
}

async function updateVolunteerApplicationArchived(
  applicantId: string,
  applicationId: string,
  archived: boolean,
) {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({
        id: volunteerApplication.id,
        status: volunteerApplication.status,
        archived: volunteerApplication.archived,
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

    if (!canArchiveApplicationStatus(current.status)) {
      return "conflict" as const;
    }

    if (current.archived === archived) {
      return "updated" as const;
    }

    const [updated] = await tx
      .update(volunteerApplication)
      .set({ archived, updatedAt: sql`now()` })
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

    return "updated" as const;
  });
}

async function updateProjectApplicationArchived(
  applicantId: string,
  applicationId: string,
  archived: boolean,
) {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({
        id: launchpadApplication.id,
        status: launchpadApplication.status,
        archived: launchpadApplication.archived,
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

    if (!canArchiveApplicationStatus(current.status)) {
      return "conflict" as const;
    }

    if (current.archived === archived) {
      return "updated" as const;
    }

    const [updated] = await tx
      .update(launchpadApplication)
      .set({ archived, updatedAt: sql`now()` })
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

    return "updated" as const;
  });
}

export async function updateMyApplicationArchived(
  applicantId: string,
  params: ChangeMyApplicationArchiveParam,
) {
  const archived = params.archiveAction === "archive";

  if (params.sourceType === "volunteer") {
    return updateVolunteerApplicationArchived(
      applicantId,
      params.applicationId,
      archived,
    );
  }

  return updateProjectApplicationArchived(
    applicantId,
    params.applicationId,
    archived,
  );
}
