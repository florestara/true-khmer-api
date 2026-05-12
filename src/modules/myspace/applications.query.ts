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
    status: "SUBMITTED" | "APPROVED" | "CONFIRMED" | "COMPLETED" | string;
    createdAt: string;
  }>,
) {
  return logs.reduce(
    (timeline, log) => {
      if (log.status === "SUBMITTED") {
        timeline.submitted ??= log.createdAt;
      } else if (log.status === "APPROVED") {
        timeline.passed ??= log.createdAt;
      } else if (log.status === "CONFIRMED") {
        timeline.confirmed ??= log.createdAt;
      } else if (log.status === "COMPLETED") {
        timeline.completed ??= log.createdAt;
      }

      return timeline;
    },
    {
      submitted: null,
      passed: null,
      confirmed: null,
      completed: null,
    } as {
      submitted: string | null;
      passed: string | null;
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
      durationLabel: row.opportunity.durationLabel,
      commitmentLabel: row.opportunity.commitmentLabel,
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
      durationLabel: null,
      commitmentLabel: null,
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
