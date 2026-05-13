import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  city,
  launchpad,
  launchpadApplication,
  launchpadApplicationLog,
  launchpadCategory,
  launchpadRole,
  volunteerApplication,
  volunteerApplicationLog,
} from "../../db/schema";
import type { ChangeMyApplicationStatusParam } from "./applications.schema";
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
