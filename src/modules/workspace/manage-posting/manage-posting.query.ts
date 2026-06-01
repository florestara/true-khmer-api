import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "../../../db";
import {
  launchpad,
  launchpadActionLog,
  launchpadApplication,
  launchpadApplicationLog,
  launchpadRole,
  user,
  userProfile,
  volunteerApplication,
  volunteerApplicationLog,
  volunteerOpportunity,
  volunteerOpportunityActionLog,
  volunteerRole,
  workspaceApplicantNote,
  workspaceCandidateBlock,
} from "../../../db/schema";
import {
  buildPagePagination,
  type PagePagination,
} from "../../../utils/page-pagination.helper";
import type {
  ChangeManagePostingApplicationStatusParam,
  DeclineManagePostingApplicationQuery,
  ExtendManagePostingDeadlineBody,
  GetManagePostingApplicationParam,
  GetManagePostingCandidateParam,
  GetManagePostingDetailParam,
  GetManagePostingDetailQuery,
  GetManagePostingsQuery,
  ManagePostingApplicantFilter,
  ManagePostingFilter,
  ManagePostingStatusAction,
  ManagePostingStatus,
  UpsertManagePostingCandidateNoteBody,
  UpdateManagePostingActionParam,
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
type ManagePostingCandidateFilterStatus = Exclude<
  ManagePostingApplicantFilter,
  "all"
>;

type ManagePostingApplicationRole = {
  applicationId: string;
  roleId: string;
  title: string;
  description: string | null;
  status: ManagePostingApplicantStatus;
  appliedAt: string;
  updatedAt: string;
};

type ManagePostingSubmission = {
  submissionKey: string;
  roles: ManagePostingApplicationRole[];
  topPick: string | null;
  appliedAt: string;
  updatedAt: string;
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

type ManagePostingApplicantPrivateNote = {
  id: string;
  note: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type ManagePostingItem = {
  id: string;
  sourceType: ManagePostingSourceType;
  title: string;
  description: string | null;
  imageKey: string | null;
  status: ManagePostingStatus;
  filled: boolean;
  roleCount: number;
  applicantCount: number;
  confirmedCount: number;
  capacity: number;
  views: number;
  deadline: string | null;
  isEditable: boolean;
  createdAt: string;
};

export type ManagePostingsResult = {
  postings: ManagePostingItem[];
  pagination: PagePagination;
};

type ManagePostingApplicant = {
  candidate: {
    id: string;
    name: string;
    email: string;
    phoneNumber: string | null;
    telegramUsername: string | null;
    avatarUrl: string | null;
    avatarKey: string | null;
  };
  submissions: ManagePostingSubmission[];
  submissionCount: number;
  totalRoleApplied: number;
  overallStatus: ManagePostingApplicantStatus;
  lastAppliedAt: string;
  updatedAt: string;
  contact: {
    email: string;
    phoneNumber: string | null;
    telegramUsername: string | null;
  };
  privateNote: ManagePostingApplicantPrivateNote | null;
};

type ManagePostingApplicantAccumulator = ManagePostingApplicant & {
  effectiveStatus: ManagePostingApplicantStatus;
};

type ManagePostingDetail = {
  posting: ManagePostingItem;
  stats: {
    pending: number;
    totalApplicants: number;
    recruited: number;
    capacity: number;
    statuses: Record<ManagePostingApplicantStatus, number>;
    filterCounts: Record<ManagePostingApplicantFilter, number>;
  };
  applicants: ManagePostingApplicant[];
  pagination: PagePagination;
};

type ManagePostingCandidateDetail = {
  applicant: ManagePostingApplicant;
};

type PosterApplicationStatusChange = "UNDER_REVIEW" | "APPROVED";
type ManagePostingApplicationUpdateResult =
  | "not_found"
  | "conflict"
  | "role_filled"
  | "applicant_already_approved"
  | ManagePostingCandidateDetail;
type ManagePostingApplicationDeclineResult =
  | "not_found"
  | "conflict"
  | ManagePostingCandidateDetail;
type ManagePostingActionFailure =
  | "not_found"
  | "not_in_progress"
  | "cancel_not_allowed"
  | "close_not_allowed"
  | "delete_not_allowed"
  | "live_has_applicants";
type ManagePostingActionResult = ManagePostingActionFailure | ManagePostingItem;
type ManagePostingDeadlineUpdateFailure =
  | "not_found"
  | "deadline_extension_not_allowed"
  | "deadline_not_later";
type ManagePostingDeadlineUpdateResult =
  | ManagePostingDeadlineUpdateFailure
  | ManagePostingItem;
type PostingLogAction = "CANCEL" | "CLOSE" | "DELETE" | "COMPLETE";
type PostingActionDecision = {
  action: PostingLogAction;
  nextStatus: ManagePostingStatus;
  deadline?: string;
  deletedAt?: string;
};

const POSTING_ACTION_LOG_NAME: Record<PostingLogAction, string> = {
  CANCEL: "Posting canceled",
  CLOSE: "Posting closed",
  DELETE: "Posting deleted",
  COMPLETE: "Posting completed",
};
const POSTING_DEADLINE_EXTENSION_LOG_NAME = "Posting deadline extended";
const MANAGE_POSTING_EDITABLE_STATUSES = new Set<ManagePostingStatus>([
  "LIVE",
  "DRAFT",
]);
const DEADLINE_EXTENSION_SOURCE_STATUS: ManagePostingStatus = "IN_PROGRESS";
const DEADLINE_EXTENSION_REOPEN_STATUS: ManagePostingStatus = "LIVE";

const POSTER_LOCKED_APPLICATION_STATUSES = new Set<ManagePostingApplicantStatus>(
  ["CONFIRMED", "DECLINED", "COMPLETED", "WITHDRAWN"],
);

function getPosterApplicationStatusChange(
  statusAction: ManagePostingStatusAction,
): PosterApplicationStatusChange {
  if (statusAction === "under_review") {
    return "UNDER_REVIEW";
  }

  return "APPROVED";
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

function buildPosterDeclineLogSequence(
  currentStatus: ManagePostingApplicantStatus,
): Array<"UNDER_REVIEW" | "DECLINED"> {
  if (currentStatus === "DECLINED") {
    return [];
  }

  if (currentStatus === "SUBMITTED") {
    return ["UNDER_REVIEW", "DECLINED"];
  }

  return ["DECLINED"];
}

function resolvePostingActionDecision(input: {
  postingAction: UpdateManagePostingActionParam["postingAction"];
  currentStatus: ManagePostingStatus;
  applicantCount: number;
}): PostingActionDecision | Exclude<ManagePostingActionFailure, "not_found"> {
  const { postingAction, currentStatus, applicantCount } = input;

  if (postingAction === "mark_complete") {
    if (currentStatus !== "IN_PROGRESS") {
      return "not_in_progress";
    }

    return {
      action: "COMPLETE",
      nextStatus: "COMPLETED",
    };
  }

  if (postingAction === "close") {
    if (currentStatus !== "LIVE") {
      return "close_not_allowed";
    }

    return {
      action: "CLOSE",
      nextStatus: "IN_PROGRESS",
      deadline: new Date().toISOString(),
    };
  }

  if (postingAction === "cancel") {
    if (currentStatus === "LIVE" && applicantCount === 0) {
      return "cancel_not_allowed";
    }

    if (currentStatus !== "LIVE" && currentStatus !== "IN_PROGRESS") {
      return "cancel_not_allowed";
    }

    return {
      action: "CANCEL",
      nextStatus: "CANCELED",
    };
  }

  if (currentStatus === "LIVE" && applicantCount > 0) {
    return "live_has_applicants";
  }

  if (currentStatus !== "DRAFT" && currentStatus !== "LIVE") {
    return "delete_not_allowed";
  }

  return {
    action: "DELETE",
    nextStatus: "DELETED",
    deletedAt: new Date().toISOString(),
  };
}

type VolunteerPostingRow = {
  id: string;
  title: string;
  description: string | null;
  imageKey: string | null;
  rawStatus:
    | "DRAFT"
    | "LIVE"
    | "IN_PROGRESS"
    | "COMPLETED"
    | "CANCELED"
    | "DELETED";
  filled: boolean;
  totalView: number;
  roleCount: number;
  applicantCount: number;
  confirmedCount: number;
  capacity: number;
  deadline: string;
  createdAt: string;
};

type ProjectPostingRow = {
  id: string;
  title: string;
  description: string | null;
  imageKey: string | null;
  rawStatus:
    | "DRAFT"
    | "LIVE"
    | "IN_PROGRESS"
    | "COMPLETED"
    | "CANCELED"
    | "DELETED";
  totalView: number;
  roleCount: number;
  applicantCount: number;
  confirmedCount: number;
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

function resolveApplicantOverallStatus(
  statuses: ManagePostingApplicantStatus[],
): ManagePostingApplicantStatus {
  if (statuses.length === 0) {
    return "SUBMITTED";
  }

  const statusSet = new Set(statuses);

  if (statusSet.has("COMPLETED")) {
    return "COMPLETED";
  }
  if (statusSet.has("CONFIRMED")) {
    return "CONFIRMED";
  }
  if (statusSet.has("APPROVED")) {
    return "APPROVED";
  }
  if (statusSet.has("UNDER_REVIEW")) {
    return "UNDER_REVIEW";
  }
  if (statusSet.has("SUBMITTED")) {
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

function resolveApplicantFilterStatuses(
  statuses: ManagePostingApplicantStatus[],
): ManagePostingCandidateFilterStatus[] {
  if (statuses.length === 0) {
    return [];
  }

  const overallStatus = resolveApplicantOverallStatus(statuses);

  if (overallStatus === "CONFIRMED") {
    return ["confirmed"];
  }
  if (overallStatus === "APPROVED") {
    return ["approved"];
  }
  if (statuses.every((status) => status === "DECLINED")) {
    return ["declined"];
  }
  if (overallStatus === "UNDER_REVIEW") {
    return ["in_review"];
  }
  if (overallStatus === "SUBMITTED") {
    return statuses.every((status) => status === "SUBMITTED")
      ? ["new"]
      : ["in_review"];
  }

  return [];
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
  return JSON.stringify({
    applicantId: row.application.applicantId,
    opportunityId: postingId,
    createdAt: row.application.createdAt,
  });
}

function buildVolunteerManagePostingApplicants(
  postingId: string,
  rows: VolunteerManagePostingRow[],
): ManagePostingApplicant[] {
  const applicantById = new Map<string, ManagePostingApplicantAccumulator>();
  const submissionByGroup = new Map<string, ManagePostingSubmission>();

  for (const row of rows) {
    const groupKey = getVolunteerApplicationGroupKey(postingId, row);
    const roleDescription = getVolunteerRoleDescription(row.role.responsibilities);
    const roleItem: ManagePostingApplicationRole = {
      applicationId: row.application.id,
      roleId: row.role.id,
      title: row.role.title,
      description: roleDescription,
      status: row.application.status,
      appliedAt: row.application.createdAt,
      updatedAt: row.application.updatedAt,
    };
    let applicant = applicantById.get(row.candidate.id);

    if (!applicant) {
      applicant = {
        candidate: row.candidate,
        submissions: [],
        submissionCount: 0,
        totalRoleApplied: 0,
        overallStatus: row.application.status,
        effectiveStatus: row.application.status,
        lastAppliedAt: row.application.createdAt,
        updatedAt: row.application.updatedAt,
        contact: {
          email: row.candidate.email,
          phoneNumber: row.candidate.phoneNumber,
          telegramUsername: row.candidate.telegramUsername,
        },
        privateNote: null,
      };
      applicantById.set(row.candidate.id, applicant);
    }

    let submission = submissionByGroup.get(groupKey);

    if (!submission) {
      submission = {
        submissionKey: row.application.createdAt,
        roles: [],
        topPick: row.application.topPick ? row.role.id : null,
        appliedAt: row.application.createdAt,
        updatedAt: row.application.updatedAt,
        volunteer: {
          availability: row.application.availability,
          relevantExperience: row.application.relevantExperience,
          supportingDocuments: row.application.supportingDocuments as Array<{
            name: string;
            key: string;
          }>,
        },
        project: null,
      };
      submissionByGroup.set(groupKey, submission);
      applicant.submissions.push(submission);
    }

    submission.roles.push(roleItem);
    if (Date.parse(row.application.updatedAt) > Date.parse(submission.updatedAt)) {
      submission.updatedAt = row.application.updatedAt;
    }
    if (row.application.topPick) {
      submission.topPick = row.role.id;
    }

    applicant.effectiveStatus = resolveVolunteerStatsStatus(
      applicant.effectiveStatus,
      row.application.status,
    );
    if (
      Date.parse(row.application.createdAt) >
      Date.parse(applicant.lastAppliedAt)
    ) {
      applicant.lastAppliedAt = row.application.createdAt;
    }
    if (Date.parse(row.application.updatedAt) > Date.parse(applicant.updatedAt)) {
      applicant.updatedAt = row.application.updatedAt;
    }
  }

  return [...applicantById.values()].map((applicant) => {
    const submissions = applicant.submissions
      .map((submission) => ({
        ...submission,
        roles: submission.roles.sort((left, right) =>
          left.title.localeCompare(right.title),
        ),
      }))
      .sort(
        (left, right) =>
          Date.parse(right.appliedAt) - Date.parse(left.appliedAt),
      );

    const roleStatuses = submissions.flatMap((submission) =>
      submission.roles.map((role) => role.status),
    );

    return {
      candidate: applicant.candidate,
      submissions,
      submissionCount: submissions.length,
      totalRoleApplied: submissions.reduce(
        (count, submission) => count + submission.roles.length,
        0,
      ),
      overallStatus: resolveApplicantOverallStatus(roleStatuses),
      lastAppliedAt: applicant.lastAppliedAt,
      updatedAt: applicant.updatedAt,
      contact: applicant.contact,
      privateNote: applicant.privateNote,
    };
  });
}

function getApplicantStatsStatuses(
  applicants: ManagePostingApplicant[],
): ManagePostingApplicantStatus[] {
  return applicants.map((applicant) => applicant.overallStatus);
}

function getApplicantFilterStatuses(
  applicant: ManagePostingApplicant,
): ManagePostingCandidateFilterStatus[] {
  const roleStatuses = applicant.submissions.flatMap((submission) =>
    submission.roles.map((role) => role.status),
  );

  return resolveApplicantFilterStatuses(roleStatuses);
}

function buildApplicantFilterCounts(applicants: ManagePostingApplicant[]) {
  const counts: Record<ManagePostingApplicantFilter, number> = {
    all: applicants.length,
    new: 0,
    in_review: 0,
    approved: 0,
    confirmed: 0,
    declined: 0,
  };

  for (const applicant of applicants) {
    for (const filterStatus of getApplicantFilterStatuses(applicant)) {
      counts[filterStatus] += 1;
    }
  }

  return counts;
}

function getNoteSourceType(
  sourceType: GetManagePostingDetailParam["sourceType"],
): ManagePostingSourceType {
  return sourceType === "volunteer" ? "VOLUNTEER" : "PROJECT";
}

function mapApplicantPrivateNote(
  note: typeof workspaceApplicantNote.$inferSelect,
): ManagePostingApplicantPrivateNote {
  return {
    id: note.id,
    note: note.note,
    createdBy: note.createdBy,
    updatedBy: note.updatedBy,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
}

async function findWorkspaceApplicantNote(
  sourceType: ManagePostingSourceType,
  postingId: string,
  applicantId: string,
): Promise<ManagePostingApplicantPrivateNote | null> {
  const [note] = await db
    .select()
    .from(workspaceApplicantNote)
    .where(
      and(
        eq(workspaceApplicantNote.sourceType, sourceType),
        eq(workspaceApplicantNote.postingId, postingId),
        eq(workspaceApplicantNote.applicantId, applicantId),
      ),
    )
    .limit(1);

  return note ? mapApplicantPrivateNote(note) : null;
}

async function attachApplicantPrivateNote(
  applicant: ManagePostingApplicant,
  sourceType: ManagePostingSourceType,
  postingId: string,
): Promise<ManagePostingApplicant> {
  return {
    ...applicant,
    privateNote: await findWorkspaceApplicantNote(
      sourceType,
      postingId,
      applicant.candidate.id,
    ),
  };
}

type ProjectManagePostingRow = {
  application: typeof launchpadApplication.$inferSelect;
  role: {
    id: string;
    title: string;
    description: string | null;
  };
  candidate: ManagePostingApplicant["candidate"];
};

function getProjectApplicationGroupKey(
  postingId: string,
  row: Pick<ProjectManagePostingRow, "application">,
): string {
  return JSON.stringify({
    applicantId: row.application.createdBy,
    launchpadId: postingId,
    createdAt: row.application.createdAt,
  });
}

function buildProjectManagePostingApplicants(
  postingId: string,
  rows: ProjectManagePostingRow[],
): ManagePostingApplicant[] {
  const applicantById = new Map<string, ManagePostingApplicantAccumulator>();
  const submissionByGroup = new Map<string, ManagePostingSubmission>();

  for (const row of rows) {
    const groupKey = getProjectApplicationGroupKey(postingId, row);
    const roleItem: ManagePostingApplicationRole = {
      applicationId: row.application.id,
      roleId: row.role.id,
      title: row.role.title,
      description: row.role.description,
      status: row.application.status,
      appliedAt: row.application.createdAt,
      updatedAt: row.application.updatedAt,
    };
    let applicant = applicantById.get(row.candidate.id);

    if (!applicant) {
      applicant = {
        candidate: row.candidate,
        submissions: [],
        submissionCount: 0,
        totalRoleApplied: 0,
        overallStatus: row.application.status,
        effectiveStatus: row.application.status,
        lastAppliedAt: row.application.createdAt,
        updatedAt: row.application.updatedAt,
        contact: {
          email: row.candidate.email,
          phoneNumber: row.candidate.phoneNumber,
          telegramUsername: row.candidate.telegramUsername,
        },
        privateNote: null,
      };
      applicantById.set(row.candidate.id, applicant);
    }

    let submission = submissionByGroup.get(groupKey);

    if (!submission) {
      submission = {
        submissionKey: row.application.createdAt,
        roles: [],
        topPick: row.application.topPick ? row.role.id : null,
        appliedAt: row.application.createdAt,
        updatedAt: row.application.updatedAt,
        volunteer: null,
        project: {
          motivation: row.application.motivation,
          portfolio: row.application.portfolio ?? "",
          documentKeys: row.application.documentKeys as string[],
          documentNames: row.application.documentNames as string[],
        },
      };
      submissionByGroup.set(groupKey, submission);
      applicant.submissions.push(submission);
    }

    submission.roles.push(roleItem);
    if (Date.parse(row.application.updatedAt) > Date.parse(submission.updatedAt)) {
      submission.updatedAt = row.application.updatedAt;
    }
    if (row.application.topPick) {
      submission.topPick = row.role.id;
    }

    applicant.effectiveStatus = resolveVolunteerStatsStatus(
      applicant.effectiveStatus,
      row.application.status,
    );
    if (
      Date.parse(row.application.createdAt) >
      Date.parse(applicant.lastAppliedAt)
    ) {
      applicant.lastAppliedAt = row.application.createdAt;
    }
    if (Date.parse(row.application.updatedAt) > Date.parse(applicant.updatedAt)) {
      applicant.updatedAt = row.application.updatedAt;
    }
  }

  return [...applicantById.values()].map((applicant) => {
    const submissions = applicant.submissions
      .map((submission) => ({
        ...submission,
        roles: submission.roles.sort((left, right) =>
          left.title.localeCompare(right.title),
        ),
      }))
      .sort(
        (left, right) =>
          Date.parse(right.appliedAt) - Date.parse(left.appliedAt),
      );

    const roleStatuses = submissions.flatMap((submission) =>
      submission.roles.map((role) => role.status),
    );

    return {
      candidate: applicant.candidate,
      submissions,
      submissionCount: submissions.length,
      totalRoleApplied: submissions.reduce(
        (count, submission) => count + submission.roles.length,
        0,
      ),
      overallStatus: resolveApplicantOverallStatus(roleStatuses),
      lastAppliedAt: applicant.lastAppliedAt,
      updatedAt: applicant.updatedAt,
      contact: applicant.contact,
      privateNote: applicant.privateNote,
    };
  });
}

function matchesApplicantStatusFilter(
  filter: ManagePostingApplicantFilter,
  applicant: ManagePostingApplicant,
): boolean {
  if (filter === "all") {
    return true;
  }

  return getApplicantFilterStatuses(applicant).includes(filter);
}

function matchesApplicantSearch(
  search: string | undefined,
  applicant: ManagePostingApplicant,
) {
  if (!search) {
    return true;
  }

  const normalizedSearch = search.toLowerCase();
  return applicant.candidate.name.toLowerCase().includes(normalizedSearch);
}

function derivePostingStatus(input: {
  rawStatus?: VolunteerPostingRow["rawStatus"];
}): ManagePostingStatus {
  return input.rawStatus ?? "LIVE";
}

function isManagePostingEditable(status: ManagePostingStatus): boolean {
  return MANAGE_POSTING_EDITABLE_STATUSES.has(status);
}

function canExtendManagePostingDeadline(status: ManagePostingStatus): boolean {
  return status === DEADLINE_EXTENSION_SOURCE_STATUS;
}

function isDeadlineExtensionLater(
  currentDeadline: string | null,
  nextDeadline: string,
): boolean {
  return (
    currentDeadline !== null &&
    Date.parse(nextDeadline) > Date.parse(currentDeadline)
  );
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
  options: { includeDeleted?: boolean } = {},
): Promise<ManagePostingItem[]> {
  const postingFilters = [eq(volunteerOpportunity.createdBy, userId)];
  if (!options.includeDeleted) {
    postingFilters.push(isNull(volunteerOpportunity.deletedAt));
  }

  const applicantGroups = db
    .select({
      opportunityId: volunteerApplication.opportunityId,
      applicantCount:
        sql<number>`count(distinct ${volunteerApplication.applicantId})::int`.as(
          "applicant_count",
        ),
      confirmedCount:
        sql<number>`count(*) filter (where ${volunteerApplication.status} = 'CONFIRMED')::int`.as(
          "confirmed_count",
        ),
    })
    .from(volunteerApplication)
    .where(sql`${volunteerApplication.status} <> 'WITHDRAWN'`)
    .groupBy(volunteerApplication.opportunityId)
    .as("volunteer_application_groups");

  const roleCapacities = db
    .select({
      opportunityId: volunteerRole.opportunityId,
      roleCount: sql<number>`count(*)::int`.as("role_count"),
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
      roleCount: sql<number>`coalesce(${roleCapacities.roleCount}, 0)`,
      applicantCount: sql<number>`coalesce(${applicantGroups.applicantCount}, 0)`,
      confirmedCount: sql<number>`coalesce(${applicantGroups.confirmedCount}, 0)`,
      capacity: sql<number>`coalesce(${roleCapacities.capacity}, 0)`,
      deadline: volunteerOpportunity.applicationDeadline,
      createdAt: volunteerOpportunity.createdAt,
    })
    .from(volunteerOpportunity)
    .leftJoin(
      applicantGroups,
      eq(applicantGroups.opportunityId, volunteerOpportunity.id),
    )
    .leftJoin(
      roleCapacities,
      eq(roleCapacities.opportunityId, volunteerOpportunity.id),
    )
    .where(and(...postingFilters))
    .orderBy(desc(volunteerOpportunity.createdAt));

  return rows.map((row) => {
    const applicantCount = toInteger(row.applicantCount);
    const capacity = toInteger(row.capacity);
    const status = derivePostingStatus({
      rawStatus: row.rawStatus,
    });

    return {
      id: row.id,
      sourceType: "VOLUNTEER",
      title: row.title,
      description: row.description,
      imageKey: row.imageKey,
      status,
      filled: row.filled,
      roleCount: toInteger(row.roleCount),
      applicantCount,
      confirmedCount: toInteger(row.confirmedCount),
      capacity,
      views: toInteger(row.totalView),
      deadline: row.deadline,
      isEditable: isManagePostingEditable(status),
      createdAt: row.createdAt,
    };
  });
}

async function findProjectManagePostings(
  userId: string,
  options: { includeDeleted?: boolean } = {},
): Promise<ManagePostingItem[]> {
  const postingFilters = [eq(launchpad.createdBy, userId)];
  if (!options.includeDeleted) {
    postingFilters.push(isNull(launchpad.deletedAt));
  }

  const applicantGroups = db
    .select({
      launchpadId: launchpadApplication.launchpadId,
      applicantCount:
        sql<number>`count(distinct ${launchpadApplication.createdBy})::int`.as(
          "applicant_count",
        ),
      confirmedCount:
        sql<number>`count(*) filter (where ${launchpadApplication.status} = 'CONFIRMED')::int`.as(
          "confirmed_count",
        ),
    })
    .from(launchpadApplication)
    .where(sql`${launchpadApplication.status} <> 'WITHDRAWN'`)
    .groupBy(launchpadApplication.launchpadId)
    .as("launchpad_application_groups");

  const roleCapacities = db
    .select({
      launchpadId: launchpadRole.launchpadId,
      roleCount: sql<number>`count(*)::int`.as("role_count"),
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
      rawStatus: launchpad.status,
      totalView: launchpad.totalView,
      roleCount: sql<number>`coalesce(${roleCapacities.roleCount}, 0)`,
      applicantCount: sql<number>`coalesce(${applicantGroups.applicantCount}, 0)`,
      confirmedCount: sql<number>`coalesce(${applicantGroups.confirmedCount}, 0)`,
      capacity: sql<number>`coalesce(${roleCapacities.capacity}, 0)`,
      filled: sql<boolean>`coalesce(${filledLaunchpads.filled}, false)`,
      deadline: launchpad.deadline,
      createdAt: launchpad.createdAt,
    })
    .from(launchpad)
    .leftJoin(
      applicantGroups,
      eq(applicantGroups.launchpadId, launchpad.id),
    )
    .leftJoin(roleCapacities, eq(roleCapacities.launchpadId, launchpad.id))
    .leftJoin(filledLaunchpads, eq(filledLaunchpads.launchpadId, launchpad.id))
    .where(and(...postingFilters))
    .orderBy(desc(launchpad.createdAt));

  return rows.map((row) => {
    const applicantCount = toInteger(row.applicantCount);
    const capacity = toInteger(row.capacity);
    const status = derivePostingStatus({
      rawStatus: row.rawStatus,
    });

    return {
      id: row.id,
      sourceType: "PROJECT",
      title: row.title,
      description: row.description,
      imageKey: row.imageKey,
      status,
      filled: row.filled,
      roleCount: toInteger(row.roleCount),
      applicantCount,
      confirmedCount: toInteger(row.confirmedCount),
      capacity,
      views: toInteger(row.totalView),
      deadline: row.deadline,
      isEditable: isManagePostingEditable(status),
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
        sql`${volunteerApplication.status} <> 'WITHDRAWN'`,
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
    getApplicantStatsStatuses(applicants),
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
        sql`${launchpadApplication.status} <> 'WITHDRAWN'`,
        eq(launchpad.createdBy, userId),
      ),
    )
    .orderBy(desc(launchpadApplication.createdAt));

  const applicants = buildProjectManagePostingApplicants(
    postingId,
    rows as ProjectManagePostingRow[],
  );

  return buildManagePostingDetail(posting, applicants, query);
}

function buildManagePostingDetail(
  posting: ManagePostingItem,
  applicants: ManagePostingApplicant[],
  query: GetManagePostingDetailQuery,
  statsStatuses = applicants.map((applicant) => applicant.overallStatus),
): ManagePostingDetail {
  const statuses = buildApplicantStatusCounts(statsStatuses);
  const filterCounts = buildApplicantFilterCounts(applicants);
  const filteredApplicants = applicants.filter(
    (applicant) =>
      matchesApplicantStatusFilter(query.filter, applicant) &&
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
      pending: filterCounts.new,
      totalApplicants: statsStatuses.length - statuses.WITHDRAWN,
      recruited: filterCounts.confirmed,
      capacity: posting.capacity,
      statuses,
      filterCounts,
    },
    applicants: pageRows,
    pagination,
  };
}

async function findVolunteerManagePostingApplicant(
  userId: string,
  postingId: string,
  applicantId: string,
): Promise<ManagePostingCandidateDetail | null> {
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
        eq(volunteerApplication.applicantId, applicantId),
        sql`${volunteerApplication.status} <> 'WITHDRAWN'`,
        eq(volunteerOpportunity.createdBy, userId),
      ),
    )
    .orderBy(desc(volunteerApplication.createdAt));

  const [applicant] = buildVolunteerManagePostingApplicants(
    postingId,
    groupRows as VolunteerManagePostingRow[],
  );

  if (!applicant) {
    return null;
  }

  return {
    applicant: await attachApplicantPrivateNote(
      applicant,
      "VOLUNTEER",
      postingId,
    ),
  };
}

async function findProjectManagePostingApplicant(
  userId: string,
  postingId: string,
  applicantId: string,
): Promise<ManagePostingCandidateDetail | null> {
  const groupRows = await db
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
        eq(launchpadApplication.createdBy, applicantId),
        sql`${launchpadApplication.status} <> 'WITHDRAWN'`,
        eq(launchpad.createdBy, userId),
      ),
    )
    .orderBy(desc(launchpadApplication.createdAt));

  const [applicant] = buildProjectManagePostingApplicants(
    postingId,
    groupRows as ProjectManagePostingRow[],
  );

  if (!applicant) {
    return null;
  }

  return {
    applicant: await attachApplicantPrivateNote(
      applicant,
      "PROJECT",
      postingId,
    ),
  };
}

export async function findManagePostingCandidate(
  userId: string,
  params: GetManagePostingCandidateParam,
): Promise<ManagePostingCandidateDetail | null> {
  if (params.sourceType === "volunteer") {
    return findVolunteerManagePostingApplicant(
      userId,
      params.postingId,
      params.candidateId,
    );
  }

  return findProjectManagePostingApplicant(
    userId,
    params.postingId,
    params.candidateId,
  );
}

export async function upsertManagePostingCandidateNote(
  userId: string,
  params: GetManagePostingCandidateParam,
  query: UpsertManagePostingCandidateNoteBody,
): Promise<ManagePostingCandidateDetail | null> {
  const existingDetail = await findManagePostingCandidate(userId, params);

  if (!existingDetail) {
    return null;
  }

  const sourceType = getNoteSourceType(params.sourceType);

  await db
    .insert(workspaceApplicantNote)
    .values({
      sourceType,
      postingId: params.postingId,
      applicantId: params.candidateId,
      note: query.note,
      createdBy: userId,
      updatedBy: userId,
    })
    .onConflictDoUpdate({
      target: [
        workspaceApplicantNote.sourceType,
        workspaceApplicantNote.postingId,
        workspaceApplicantNote.applicantId,
      ],
      set: {
        note: query.note,
        updatedBy: userId,
        updatedAt: sql`now()`,
      },
    });

  return findManagePostingCandidate(userId, params);
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
      return {
        outcome: "updated" as const,
        applicantId: current.applicantId,
      };
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
        declinedBy: null,
        createdBy: userId,
      })),
    );

    return {
      outcome: "updated" as const,
      applicantId: current.applicantId,
    };
  });

  if (typeof result === "string") {
    return result;
  }

  const detail = await findVolunteerManagePostingApplicant(
    userId,
    postingId,
    result.applicantId,
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
        launchpadId: launchpadApplication.launchpadId,
        launchpadRoleId: launchpadApplication.launchpadRoleId,
        createdBy: launchpadApplication.createdBy,
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
      return {
        outcome: "updated" as const,
        applicantId: current.createdBy,
      };
    }

    if (status === "APPROVED") {
      const [existingApprovedByApplicant] = await tx
        .select({ id: launchpadApplication.id })
        .from(launchpadApplication)
        .where(
          and(
            eq(launchpadApplication.launchpadId, current.launchpadId),
            eq(launchpadApplication.createdBy, current.createdBy),
            sql`${launchpadApplication.id} <> ${current.id}`,
            sql`${launchpadApplication.status} in ('APPROVED', 'CONFIRMED')`,
          ),
        )
        .limit(1);

      if (existingApprovedByApplicant) {
        return "applicant_already_approved" as const;
      }

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
        declinedBy: null,
        createdBy: userId,
      })),
    );

    return {
      outcome: "updated" as const,
      applicantId: current.createdBy,
    };
  });

  if (typeof result === "string") {
    return result;
  }

  const detail = await findProjectManagePostingApplicant(
    userId,
    postingId,
    result.applicantId,
  );

  return detail ?? "not_found";
}

async function declineVolunteerManagePostingApplication(
  userId: string,
  postingId: string,
  applicationId: string,
  query: DeclineManagePostingApplicationQuery,
): Promise<ManagePostingApplicationDeclineResult> {
  const result = await db.transaction(async (tx) => {
    const [current] = await tx
      .select({
        id: volunteerApplication.id,
        status: volunteerApplication.status,
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

    const [updated] = await tx
      .update(volunteerApplication)
      .set({ status: "DECLINED", updatedAt: sql`now()` })
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
      buildPosterDeclineLogSequence(current.status).map((logStatus) => ({
        volunteerApplicationId: applicationId,
        status: logStatus,
        declinedBy: logStatus === "DECLINED" ? ("POSTER" as const) : null,
        createdBy: userId,
      })),
    );

    if (query.declineAll) {
      const siblingApplications = await tx
        .select({
          id: volunteerApplication.id,
          status: volunteerApplication.status,
        })
        .from(volunteerApplication)
        .where(
          and(
            eq(volunteerApplication.opportunityId, current.opportunityId),
            eq(volunteerApplication.applicantId, current.applicantId),
            sql`${volunteerApplication.id} <> ${current.id}`,
            sql`${volunteerApplication.status} in ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED')`,
          ),
        );

      const declinedApplications = await tx
        .update(volunteerApplication)
        .set({ status: "DECLINED", updatedAt: sql`now()` })
        .where(
          and(
            eq(volunteerApplication.opportunityId, current.opportunityId),
            eq(volunteerApplication.applicantId, current.applicantId),
            sql`${volunteerApplication.id} <> ${current.id}`,
            sql`${volunteerApplication.status} in ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED')`,
          ),
        )
        .returning({ id: volunteerApplication.id });

      if (declinedApplications.length > 0) {
        const declinedApplicationIds = new Set(
          declinedApplications.map((application) => application.id),
        );

        await tx.insert(volunteerApplicationLog).values(
          siblingApplications
            .filter((application) => declinedApplicationIds.has(application.id))
            .flatMap((application) =>
              buildPosterDeclineLogSequence(application.status).map(
                (logStatus) => ({
                  volunteerApplicationId: application.id,
                  status: logStatus,
                  declinedBy:
                    logStatus === "DECLINED" ? ("POSTER" as const) : null,
                  createdBy: userId,
                }),
              ),
            ),
        );
      }
    }

    if (query.blockFutureApply) {
      await tx
        .insert(workspaceCandidateBlock)
        .values({
          sourceType: "VOLUNTEER",
          postingId: current.opportunityId,
          candidateId: current.applicantId,
          status: "ACTIVE",
          createdBy: userId,
          updatedBy: userId,
        })
        .onConflictDoUpdate({
          target: [
            workspaceCandidateBlock.sourceType,
            workspaceCandidateBlock.postingId,
            workspaceCandidateBlock.candidateId,
          ],
          set: {
            status: "ACTIVE",
            updatedBy: userId,
            updatedAt: sql`now()`,
          },
        });
    }

    return {
      outcome: "updated" as const,
      applicantId: current.applicantId,
    };
  });

  if (typeof result === "string") {
    return result;
  }

  const detail = await findVolunteerManagePostingApplicant(
    userId,
    postingId,
    result.applicantId,
  );

  return detail ?? "not_found";
}

async function declineProjectManagePostingApplication(
  userId: string,
  postingId: string,
  applicationId: string,
  query: DeclineManagePostingApplicationQuery,
): Promise<ManagePostingApplicationDeclineResult> {
  const result = await db.transaction(async (tx) => {
    const [current] = await tx
      .select({
        id: launchpadApplication.id,
        status: launchpadApplication.status,
        launchpadId: launchpadApplication.launchpadId,
        createdBy: launchpadApplication.createdBy,
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

    const [updated] = await tx
      .update(launchpadApplication)
      .set({ status: "DECLINED", updatedAt: sql`now()` })
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
      buildPosterDeclineLogSequence(current.status).map((logStatus) => ({
        launchpadApplicationId: applicationId,
        status: logStatus,
        declinedBy: logStatus === "DECLINED" ? ("POSTER" as const) : null,
        createdBy: userId,
      })),
    );

    if (query.declineAll) {
      const siblingApplications = await tx
        .select({
          id: launchpadApplication.id,
          status: launchpadApplication.status,
        })
        .from(launchpadApplication)
        .where(
          and(
            eq(launchpadApplication.launchpadId, current.launchpadId),
            eq(launchpadApplication.createdBy, current.createdBy),
            sql`${launchpadApplication.id} <> ${current.id}`,
            sql`${launchpadApplication.status} in ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED')`,
          ),
        );

      const declinedApplications = await tx
        .update(launchpadApplication)
        .set({ status: "DECLINED", updatedAt: sql`now()` })
        .where(
          and(
            eq(launchpadApplication.launchpadId, current.launchpadId),
            eq(launchpadApplication.createdBy, current.createdBy),
            sql`${launchpadApplication.id} <> ${current.id}`,
            sql`${launchpadApplication.status} in ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED')`,
          ),
        )
        .returning({ id: launchpadApplication.id });

      if (declinedApplications.length > 0) {
        const declinedApplicationIds = new Set(
          declinedApplications.map((application) => application.id),
        );

        await tx.insert(launchpadApplicationLog).values(
          siblingApplications
            .filter((application) => declinedApplicationIds.has(application.id))
            .flatMap((application) =>
              buildPosterDeclineLogSequence(application.status).map(
                (logStatus) => ({
                  launchpadApplicationId: application.id,
                  status: logStatus,
                  declinedBy:
                    logStatus === "DECLINED" ? ("POSTER" as const) : null,
                  createdBy: userId,
                }),
              ),
            ),
        );
      }
    }

    if (query.blockFutureApply) {
      await tx
        .insert(workspaceCandidateBlock)
        .values({
          sourceType: "PROJECT",
          postingId: current.launchpadId,
          candidateId: current.createdBy,
          status: "ACTIVE",
          createdBy: userId,
          updatedBy: userId,
        })
        .onConflictDoUpdate({
          target: [
            workspaceCandidateBlock.sourceType,
            workspaceCandidateBlock.postingId,
            workspaceCandidateBlock.candidateId,
          ],
          set: {
            status: "ACTIVE",
            updatedBy: userId,
            updatedAt: sql`now()`,
          },
        });
    }

    return {
      outcome: "updated" as const,
      applicantId: current.createdBy,
    };
  });

  if (typeof result === "string") {
    return result;
  }

  const detail = await findProjectManagePostingApplicant(
    userId,
    postingId,
    result.applicantId,
  );

  return detail ?? "not_found";
}

export async function declineManagePostingApplication(
  userId: string,
  params: GetManagePostingApplicationParam,
  query: DeclineManagePostingApplicationQuery,
): Promise<ManagePostingApplicationDeclineResult> {
  if (params.sourceType === "volunteer") {
    return declineVolunteerManagePostingApplication(
      userId,
      params.postingId,
      params.applicationId,
      query,
    );
  }

  return declineProjectManagePostingApplication(
    userId,
    params.postingId,
    params.applicationId,
    query,
  );
}

async function updateVolunteerManagePostingAction(
  userId: string,
  params: UpdateManagePostingActionParam,
): Promise<ManagePostingActionResult> {
  const result = await db.transaction(async (tx) => {
    const [current] = await tx
      .select({
        id: volunteerOpportunity.id,
        status: volunteerOpportunity.status,
        deadline: volunteerOpportunity.applicationDeadline,
      })
      .from(volunteerOpportunity)
      .where(
        and(
          eq(volunteerOpportunity.id, params.postingId),
          eq(volunteerOpportunity.createdBy, userId),
          isNull(volunteerOpportunity.deletedAt),
        ),
      )
      .for("update")
      .limit(1);

    if (!current) {
      return "not_found" as const;
    }

    const derivedStatus = derivePostingStatus({
      rawStatus: current.status,
    });
    const [{ applicantCount }] = await tx
      .select({
        applicantCount: sql<number>`count(*)::int`,
      })
      .from(volunteerApplication)
      .where(
        and(
          eq(volunteerApplication.opportunityId, params.postingId),
          sql`${volunteerApplication.status} <> 'WITHDRAWN'`,
        ),
      );

    const normalizedApplicantCount = toInteger(applicantCount);
    const decision = resolvePostingActionDecision({
      postingAction: params.postingAction,
      currentStatus: derivedStatus,
      applicantCount: normalizedApplicantCount,
    });

    if (typeof decision === "string") {
      return decision;
    }

    const [updated] = await tx
      .update(volunteerOpportunity)
      .set({
        status: decision.nextStatus,
        ...(decision.deadline
          ? { applicationDeadline: decision.deadline }
          : {}),
        ...(decision.deletedAt ? { deletedAt: decision.deletedAt } : {}),
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(volunteerOpportunity.id, params.postingId),
          eq(volunteerOpportunity.status, current.status),
          isNull(volunteerOpportunity.deletedAt),
        ),
      )
      .returning({ id: volunteerOpportunity.id });

    if (!updated) {
      return "not_found" as const;
    }

    await tx.insert(volunteerOpportunityActionLog).values({
      opportunityId: params.postingId,
      name: POSTING_ACTION_LOG_NAME[decision.action],
      description: `Workspace posting ${decision.action.toLowerCase()} action`,
      fromData: {
        status: derivedStatus,
        ...(decision.deadline ? { deadline: current.deadline } : {}),
        deletedAt: null,
      },
      toData: {
        status: decision.nextStatus,
        ...(decision.deadline ? { deadline: decision.deadline } : {}),
        deletedAt: decision.deletedAt ?? null,
      },
      status: decision.nextStatus,
      createdBy: userId,
    });

    return updated ? ("updated" as const) : ("not_found" as const);
  });

  if (result !== "updated") {
    return result;
  }

  const posting =
    (
      await findVolunteerManagePostings(userId, {
        includeDeleted: params.postingAction === "delete",
      })
    ).find(
      (item) => item.id === params.postingId,
    ) ?? null;

  return posting ?? "not_found";
}

async function updateProjectManagePostingAction(
  userId: string,
  params: UpdateManagePostingActionParam,
): Promise<ManagePostingActionResult> {
  const result = await db.transaction(async (tx) => {
    const [current] = await tx
      .select({
        id: launchpad.id,
        status: launchpad.status,
        deadline: launchpad.deadline,
      })
      .from(launchpad)
      .where(
        and(
          eq(launchpad.id, params.postingId),
          eq(launchpad.createdBy, userId),
          isNull(launchpad.deletedAt),
        ),
      )
      .for("update")
      .limit(1);

    if (!current) {
      return "not_found" as const;
    }

    const derivedStatus = derivePostingStatus({
      rawStatus: current.status,
    });
    const [{ applicantCount }] = await tx
      .select({
        applicantCount: sql<number>`count(*)::int`,
      })
      .from(launchpadApplication)
      .where(
        and(
          eq(launchpadApplication.launchpadId, params.postingId),
          sql`${launchpadApplication.status} <> 'WITHDRAWN'`,
        ),
      );

    const normalizedApplicantCount = toInteger(applicantCount);
    const decision = resolvePostingActionDecision({
      postingAction: params.postingAction,
      currentStatus: derivedStatus,
      applicantCount: normalizedApplicantCount,
    });

    if (typeof decision === "string") {
      return decision;
    }

    const [updated] = await tx
      .update(launchpad)
      .set({
        status: decision.nextStatus,
        ...(decision.deadline ? { deadline: decision.deadline } : {}),
        ...(decision.deletedAt ? { deletedAt: decision.deletedAt } : {}),
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(launchpad.id, params.postingId),
          eq(launchpad.status, current.status),
          isNull(launchpad.deletedAt),
        ),
      )
      .returning({ id: launchpad.id });

    if (!updated) {
      return "not_found" as const;
    }

    await tx.insert(launchpadActionLog).values({
      launchpadId: params.postingId,
      name: POSTING_ACTION_LOG_NAME[decision.action],
      description: `Workspace posting ${decision.action.toLowerCase()} action`,
      fromData: {
        status: derivedStatus,
        ...(decision.deadline ? { deadline: current.deadline } : {}),
        deletedAt: null,
      },
      toData: {
        status: decision.nextStatus,
        ...(decision.deadline ? { deadline: decision.deadline } : {}),
        deletedAt: decision.deletedAt ?? null,
      },
      status: decision.nextStatus,
      createdBy: userId,
    });

    return updated ? ("updated" as const) : ("not_found" as const);
  });

  if (result !== "updated") {
    return result;
  }

  const posting =
    (
      await findProjectManagePostings(userId, {
        includeDeleted: params.postingAction === "delete",
      })
    ).find(
      (item) => item.id === params.postingId,
    ) ?? null;

  return posting ?? "not_found";
}

export async function updateManagePostingAction(
  userId: string,
  params: UpdateManagePostingActionParam,
): Promise<ManagePostingActionResult> {
  if (params.sourceType === "volunteer") {
    return updateVolunteerManagePostingAction(userId, params);
  }

  return updateProjectManagePostingAction(userId, params);
}

async function extendVolunteerManagePostingDeadline(
  userId: string,
  postingId: string,
  query: ExtendManagePostingDeadlineBody,
): Promise<ManagePostingDeadlineUpdateResult> {
  const result = await db.transaction(async (tx) => {
    const [current] = await tx
      .select({
        id: volunteerOpportunity.id,
        status: volunteerOpportunity.status,
        deadline: volunteerOpportunity.applicationDeadline,
      })
      .from(volunteerOpportunity)
      .where(
        and(
          eq(volunteerOpportunity.id, postingId),
          eq(volunteerOpportunity.createdBy, userId),
          isNull(volunteerOpportunity.deletedAt),
        ),
      )
      .for("update")
      .limit(1);

    if (!current) {
      return "not_found" as const;
    }

    if (!canExtendManagePostingDeadline(current.status)) {
      return "deadline_extension_not_allowed" as const;
    }

    if (!isDeadlineExtensionLater(current.deadline, query.deadline)) {
      return "deadline_not_later" as const;
    }

    const nextStatus = DEADLINE_EXTENSION_REOPEN_STATUS;
    const [updated] = await tx
      .update(volunteerOpportunity)
      .set({
        applicationDeadline: query.deadline,
        status: nextStatus,
        updatedBy: userId,
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(volunteerOpportunity.id, postingId),
          eq(volunteerOpportunity.status, current.status),
          isNull(volunteerOpportunity.deletedAt),
        ),
      )
      .returning({ id: volunteerOpportunity.id });

    if (!updated) {
      return "not_found" as const;
    }

    await tx.insert(volunteerOpportunityActionLog).values({
      opportunityId: postingId,
      name: POSTING_DEADLINE_EXTENSION_LOG_NAME,
      description: "Workspace posting deadline extension",
      fromData: {
        status: derivePostingStatus({ rawStatus: current.status }),
        deadline: current.deadline,
      },
      toData: {
        status: nextStatus,
        deadline: query.deadline,
      },
      status: nextStatus,
      createdBy: userId,
    });

    return "updated" as const;
  });

  if (result !== "updated") {
    return result;
  }

  const posting =
    (await findVolunteerManagePostings(userId)).find(
      (item) => item.id === postingId,
    ) ?? null;

  return posting ?? "not_found";
}

async function extendProjectManagePostingDeadline(
  userId: string,
  postingId: string,
  query: ExtendManagePostingDeadlineBody,
): Promise<ManagePostingDeadlineUpdateResult> {
  const result = await db.transaction(async (tx) => {
    const [current] = await tx
      .select({
        id: launchpad.id,
        status: launchpad.status,
        deadline: launchpad.deadline,
      })
      .from(launchpad)
      .where(
        and(
          eq(launchpad.id, postingId),
          eq(launchpad.createdBy, userId),
          isNull(launchpad.deletedAt),
        ),
      )
      .for("update")
      .limit(1);

    if (!current) {
      return "not_found" as const;
    }

    if (!canExtendManagePostingDeadline(current.status)) {
      return "deadline_extension_not_allowed" as const;
    }

    if (!isDeadlineExtensionLater(current.deadline, query.deadline)) {
      return "deadline_not_later" as const;
    }

    const nextStatus = DEADLINE_EXTENSION_REOPEN_STATUS;
    const [updated] = await tx
      .update(launchpad)
      .set({
        deadline: query.deadline,
        status: nextStatus,
        updatedBy: userId,
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(launchpad.id, postingId),
          eq(launchpad.status, current.status),
          isNull(launchpad.deletedAt),
        ),
      )
      .returning({ id: launchpad.id });

    if (!updated) {
      return "not_found" as const;
    }

    await tx.insert(launchpadActionLog).values({
      launchpadId: postingId,
      name: POSTING_DEADLINE_EXTENSION_LOG_NAME,
      description: "Workspace posting deadline extension",
      fromData: {
        status: derivePostingStatus({ rawStatus: current.status }),
        deadline: current.deadline,
      },
      toData: {
        status: nextStatus,
        deadline: query.deadline,
      },
      status: nextStatus,
      createdBy: userId,
    });

    return "updated" as const;
  });

  if (result !== "updated") {
    return result;
  }

  const posting =
    (await findProjectManagePostings(userId)).find(
      (item) => item.id === postingId,
    ) ?? null;

  return posting ?? "not_found";
}

export async function extendManagePostingDeadline(
  userId: string,
  params: GetManagePostingDetailParam,
  query: ExtendManagePostingDeadlineBody,
): Promise<ManagePostingDeadlineUpdateResult> {
  if (params.sourceType === "volunteer") {
    return extendVolunteerManagePostingDeadline(userId, params.postingId, query);
  }

  return extendProjectManagePostingDeadline(userId, params.postingId, query);
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

export async function findManagePostingApplicantNotificationTargets(
  userId: string,
  params: GetManagePostingDetailParam,
): Promise<Array<{ recipientUserId: string; postingTitle: string }>> {
  const rows =
    params.sourceType === "volunteer"
      ? await db
          .select({
            recipientUserId: volunteerApplication.applicantId,
            postingTitle: volunteerOpportunity.title,
          })
          .from(volunteerApplication)
          .innerJoin(
            volunteerOpportunity,
            eq(volunteerOpportunity.id, volunteerApplication.opportunityId),
          )
          .where(
            and(
              eq(volunteerApplication.opportunityId, params.postingId),
              eq(volunteerOpportunity.createdBy, userId),
              sql`${volunteerApplication.status} <> 'WITHDRAWN'`,
              isNull(volunteerOpportunity.deletedAt),
            ),
          )
      : await db
          .select({
            recipientUserId: launchpadApplication.createdBy,
            postingTitle: launchpad.name,
          })
          .from(launchpadApplication)
          .innerJoin(
            launchpad,
            eq(launchpad.id, launchpadApplication.launchpadId),
          )
          .where(
            and(
              eq(launchpadApplication.launchpadId, params.postingId),
              eq(launchpad.createdBy, userId),
              sql`${launchpadApplication.status} <> 'WITHDRAWN'`,
              isNull(launchpad.deletedAt),
            ),
          );

  const targetByUserId = new Map<string, string>();
  for (const row of rows) {
    targetByUserId.set(row.recipientUserId, row.postingTitle);
  }

  return Array.from(targetByUserId, ([recipientUserId, postingTitle]) => ({
    recipientUserId,
    postingTitle,
  }));
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
