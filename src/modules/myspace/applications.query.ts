import { desc, eq } from "drizzle-orm";
import { db } from "../../db";
import {
  city,
  launchpad,
  launchpadApplication,
  launchpadCategory,
  launchpadRole,
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
