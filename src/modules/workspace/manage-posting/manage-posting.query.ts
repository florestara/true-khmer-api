import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../../../db";
import {
  launchpad,
  launchpadApplication,
  launchpadApplicationLog,
  launchpadRole,
  user,
  userProfile,
  volunteerApplication,
  volunteerApplicationLog,
  volunteerOpportunity,
  volunteerRole,
} from "../../../db/schema";
import {
  buildPagePagination,
  type PagePagination,
} from "../../../utils/page-pagination.helper";
import type {
  ChangeManagePostingApplicationStatusParam,
  GetManagePostingApplicationParam,
  GetManagePostingDetailParam,
  GetManagePostingDetailQuery,
  GetManagePostingsQuery,
  ManagePostingFilter,
  ManagePostingStatusAction,
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
  filled: boolean;
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
    description: string | null;
  };
  roles: Array<{
    applicationId: string;
    id: string;
    title: string;
    description: string | null;
    status: ManagePostingApplicantStatus;
    appliedAt: string;
    updatedAt: string;
  }>;
  topPick: string | null;
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

type ManagePostingApplicationDetail = {
  applicant: ManagePostingApplicant;
};

type PosterApplicationStatusChange = "UNDER_REVIEW" | "APPROVED" | "DECLINED";
type ManagePostingApplicationUpdateResult =
  | "not_found"
  | "conflict"
  | "role_filled"
  | "applicant_already_approved"
  | ManagePostingApplicationDetail;

const POSTER_LOCKED_APPLICATION_STATUSES = new Set<ManagePostingApplicantStatus>(
  ["CONFIRMED", "DECLINED", "COMPLETED", "WITHDRAWN"],
);

function getPosterApplicationStatusChange(
  statusAction: ManagePostingStatusAction,
): PosterApplicationStatusChange {
  if (statusAction === "under_review") {
    return "UNDER_REVIEW";
  }

  return statusAction === "approve" ? "APPROVED" : "DECLINED";
}

function buildPosterStatusLogSequence(
  currentStatus: ManagePostingApplicantStatus,
  nextStatus: PosterApplicationStatusChange,
): PosterApplicationStatusChange[] {
  if (currentStatus === nextStatus) {
    return [];
  }

  if (currentStatus === "SUBMITTED" && nextStatus !== "UNDER_REVIEW") {
    return ["UNDER_REVIEW", nextStatus];
  }

  return [nextStatus];
}

type VolunteerPostingRow = {
  id: string;
  title: string;
  description: string | null;
  imageKey: string | null;
  rawStatus: "DRAFT" | "ACTIVE" | "CLOSED" | "COMPLETED";
  filled: boolean;
  totalView: number;
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
  filled: boolean;
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

function buildApplicantStatusCounts(statusesToCount: ManagePostingApplicantStatus[]) {
  const statuses = APPLICANT_STATUSES.reduce(
    (counts, status) => ({
      ...counts,
      [status]: 0,
    }),
    {} as Record<ManagePostingApplicantStatus, number>,
  );

  for (const status of statusesToCount) {
    statuses[status] += 1;
  }

  return statuses;
}

const VOLUNTEER_STATS_STATUS_PRIORITY = new Map<ManagePostingApplicantStatus, number>(
  APPLICANT_STATUSES.map((status, index) => [status, index]),
);

function resolveVolunteerStatsStatus(
  current: ManagePostingApplicantStatus | undefined,
  next: ManagePostingApplicantStatus,
): ManagePostingApplicantStatus {
  if (!current) {
    return next;
  }

  if (current === "CONFIRMED" || next === "CONFIRMED") {
    return "CONFIRMED";
  }

  if (current === "APPROVED" || next === "APPROVED") {
    return "APPROVED";
  }

  if (current === "UNDER_REVIEW" || next === "UNDER_REVIEW") {
    return "UNDER_REVIEW";
  }

  if (current === "SUBMITTED" || next === "SUBMITTED") {
    return "SUBMITTED";
  }

  const currentPriority = VOLUNTEER_STATS_STATUS_PRIORITY.get(current) ?? 0;
  const nextPriority = VOLUNTEER_STATS_STATUS_PRIORITY.get(next) ?? 0;
  return nextPriority < currentPriority ? next : current;
}

function getVolunteerStatsGroupKey(
  postingId: string,
  applicant: ManagePostingApplicant,
): string {
  const supportingDocuments = (applicant.volunteer?.supportingDocuments ?? [])
    .map((document) => document.key)
    .sort((left, right) => left.localeCompare(right));

  return JSON.stringify({
    applicantId: applicant.candidate.id,
    opportunityId: postingId,
    availability: applicant.volunteer?.availability ?? "",
    relevantExperience: applicant.volunteer?.relevantExperience ?? "",
    supportingDocumentKeys: supportingDocuments,
  });
}

type VolunteerManagePostingRow = {
  application: typeof volunteerApplication.$inferSelect;
  role: {
    id: string;
    title: string;
    responsibilities: string[];
  };
  candidate: ManagePostingApplicant["candidate"];
};

function getVolunteerRoleDescription(responsibilities: string[]) {
  return responsibilities.length > 0 ? responsibilities.join("\n") : null;
}

function getVolunteerApplicationGroupKey(
  postingId: string,
  row: Pick<VolunteerManagePostingRow, "application">,
): string {
  const supportingDocuments = (
    row.application.supportingDocuments as Array<{ name: string; key: string }>
  )
    .map((document) => document.key)
    .sort((left, right) => left.localeCompare(right));

  return JSON.stringify({
    applicantId: row.application.applicantId,
    opportunityId: postingId,
    availability: row.application.availability,
    relevantExperience: row.application.relevantExperience,
    supportingDocumentKeys: supportingDocuments,
  });
}

function buildVolunteerManagePostingApplicants(
  postingId: string,
  rows: VolunteerManagePostingRow[],
): ManagePostingApplicant[] {
  const applicantByGroup = new Map<string, ManagePostingApplicant>();

  for (const row of rows) {
    const groupKey = getVolunteerApplicationGroupKey(postingId, row);
    const roleDescription = getVolunteerRoleDescription(row.role.responsibilities);
    const roleItem = {
      applicationId: row.application.id,
      id: row.role.id,
      title: row.role.title,
      description: roleDescription,
      status: row.application.status,
      appliedAt: row.application.createdAt,
      updatedAt: row.application.updatedAt,
    };
    const existing = applicantByGroup.get(groupKey);

    if (!existing) {
      applicantByGroup.set(groupKey, {
        id: row.application.id,
        candidate: row.candidate,
        role: {
          id: row.role.id,
          title: row.role.title,
          description: roleDescription,
        },
        roles: [roleItem],
        topPick: row.application.topPick ? row.role.id : null,
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
      });
      continue;
    }

    existing.roles.push(roleItem);
    existing.status = resolveVolunteerStatsStatus(
      existing.status,
      row.application.status,
    );
    if (Date.parse(row.application.createdAt) < Date.parse(existing.appliedAt)) {
      existing.appliedAt = row.application.createdAt;
    }
    if (Date.parse(row.application.updatedAt) > Date.parse(existing.updatedAt)) {
      existing.updatedAt = row.application.updatedAt;
    }
    if (row.application.topPick) {
      existing.topPick = row.role.id;
      existing.id = row.application.id;
      existing.role = {
        id: row.role.id,
        title: row.role.title,
        description: roleDescription,
      };
    }
  }

  return [...applicantByGroup.values()].map((applicant) => ({
    ...applicant,
    roles: applicant.roles.sort(
      (left, right) => Date.parse(left.appliedAt) - Date.parse(right.appliedAt),
    ),
  }));
}

function buildVolunteerStatsStatuses(
  postingId: string,
  applicants: ManagePostingApplicant[],
): ManagePostingApplicantStatus[] {
  const statusByGroup = new Map<string, ManagePostingApplicantStatus>();

  for (const applicant of applicants) {
    const groupKey = getVolunteerStatsGroupKey(postingId, applicant);
    statusByGroup.set(
      groupKey,
      resolveVolunteerStatsStatus(statusByGroup.get(groupKey), applicant.status),
    );
  }

  return [...statusByGroup.values()];
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
    applicant.role.description,
    ...applicant.roles.flatMap((role) => [role.title, role.description]),
    applicant.contact.phoneNumber,
    applicant.contact.telegramUsername,
  ].some((value) => value?.toLowerCase().includes(normalizedSearch));
}

function derivePostingStatus(input: {
  rawStatus?: VolunteerPostingRow["rawStatus"];
  deadline: string | null;
  now: Date;
}): ManagePostingStatus {
  if (input.rawStatus && input.rawStatus !== "ACTIVE") {
    return input.rawStatus;
  }

  if (
    input.deadline !== null &&
    new Date(input.deadline).getTime() <= input.now.getTime()
  ) {
    return "CLOSED";
  }

  return "ACTIVE";
}

function matchesFilter(
  posting: ManagePostingItem,
  filter: ManagePostingFilter,
): boolean {
  if (filter === "all") {
    return true;
  }

  if (filter === "filled") {
    return posting.filled;
  }

  return posting.status.toLowerCase() === filter;
}

function matchesPostingTitleSearch(
  posting: ManagePostingItem,
  search: string | undefined,
): boolean {
  if (!search) {
    return true;
  }

  return posting.title.toLowerCase().includes(search.toLowerCase());
}

async function findVolunteerManagePostings(
  userId: string,
): Promise<ManagePostingItem[]> {
  const confirmedApplications = db
    .select({
      opportunityId: volunteerApplication.opportunityId,
      applicantCount:
        sql<number>`count(distinct ${volunteerApplication.applicantId})::int`.as(
          "applicant_count",
        ),
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
      filled: volunteerOpportunity.filled,
      totalView: volunteerOpportunity.totalView,
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
        deadline: row.deadline,
        now,
      }),
      filled: row.filled,
      applicantCount,
      capacity,
      views: toInteger(row.totalView),
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

  const confirmedApplicationsByRole = db
    .select({
      launchpadRoleId: launchpadApplication.launchpadRoleId,
      confirmedCount: sql<number>`count(*)::int`.as("confirmed_count"),
    })
    .from(launchpadApplication)
    .where(eq(launchpadApplication.status, "CONFIRMED"))
    .groupBy(launchpadApplication.launchpadRoleId)
    .as("confirmed_launchpad_applications_by_role");

  const filledLaunchpads = db
    .select({
      launchpadId: launchpadRole.launchpadId,
      filled:
        sql<boolean>`bool_and(coalesce(${confirmedApplicationsByRole.confirmedCount}, 0) >= ${launchpadRole.capacity})`.as(
          "filled",
        ),
    })
    .from(launchpadRole)
    .leftJoin(
      confirmedApplicationsByRole,
      eq(confirmedApplicationsByRole.launchpadRoleId, launchpadRole.id),
    )
    .groupBy(launchpadRole.launchpadId)
    .as("filled_launchpads");

  const rows: ProjectPostingRow[] = await db
    .select({
      id: launchpad.id,
      title: launchpad.name,
      description: launchpad.description,
      imageKey: launchpad.coverKey,
      totalView: launchpad.totalView,
      applicantCount: sql<number>`coalesce(${confirmedApplications.applicantCount}, 0)`,
      capacity: sql<number>`coalesce(${roleCapacities.capacity}, 0)`,
      filled: sql<boolean>`coalesce(${filledLaunchpads.filled}, false)`,
      deadline: launchpad.deadline,
      createdAt: launchpad.createdAt,
    })
    .from(launchpad)
    .leftJoin(
      confirmedApplications,
      eq(confirmedApplications.launchpadId, launchpad.id),
    )
    .leftJoin(roleCapacities, eq(roleCapacities.launchpadId, launchpad.id))
    .leftJoin(filledLaunchpads, eq(filledLaunchpads.launchpadId, launchpad.id))
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
        deadline: row.deadline,
        now,
      }),
      filled: row.filled,
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
        responsibilities: volunteerRole.responsibilities,
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

  const applicants = buildVolunteerManagePostingApplicants(
    postingId,
    rows as VolunteerManagePostingRow[],
  );

  return buildManagePostingDetail(
    posting,
    applicants,
    query,
    buildVolunteerStatsStatuses(postingId, applicants),
  );
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
        description: launchpadRole.description,
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
    roles: [
      {
        applicationId: row.application.id,
        id: row.role.id,
        title: row.role.title,
        description: row.role.description,
        status: row.application.status,
        appliedAt: row.application.createdAt,
        updatedAt: row.application.updatedAt,
      },
    ],
    topPick: null,
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
  statsStatuses = applicants.map((applicant) => applicant.status),
): ManagePostingDetail {
  const statuses = buildApplicantStatusCounts(statsStatuses);
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
      totalApplicants: statsStatuses.length - statuses.WITHDRAWN,
      recruited: statuses.CONFIRMED,
      capacity: posting.capacity,
      statuses,
    },
    applicants: pageRows,
    pagination,
  };
}

async function findVolunteerManagePostingApplication(
  userId: string,
  postingId: string,
  applicationId: string,
): Promise<ManagePostingApplicationDetail | null> {
  const [row] = await db
    .select({
      application: volunteerApplication,
      role: {
        id: volunteerRole.id,
        title: volunteerRole.title,
        responsibilities: volunteerRole.responsibilities,
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
        eq(volunteerApplication.id, applicationId),
        eq(volunteerApplication.opportunityId, postingId),
        eq(volunteerOpportunity.createdBy, userId),
      ),
    )
    .limit(1);

  if (!row) {
    return null;
  }

  const groupRows = await db
    .select({
      application: volunteerApplication,
      role: {
        id: volunteerRole.id,
        title: volunteerRole.title,
        responsibilities: volunteerRole.responsibilities,
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
        eq(volunteerApplication.applicantId, row.application.applicantId),
        eq(volunteerOpportunity.createdBy, userId),
      ),
    )
    .orderBy(desc(volunteerApplication.createdAt));

  const applicant = buildVolunteerManagePostingApplicants(
    postingId,
    groupRows as VolunteerManagePostingRow[],
  ).find((candidate) =>
    candidate.roles.some((role) => role.applicationId === applicationId),
  );

  if (applicant) {
    const requestedRole = applicant.roles.find(
      (role) => role.applicationId === applicationId,
    );

    return {
      applicant: {
        ...applicant,
        id: applicationId,
        role: requestedRole
          ? {
              id: requestedRole.id,
              title: requestedRole.title,
              description: requestedRole.description,
            }
          : applicant.role,
      },
    };
  }

  return {
    applicant: {
      id: row.application.id,
      candidate: row.candidate,
      role: {
        id: row.role.id,
        title: row.role.title,
        description: getVolunteerRoleDescription(row.role.responsibilities),
      },
      roles: [
        {
          applicationId: row.application.id,
          id: row.role.id,
          title: row.role.title,
          description: getVolunteerRoleDescription(row.role.responsibilities),
          status: row.application.status,
          appliedAt: row.application.createdAt,
          updatedAt: row.application.updatedAt,
        },
      ],
      topPick: row.application.topPick ? row.role.id : null,
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
    },
  };
}

async function findProjectManagePostingApplication(
  userId: string,
  postingId: string,
  applicationId: string,
): Promise<ManagePostingApplicationDetail | null> {
  const [row] = await db
    .select({
      application: launchpadApplication,
      role: {
        id: launchpadRole.id,
        title: launchpadRole.title,
        description: launchpadRole.description,
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
        eq(launchpadApplication.id, applicationId),
        eq(launchpadApplication.launchpadId, postingId),
        eq(launchpad.createdBy, userId),
      ),
    )
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    applicant: {
      id: row.application.id,
      candidate: row.candidate,
      role: row.role,
      roles: [
        {
          applicationId: row.application.id,
          id: row.role.id,
          title: row.role.title,
          description: row.role.description,
          status: row.application.status,
          appliedAt: row.application.createdAt,
          updatedAt: row.application.updatedAt,
        },
      ],
      topPick: null,
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
    },
  };
}

export async function findManagePostingApplication(
  userId: string,
  params: GetManagePostingApplicationParam,
): Promise<ManagePostingApplicationDetail | null> {
  if (params.sourceType === "volunteer") {
    return findVolunteerManagePostingApplication(
      userId,
      params.postingId,
      params.applicationId,
    );
  }

  return findProjectManagePostingApplication(
    userId,
    params.postingId,
    params.applicationId,
  );
}

async function updateVolunteerManagePostingApplication(
  userId: string,
  postingId: string,
  applicationId: string,
  status: PosterApplicationStatusChange,
): Promise<ManagePostingApplicationUpdateResult> {
  const result = await db.transaction(async (tx) => {
    const [current] = await tx
      .select({
        id: volunteerApplication.id,
        status: volunteerApplication.status,
        roleId: volunteerApplication.roleId,
        applicantId: volunteerApplication.applicantId,
        opportunityId: volunteerApplication.opportunityId,
      })
      .from(volunteerApplication)
      .innerJoin(
        volunteerOpportunity,
        eq(volunteerOpportunity.id, volunteerApplication.opportunityId),
      )
      .where(
        and(
          eq(volunteerApplication.id, applicationId),
          eq(volunteerApplication.opportunityId, postingId),
          eq(volunteerOpportunity.createdBy, userId),
        ),
      )
      .limit(1);

    if (!current) {
      return "not_found" as const;
    }

    if (POSTER_LOCKED_APPLICATION_STATUSES.has(current.status)) {
      return "conflict" as const;
    }

    const statusLogs = buildPosterStatusLogSequence(current.status, status);
    if (statusLogs.length === 0) {
      return "updated" as const;
    }

    if (status === "APPROVED") {
      const [existingApprovedByApplicant] = await tx
        .select({ id: volunteerApplication.id })
        .from(volunteerApplication)
        .where(
          and(
            eq(volunteerApplication.opportunityId, current.opportunityId),
            eq(volunteerApplication.applicantId, current.applicantId),
            sql`${volunteerApplication.id} <> ${current.id}`,
            sql`${volunteerApplication.status} in ('APPROVED', 'CONFIRMED')`,
          ),
        )
        .limit(1);

      if (existingApprovedByApplicant) {
        return "applicant_already_approved" as const;
      }

      const [role] = await tx
        .select({
          capacity: volunteerRole.capacity,
        })
        .from(volunteerRole)
        .where(eq(volunteerRole.id, current.roleId))
        .for("update");

      if (!role) {
        return "not_found" as const;
      }

      const [reservedRow] = await tx
        .select({
          count: sql<number>`count(*)::int`,
        })
        .from(volunteerApplication)
        .where(
          and(
            eq(volunteerApplication.roleId, current.roleId),
            sql`${volunteerApplication.status} in ('APPROVED', 'CONFIRMED')`,
          ),
        );
      const reservedCount = toInteger(reservedRow?.count);

      if (reservedCount >= role.capacity) {
        return "role_filled" as const;
      }
    }

    const [updated] = await tx
      .update(volunteerApplication)
      .set({ status, updatedAt: sql`now()` })
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

    await tx.insert(volunteerApplicationLog).values(
      statusLogs.map((logStatus) => ({
        volunteerApplicationId: applicationId,
        status: logStatus,
        declinedBy: logStatus === "DECLINED" ? ("POSTER" as const) : null,
        createdBy: userId,
      })),
    );

    return "updated" as const;
  });

  if (result !== "updated") {
    return result;
  }

  const detail = await findVolunteerManagePostingApplication(
    userId,
    postingId,
    applicationId,
  );

  return detail ?? "not_found";
}

async function updateProjectManagePostingApplication(
  userId: string,
  postingId: string,
  applicationId: string,
  status: PosterApplicationStatusChange,
): Promise<ManagePostingApplicationUpdateResult> {
  const result = await db.transaction(async (tx) => {
    const [current] = await tx
      .select({
        id: launchpadApplication.id,
        status: launchpadApplication.status,
        launchpadRoleId: launchpadApplication.launchpadRoleId,
      })
      .from(launchpadApplication)
      .innerJoin(launchpad, eq(launchpad.id, launchpadApplication.launchpadId))
      .where(
        and(
          eq(launchpadApplication.id, applicationId),
          eq(launchpadApplication.launchpadId, postingId),
          eq(launchpad.createdBy, userId),
        ),
      )
      .limit(1);

    if (!current) {
      return "not_found" as const;
    }

    if (POSTER_LOCKED_APPLICATION_STATUSES.has(current.status)) {
      return "conflict" as const;
    }

    const statusLogs = buildPosterStatusLogSequence(current.status, status);
    if (statusLogs.length === 0) {
      return "updated" as const;
    }

    if (status === "APPROVED") {
      const [role] = await tx
        .select({
          capacity: launchpadRole.capacity,
        })
        .from(launchpadRole)
        .where(eq(launchpadRole.id, current.launchpadRoleId))
        .for("update");

      if (!role) {
        return "not_found" as const;
      }

      const [reservedRow] = await tx
        .select({
          count: sql<number>`count(*)::int`,
        })
        .from(launchpadApplication)
        .where(
          and(
            eq(launchpadApplication.launchpadRoleId, current.launchpadRoleId),
            sql`${launchpadApplication.status} in ('APPROVED', 'CONFIRMED')`,
          ),
        );
      const reservedCount = toInteger(reservedRow?.count);

      if (reservedCount >= role.capacity) {
        return "role_filled" as const;
      }
    }

    const [updated] = await tx
      .update(launchpadApplication)
      .set({ status, updatedAt: sql`now()` })
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

    await tx.insert(launchpadApplicationLog).values(
      statusLogs.map((logStatus) => ({
        launchpadApplicationId: applicationId,
        status: logStatus,
        declinedBy: logStatus === "DECLINED" ? ("POSTER" as const) : null,
        createdBy: userId,
      })),
    );

    return "updated" as const;
  });

  if (result !== "updated") {
    return result;
  }

  const detail = await findProjectManagePostingApplication(
    userId,
    postingId,
    applicationId,
  );

  return detail ?? "not_found";
}

export async function updateManagePostingApplication(
  userId: string,
  params: ChangeManagePostingApplicationStatusParam,
): Promise<ManagePostingApplicationUpdateResult> {
  const status = getPosterApplicationStatusChange(params.statusAction);

  if (params.sourceType === "volunteer") {
    return updateVolunteerManagePostingApplication(
      userId,
      params.postingId,
      params.applicationId,
      status,
    );
  }

  return updateProjectManagePostingApplication(
    userId,
    params.postingId,
    params.applicationId,
    status,
  );
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
    .filter(
      (posting) =>
        matchesFilter(posting, query.filter) &&
        matchesPostingTitleSearch(posting, query.search),
    )
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
