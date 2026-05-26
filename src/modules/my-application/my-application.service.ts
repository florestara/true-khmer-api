import type { Context } from "hono";
import { getAuthUserId } from "../auth/utils/get-auth";
import {
  findMyProjectApplicationDetail,
  findMyProjectApplications,
  findMyVolunteerApplicationDetail,
  findMyVolunteerApplications,
  updateMyApplicationArchived,
  updateMyApplicationStatus,
  type MySpaceProjectApplication,
  type MySpaceVolunteerApplication,
} from "./my-application.query";
import type {
  ChangeMyApplicationArchiveParam,
  ChangeMyApplicationStatusParam,
  GetMyApplicationDetailParam,
  GetMyApplicationsQuery,
} from "./schema/my-application.request.schema";

type MyApplicationStatus =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "DECLINED"
  | "CONFIRMED"
  | "COMPLETED"
  | "WITHDRAWN";

type MyApplicationItem = {
  sourceType: "VOLUNTEER" | "PROJECT";
  opportunityId: string;
  title: string;
  imageKey: string | null;
  appliedAt: string;
  updatedAt: string;
  deadline: string | null;
  status: MyApplicationStatus;
  roles: MyApplicationRoleItem[];
  topPick: string | null;
  category: {
    id: string;
    name: string;
  } | null;
  location: {
    id: string;
    name: string;
  } | null;
};

type MyApplicationRecord = MyApplicationItem & {
  archived: boolean;
};

type MyApplicationRoleItem = {
  applicationId: string;
  roleId: string;
  title: string;
  description: string | null;
  status: MyApplicationStatus;
  appliedAt: string;
  updatedAt: string;
  archived: boolean;
};

type FlatMyApplicationRecord = MyApplicationRecord & {
  groupKey: string;
};

const MY_APPLICATION_STATUSES: MyApplicationStatus[] = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "DECLINED",
  "CONFIRMED",
  "COMPLETED",
  "WITHDRAWN",
];

const MY_APPLICATION_STATUS_PRIORITY = new Map<MyApplicationStatus, number>(
  MY_APPLICATION_STATUSES.map((status, index) => [status, index]),
);

function mapReference(
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

function getVolunteerApplicationGroupKey(
  application: MySpaceVolunteerApplication,
) {
  const supportingDocumentKeys = application.supportingDocuments
    .map((document) => document.key)
    .sort((left, right) => left.localeCompare(right));

  return JSON.stringify({
    applicantId: "me",
    opportunityId: application.opportunity.id,
    availability: application.availability,
    relevantExperience: application.relevantExperience,
    supportingDocumentKeys,
  });
}

function getProjectApplicationGroupKey(application: MySpaceProjectApplication) {
  const documentKeys = (application.documentKeys as string[])
    .map((key) => key.trim())
    .sort((left, right) => left.localeCompare(right));

  return JSON.stringify({
    applicantId: "me",
    launchpadId: application.opportunity.id,
    motivation: application.motivation,
    portfolio: application.portfolio ?? "",
    documentKeys,
  });
}

function resolveMyApplicationStatus(
  current: MyApplicationStatus | undefined,
  next: MyApplicationStatus,
): MyApplicationStatus {
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

  const currentPriority = MY_APPLICATION_STATUS_PRIORITY.get(current) ?? 0;
  const nextPriority = MY_APPLICATION_STATUS_PRIORITY.get(next) ?? 0;
  return nextPriority < currentPriority ? next : current;
}

function mapVolunteerApplication(
  application: MySpaceVolunteerApplication,
): FlatMyApplicationRecord {
  const role = {
    applicationId: application.id,
    roleId: application.role.id,
    title: application.role.title,
    description: null,
    status: application.status,
    appliedAt: application.createdAt,
    updatedAt: application.updatedAt,
    archived: application.archived,
  };

  return {
    sourceType: "VOLUNTEER",
    opportunityId: application.opportunity.id,
    title: application.opportunity.title,
    imageKey: application.opportunity.coverImageKey,
    appliedAt: application.createdAt,
    updatedAt: application.updatedAt,
    deadline: application.opportunity.applicationDeadline,
    status: application.status,
    archived: application.archived,
    roles: [role],
    topPick: application.topPick ? application.role.id : null,
    category: application.opportunity.category,
    location: application.opportunity.location,
    groupKey: getVolunteerApplicationGroupKey(application),
  };
}

function mapProjectApplication(
  application: MySpaceProjectApplication,
): FlatMyApplicationRecord {
  const role = {
    applicationId: application.id,
    roleId: application.role.id,
    title: application.role.title,
    description: application.role.description,
    status: application.status,
    appliedAt: application.appliedAt,
    updatedAt: application.updatedAt,
    archived: application.archived,
  };

  return {
    sourceType: "PROJECT",
    opportunityId: application.opportunity.id,
    title: application.opportunity.title,
    imageKey: application.imageKey,
    appliedAt: application.appliedAt,
    updatedAt: application.updatedAt,
    deadline: application.deadline,
    status: application.status,
    archived: application.archived,
    roles: [role],
    topPick: application.topPick ? application.role.id : null,
    category: mapReference(application.category),
    location: mapReference(application.location),
    groupKey: getProjectApplicationGroupKey(application),
  };
}

function groupApplications(
  applications: FlatMyApplicationRecord[],
): MyApplicationRecord[] {
  const applicationByGroup = new Map<string, MyApplicationRecord>();

  for (const application of applications) {
    const existing = applicationByGroup.get(application.groupKey);
    if (!existing) {
      const { groupKey: _groupKey, ...record } = application;
      applicationByGroup.set(application.groupKey, {
        ...record,
        roles: [...record.roles],
      });
      continue;
    }

    const role = application.roles[0];
    const roleExists = existing.roles.some(
      (existingRole) => existingRole.applicationId === role.applicationId,
    );
    if (!roleExists) {
      existing.roles.push(role);
    }
    existing.status = resolveMyApplicationStatus(
      existing.status,
      application.status,
    );
    existing.archived = existing.archived && application.archived;

    if (Date.parse(application.appliedAt) < Date.parse(existing.appliedAt)) {
      existing.appliedAt = application.appliedAt;
    }

    if (Date.parse(application.updatedAt) > Date.parse(existing.updatedAt)) {
      existing.updatedAt = application.updatedAt;
    }

    if (application.topPick) {
      existing.topPick = application.topPick;
    }
  }

  return [...applicationByGroup.values()].map((application) => {
    const roles = application.roles.sort(
      (left, right) => Date.parse(left.appliedAt) - Date.parse(right.appliedAt),
    );

    return {
      ...application,
      roles,
    };
  });
}

function buildSummary(applications: MyApplicationRecord[]) {
  return applications.reduce(
    (summary, application) => {
      if (application.archived) {
        summary.ARCHIVED += 1;
        return summary;
      }

      if (
        application.status === "SUBMITTED" ||
        application.status === "UNDER_REVIEW"
      ) {
        summary.PENDING += 1;
        return summary;
      }

      if (application.status === "CONFIRMED") {
        summary.ACTIVE += 1;
        return summary;
      }

      summary[application.status] += 1;

      return summary;
    },
    {
      PENDING: 0,
      APPROVED: 0,
      DECLINED: 0,
      ACTIVE: 0,
      COMPLETED: 0,
      WITHDRAWN: 0,
      ARCHIVED: 0,
    },
  );
}

function buildSummaryFromFlatApplications(
  applications: FlatMyApplicationRecord[],
) {
  const activeGroups = groupApplications(
    applications.filter((application) => !application.archived),
  );
  const archivedGroups = groupApplications(
    applications.filter((application) => application.archived),
  );

  return {
    ...buildSummary(activeGroups),
    ARCHIVED: archivedGroups.length,
  };
}

function buildFilteredApplicationGroups(
  applications: FlatMyApplicationRecord[],
  filter: GetMyApplicationsQuery["filter"],
) {
  const visibleApplications =
    filter === "archived"
      ? applications.filter((application) => application.archived)
      : applications.filter((application) => !application.archived);

  return groupApplications(visibleApplications).sort(
    (left, right) => Date.parse(right.appliedAt) - Date.parse(left.appliedAt),
  );
}

function serializeMyApplicationRecord(application: MyApplicationRecord) {
  const { archived: _archived, ...responseApplication } = application;
  return responseApplication;
}

function matchesFilter(
  application: MyApplicationRecord,
  filter: GetMyApplicationsQuery["filter"],
) {
  if (filter === "archived") {
    return application.archived;
  }

  if (application.archived) {
    return false;
  }

  if (filter === "all") {
    return true;
  }

  if (filter === "pending") {
    return (
      application.status === "SUBMITTED" ||
      application.status === "UNDER_REVIEW"
    );
  }

  if (filter === "active") {
    return application.status === "CONFIRMED";
  }

  if (filter === "approved") {
    return application.status === "APPROVED";
  }

  return application.status === "COMPLETED";
}

export async function handleGetMyApplications(
  c: Context,
  query: GetMyApplicationsQuery,
) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const [volunteerApplications, projectApplications] = await Promise.all([
      query.type === "projects"
        ? Promise.resolve([])
        : findMyVolunteerApplications(authResult.userId),
      query.type === "volunteer"
        ? Promise.resolve([])
        : findMyProjectApplications(authResult.userId),
    ]);
    const applications = [
      ...volunteerApplications.map(mapVolunteerApplication),
      ...projectApplications.map(mapProjectApplication),
    ];
    const filteredApplications = buildFilteredApplicationGroups(
      applications,
      query.filter,
    ).filter((application) =>
      matchesFilter(application, query.filter),
    );
    const responseApplications = filteredApplications.map(
      serializeMyApplicationRecord,
    );

    return c.json(
      {
        ok: true,
        applications: responseApplications,
        summary: buildSummaryFromFlatApplications(applications),
      },
      200,
    );
  } catch (error) {
    console.error("Failed to get my applications", error);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}

export async function handleGetMyApplicationDetail(
  c: Context,
  params: GetMyApplicationDetailParam,
) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const application =
      params.sourceType === "volunteer"
        ? await findMyVolunteerApplicationDetail(
            authResult.userId,
            params.applicationId,
          )
        : await findMyProjectApplicationDetail(
            authResult.userId,
            params.applicationId,
          );

    if (!application) {
      return c.json({ ok: false, error: "Application not found" }, 404);
    }

    return c.json(
      {
        ok: true,
        application,
      },
      200,
    );
  } catch (error) {
    console.error("Failed to get my application detail", error);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}

export async function handleChangeMyApplicationStatus(
  c: Context,
  params: ChangeMyApplicationStatusParam,
) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const result = await updateMyApplicationStatus(authResult.userId, params);

    if (result === "not_found") {
      return c.json({ ok: false, error: "Application not found" }, 404);
    }

    if (result === "conflict") {
      return c.json(
        {
          ok: false,
          error: "Application status cannot be changed with this action",
        },
        409,
      );
    }

    const applicationRecords =
      params.sourceType === "volunteer"
        ? (await findMyVolunteerApplications(authResult.userId)).map(
            mapVolunteerApplication,
          )
        : (await findMyProjectApplications(authResult.userId)).map(
            mapProjectApplication,
          );
    const applications = groupApplications(
      applicationRecords.filter((application) => !application.archived),
    );
    const application = applications.find(
      (item) =>
        item.roles.some((role) => role.applicationId === params.applicationId),
    );

    if (!application) {
      return c.json({ ok: false, error: "Application not found" }, 404);
    }

    return c.json(
      {
        ok: true,
        application: serializeMyApplicationRecord(application),
      },
      200,
    );
  } catch (error) {
    console.error("Failed to change my application status", error);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}

export async function handleChangeMyApplicationArchived(
  c: Context,
  params: ChangeMyApplicationArchiveParam,
) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const result = await updateMyApplicationArchived(authResult.userId, params);

    if (result === "not_found") {
      return c.json({ ok: false, error: "Application not found" }, 404);
    }

    if (result === "conflict") {
      return c.json(
        {
          ok: false,
          error:
            "Only declined, withdrawn, and completed applications can be archived",
        },
        409,
      );
    }

    const applicationRecords =
      params.sourceType === "volunteer"
        ? (await findMyVolunteerApplications(authResult.userId)).map(
            mapVolunteerApplication,
          )
        : (await findMyProjectApplications(authResult.userId)).map(
            mapProjectApplication,
          );
    const applications = groupApplications(
      applicationRecords.filter((application) =>
        params.archiveAction === "archive"
          ? application.archived
          : !application.archived,
      ),
    );
    const application = applications.find(
      (item) =>
        item.roles.some((role) => role.applicationId === params.applicationId),
    );

    if (!application) {
      return c.json({ ok: false, error: "Application not found" }, 404);
    }

    return c.json(
      {
        ok: true,
        application,
      },
      200,
    );
  } catch (error) {
    console.error("Failed to change my application archived state", error);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}
