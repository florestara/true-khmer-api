import { desc, eq, sql } from "drizzle-orm";
import { db } from "../../../db";
import {
  launchpad,
  launchpadApplication,
  launchpadRole,
  volunteerApplication,
  volunteerOpportunity,
  volunteerRole,
} from "../../../db/schema";
import type {
  GetManagePostingsQuery,
  ManagePostingFilter,
  ManagePostingStatus,
} from "./manage-posting.schema";

type ManagePostingSourceType = "VOLUNTEER" | "PROJECT";

export type ManagePostingItem = {
  id: string;
  sourceType: ManagePostingSourceType;
  title: string;
  description: string | null;
  imageKey: string | null;
  status: ManagePostingStatus;
  applicantCount: number;
  capacity: number;
  views: number;
  deadline: string | null;
  createdAt: string;
};

type VolunteerPostingRow = {
  id: string;
  title: string;
  description: string | null;
  imageKey: string | null;
  rawStatus: "DRAFT" | "PUBLISHED" | "ARCHIVED" | "CLOSED";
  applicantCount: number;
  capacity: number;
  deadline: string;
  createdAt: string;
};

type ProjectPostingRow = {
  id: string;
  title: string;
  description: string | null;
  imageKey: string | null;
  totalView: number;
  applicantCount: number;
  capacity: number;
  deadline: string | null;
  createdAt: string;
};

function toInteger(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function derivePostingStatus(input: {
  rawStatus?: VolunteerPostingRow["rawStatus"];
  applicantCount: number;
  capacity: number;
  deadline: string | null;
  now: Date;
}): ManagePostingStatus {
  if (input.rawStatus === "DRAFT") {
    return "DRAFT";
  }

  if (
    input.rawStatus === "ARCHIVED" ||
    input.rawStatus === "CLOSED" ||
    (input.deadline !== null &&
      new Date(input.deadline).getTime() < input.now.getTime())
  ) {
    return "ENDED";
  }

  if (input.capacity > 0 && input.applicantCount >= input.capacity) {
    return "FILLED";
  }

  return "ACTIVE";
}

function matchesFilter(
  status: ManagePostingStatus,
  filter: ManagePostingFilter,
): boolean {
  return filter === "all" || status.toLowerCase() === filter;
}

async function findVolunteerManagePostings(
  userId: string,
): Promise<ManagePostingItem[]> {
  const confirmedApplications = db
    .select({
      opportunityId: volunteerApplication.opportunityId,
      applicantCount: sql<number>`count(*)::int`.as("applicant_count"),
    })
    .from(volunteerApplication)
    .where(eq(volunteerApplication.status, "CONFIRMED"))
    .groupBy(volunteerApplication.opportunityId)
    .as("confirmed_volunteer_applications");

  const roleCapacities = db
    .select({
      opportunityId: volunteerRole.opportunityId,
      capacity:
        sql<number>`coalesce(sum(${volunteerRole.capacity}), 0)::int`.as(
          "capacity",
        ),
    })
    .from(volunteerRole)
    .groupBy(volunteerRole.opportunityId)
    .as("volunteer_role_capacities");

  const rows: VolunteerPostingRow[] = await db
    .select({
      id: volunteerOpportunity.id,
      title: volunteerOpportunity.title,
      description: volunteerOpportunity.overview,
      imageKey: volunteerOpportunity.coverImageKey,
      rawStatus: volunteerOpportunity.status,
      applicantCount: sql<number>`coalesce(${confirmedApplications.applicantCount}, 0)`,
      capacity: sql<number>`coalesce(${roleCapacities.capacity}, 0)`,
      deadline: volunteerOpportunity.applicationDeadline,
      createdAt: volunteerOpportunity.createdAt,
    })
    .from(volunteerOpportunity)
    .leftJoin(
      confirmedApplications,
      eq(confirmedApplications.opportunityId, volunteerOpportunity.id),
    )
    .leftJoin(
      roleCapacities,
      eq(roleCapacities.opportunityId, volunteerOpportunity.id),
    )
    .where(eq(volunteerOpportunity.createdBy, userId))
    .orderBy(desc(volunteerOpportunity.createdAt));

  const now = new Date();

  return rows.map((row) => {
    const applicantCount = toInteger(row.applicantCount);
    const capacity = toInteger(row.capacity);

    return {
      id: row.id,
      sourceType: "VOLUNTEER",
      title: row.title,
      description: row.description,
      imageKey: row.imageKey,
      status: derivePostingStatus({
        rawStatus: row.rawStatus,
        applicantCount,
        capacity,
        deadline: row.deadline,
        now,
      }),
      applicantCount,
      capacity,
      views: 0,
      deadline: row.deadline,
      createdAt: row.createdAt,
    };
  });
}

async function findProjectManagePostings(
  userId: string,
): Promise<ManagePostingItem[]> {
  const confirmedApplications = db
    .select({
      launchpadId: launchpadApplication.launchpadId,
      applicantCount: sql<number>`count(*)::int`.as("applicant_count"),
    })
    .from(launchpadApplication)
    .where(eq(launchpadApplication.status, "CONFIRMED"))
    .groupBy(launchpadApplication.launchpadId)
    .as("confirmed_launchpad_applications");

  const roleCapacities = db
    .select({
      launchpadId: launchpadRole.launchpadId,
      capacity:
        sql<number>`coalesce(sum(${launchpadRole.capacity}), 0)::int`.as(
          "capacity",
        ),
    })
    .from(launchpadRole)
    .groupBy(launchpadRole.launchpadId)
    .as("launchpad_role_capacities");

  const rows: ProjectPostingRow[] = await db
    .select({
      id: launchpad.id,
      title: launchpad.name,
      description: launchpad.description,
      imageKey: launchpad.coverKey,
      totalView: launchpad.totalView,
      applicantCount: sql<number>`coalesce(${confirmedApplications.applicantCount}, 0)`,
      capacity: sql<number>`coalesce(${roleCapacities.capacity}, 0)`,
      deadline: launchpad.deadline,
      createdAt: launchpad.createdAt,
    })
    .from(launchpad)
    .leftJoin(
      confirmedApplications,
      eq(confirmedApplications.launchpadId, launchpad.id),
    )
    .leftJoin(roleCapacities, eq(roleCapacities.launchpadId, launchpad.id))
    .where(eq(launchpad.createdBy, userId))
    .orderBy(desc(launchpad.createdAt));

  const now = new Date();

  return rows.map((row) => {
    const applicantCount = toInteger(row.applicantCount);
    const capacity = toInteger(row.capacity);

    return {
      id: row.id,
      sourceType: "PROJECT",
      title: row.title,
      description: row.description,
      imageKey: row.imageKey,
      status: derivePostingStatus({
        applicantCount,
        capacity,
        deadline: row.deadline,
        now,
      }),
      applicantCount,
      capacity,
      views: toInteger(row.totalView),
      deadline: row.deadline,
      createdAt: row.createdAt,
    };
  });
}

export async function findManagePostings(
  userId: string,
  query: GetManagePostingsQuery,
): Promise<ManagePostingItem[]> {
  const [volunteerPostings, projectPostings] = await Promise.all([
    query.type === "projects"
      ? Promise.resolve([])
      : findVolunteerManagePostings(userId),
    query.type === "volunteer"
      ? Promise.resolve([])
      : findProjectManagePostings(userId),
  ]);

  return [...volunteerPostings, ...projectPostings]
    .filter((posting) => matchesFilter(posting.status, query.filter))
    .sort((left, right) => {
      const createdAtDelta =
        Date.parse(right.createdAt) - Date.parse(left.createdAt);

      return createdAtDelta === 0
        ? right.id.localeCompare(left.id)
        : createdAtDelta;
    });
}
