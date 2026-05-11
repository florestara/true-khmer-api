import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../../../db";
import {
  launchpad,
  launchpadApplication,
  launchpadRole,
  user,
  userProfile,
  volunteerApplication,
  volunteerOpportunity,
  volunteerRole,
} from "../../../db/schema";
import {
  buildPagePagination,
  type PagePagination,
} from "../../../utils/page-pagination.helper";
import type {
  GetManagePostingDetailParam,
  GetManagePostingDetailQuery,
  GetManagePostingsQuery,
  ManagePostingFilter,
  ManagePostingStatus,
} from "./manage-posting.schema";

type ManagePostingSourceType = "VOLUNTEER" | "PROJECT";
type ManagePostingApplicantStatus =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "DECLINED"
  | "CONFIRMED"
  | "COMPLETED"
  | "WITHDRAWN";

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

export type ManagePostingsResult = {
  postings: ManagePostingItem[];
  pagination: PagePagination;
};

type ManagePostingApplicant = {
  id: string;
  candidate: {
    id: string;
    name: string;
    email: string;
    phoneNumber: string | null;
    telegramUsername: string | null;
    avatarUrl: string | null;
    avatarKey: string | null;
  };
  role: {
    id: string;
    title: string;
  };
  status: ManagePostingApplicantStatus;
  appliedAt: string;
  updatedAt: string;
  contact: {
    email: string;
    phoneNumber: string | null;
    telegramUsername: string | null;
  };
  volunteer: {
    availability: string;
    relevantExperience: string;
    supportingDocuments: Array<{ name: string; key: string }>;
  } | null;
  project: {
    motivation: string;
    portfolio: string;
    documentKeys: string[];
    documentNames: string[];
  } | null;
};

type ManagePostingDetail = {
  posting: ManagePostingItem;
  stats: {
    pending: number;
    totalApplicants: number;
    recruited: number;
    capacity: number;
    statuses: Record<ManagePostingApplicantStatus, number>;
  };
  applicants: ManagePostingApplicant[];
  pagination: PagePagination;
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

const APPLICANT_STATUSES: ManagePostingApplicantStatus[] = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "DECLINED",
  "CONFIRMED",
  "COMPLETED",
  "WITHDRAWN",
];

function toInteger(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildApplicantStatusCounts(applicants: ManagePostingApplicant[]) {
  const statuses = APPLICANT_STATUSES.reduce(
    (counts, status) => ({
      ...counts,
      [status]: 0,
    }),
    {} as Record<ManagePostingApplicantStatus, number>,
  );

  for (const applicant of applicants) {
    statuses[applicant.status] += 1;
  }

  return statuses;
}

function matchesAppliedRange(
  range: GetManagePostingDetailQuery["range"],
  appliedAt: string,
): boolean {
  if (range === "all_time") {
    return true;
  }

  const now = new Date();
  const start = new Date(now);

  if (range === "today") {
    start.setHours(0, 0, 0, 0);
  } else {
    start.setDate(start.getDate() - 7);
  }

  return Date.parse(appliedAt) >= start.getTime();
}

function matchesApplicantSearch(
  search: string | undefined,
  applicant: ManagePostingApplicant,
) {
  if (!search) {
    return true;
  }

  const normalizedSearch = search.toLowerCase();
  return [
    applicant.candidate.name,
    applicant.candidate.email,
    applicant.role.title,
    applicant.contact.phoneNumber,
    applicant.contact.telegramUsername,
  ].some((value) => value?.toLowerCase().includes(normalizedSearch));
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

async function findVolunteerManagePostingDetail(
  userId: string,
  postingId: string,
  query: GetManagePostingDetailQuery,
): Promise<ManagePostingDetail | null> {
  const posting =
    (await findVolunteerManagePostings(userId)).find(
      (item) => item.id === postingId,
    ) ?? null;

  if (!posting) {
    return null;
  }

  const rows = await db
    .select({
      application: volunteerApplication,
      role: {
        id: volunteerRole.id,
        title: volunteerRole.title,
      },
      candidate: {
        id: user.id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        telegramUsername: user.telegramUsername,
        avatarUrl: userProfile.avatarUrl,
        avatarKey: userProfile.avatarKey,
      },
    })
    .from(volunteerApplication)
    .innerJoin(volunteerRole, eq(volunteerRole.id, volunteerApplication.roleId))
    .innerJoin(
      volunteerOpportunity,
      eq(volunteerOpportunity.id, volunteerApplication.opportunityId),
    )
    .innerJoin(user, eq(user.id, volunteerApplication.applicantId))
    .leftJoin(userProfile, eq(userProfile.userId, user.id))
    .where(
      and(
        eq(volunteerApplication.opportunityId, postingId),
        eq(volunteerOpportunity.createdBy, userId),
      ),
    )
    .orderBy(desc(volunteerApplication.createdAt));

  const applicants: ManagePostingApplicant[] = rows.map((row) => ({
    id: row.application.id,
    candidate: row.candidate,
    role: row.role,
    status: row.application.status,
    appliedAt: row.application.createdAt,
    updatedAt: row.application.updatedAt,
    contact: {
      email: row.candidate.email,
      phoneNumber: row.candidate.phoneNumber,
      telegramUsername: row.candidate.telegramUsername,
    },
    volunteer: {
      availability: row.application.availability,
      relevantExperience: row.application.relevantExperience,
      supportingDocuments: row.application.supportingDocuments as Array<{
        name: string;
        key: string;
      }>,
    },
    project: null,
  }));

  return buildManagePostingDetail(posting, applicants, query);
}

async function findProjectManagePostingDetail(
  userId: string,
  postingId: string,
  query: GetManagePostingDetailQuery,
): Promise<ManagePostingDetail | null> {
  const posting =
    (await findProjectManagePostings(userId)).find(
      (item) => item.id === postingId,
    ) ?? null;

  if (!posting) {
    return null;
  }

  const rows = await db
    .select({
      application: launchpadApplication,
      role: {
        id: launchpadRole.id,
        title: launchpadRole.title,
      },
      candidate: {
        id: user.id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        telegramUsername: user.telegramUsername,
        avatarUrl: userProfile.avatarUrl,
        avatarKey: userProfile.avatarKey,
      },
    })
    .from(launchpadApplication)
    .innerJoin(
      launchpadRole,
      eq(launchpadRole.id, launchpadApplication.launchpadRoleId),
    )
    .innerJoin(launchpad, eq(launchpad.id, launchpadApplication.launchpadId))
    .innerJoin(user, eq(user.id, launchpadApplication.createdBy))
    .leftJoin(userProfile, eq(userProfile.userId, user.id))
    .where(
      and(
        eq(launchpadApplication.launchpadId, postingId),
        eq(launchpad.createdBy, userId),
      ),
    )
    .orderBy(desc(launchpadApplication.createdAt));

  const applicants: ManagePostingApplicant[] = rows.map((row) => ({
    id: row.application.id,
    candidate: row.candidate,
    role: row.role,
    status: row.application.status,
    appliedAt: row.application.createdAt,
    updatedAt: row.application.updatedAt,
    contact: {
      email: row.candidate.email,
      phoneNumber: row.candidate.phoneNumber,
      telegramUsername: row.candidate.telegramUsername,
    },
    volunteer: null,
    project: {
      motivation: row.application.motivation,
      portfolio: row.application.portfolio,
      documentKeys: row.application.documentKeys as string[],
      documentNames: row.application.documentNames as string[],
    },
  }));

  return buildManagePostingDetail(posting, applicants, query);
}

function buildManagePostingDetail(
  posting: ManagePostingItem,
  applicants: ManagePostingApplicant[],
  query: GetManagePostingDetailQuery,
): ManagePostingDetail {
  const statuses = buildApplicantStatusCounts(applicants);
  const filteredApplicants = applicants.filter(
    (applicant) =>
      matchesAppliedRange(query.range, applicant.appliedAt) &&
      matchesApplicantSearch(query.search, applicant),
  );
  const { pageRows, pagination } = buildPagePagination({
    rows: filteredApplicants,
    page: query.page,
    limit: query.limit,
  });

  return {
    posting,
    stats: {
      pending: statuses.SUBMITTED,
      totalApplicants: statuses.CONFIRMED,
      recruited: statuses.CONFIRMED,
      capacity: posting.capacity,
      statuses,
    },
    applicants: pageRows,
    pagination,
  };
}

export async function findManagePostingDetail(
  userId: string,
  params: GetManagePostingDetailParam,
  query: GetManagePostingDetailQuery,
): Promise<ManagePostingDetail | null> {
  if (params.sourceType === "volunteer") {
    return findVolunteerManagePostingDetail(userId, params.postingId, query);
  }

  return findProjectManagePostingDetail(userId, params.postingId, query);
}

export async function findManagePostings(
  userId: string,
  query: GetManagePostingsQuery,
): Promise<ManagePostingsResult> {
  const [volunteerPostings, projectPostings] = await Promise.all([
    query.type === "projects"
      ? Promise.resolve([])
      : findVolunteerManagePostings(userId),
    query.type === "volunteer"
      ? Promise.resolve([])
      : findProjectManagePostings(userId),
  ]);

  const postings = [...volunteerPostings, ...projectPostings]
    .filter((posting) => matchesFilter(posting.status, query.filter))
    .sort((left, right) => {
      const createdAtDelta =
        Date.parse(right.createdAt) - Date.parse(left.createdAt);

      return createdAtDelta === 0
        ? right.id.localeCompare(left.id)
        : createdAtDelta;
    });

  const { pageRows, pagination } = buildPagePagination({
    rows: postings,
    page: query.page,
    limit: query.limit,
  });

  return {
    postings: pageRows,
    pagination,
  };
}
