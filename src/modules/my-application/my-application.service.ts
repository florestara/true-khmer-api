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
  opportunityId: string;
  opportunityTitle: string;
  sourceType: "VOLUNTEER" | "PROJECT";
  imageKey: string | null;
  appliedAt: string;
  deadline: string | null;
  status: MyApplicationStatus;
  needAttention: boolean;
  totalRoleApplied: number;
  filled: boolean;
  category: {
    id: string;
    name: string;
  } | null;
  location: {
    id: string;
    name: string;
  } | null;
  roles: MyApplicationRole[];
  approvedRole: MyApplicationRole | null;
};

type MyApplicationOpportunity = {
  id: string;
  title: string;
};

type MyApplicationRole = {
  applicationId: string;
  roleId: string;
  title: string;
  status: MyApplicationStatus;
  appliedAt: string;
};

type MyApplicationRecord = Omit<
  MyApplicationItem,
  "needAttention" | "totalRoleApplied" | "roles" | "approvedRole"
> & {
  opportunity: MyApplicationOpportunity;
  role: MyApplicationRole;
  archived: boolean;
};

type MyApplicationGroup = MyApplicationItem & {
  archived: boolean;
};

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

function mapVolunteerApplication(
  application: MySpaceVolunteerApplication,
): MyApplicationRecord {
  return {
    opportunityId: application.opportunity.id,
    opportunityTitle: application.opportunity.title,
    sourceType: "VOLUNTEER",
    imageKey: application.opportunity.coverImageKey,
    appliedAt: application.createdAt,
    deadline: application.opportunity.applicationDeadline,
    status: application.status,
    filled: application.opportunity.filled,
    archived: application.archived,
    opportunity: {
      id: application.opportunity.id,
      title: application.opportunity.title,
    },
    category: application.opportunity.category,
    location: application.opportunity.location,
    role: {
      applicationId: application.id,
      roleId: application.role.id,
      title: application.role.title,
      status: application.status,
      appliedAt: application.createdAt,
    },
  };
}

function mapProjectApplication(
  application: MySpaceProjectApplication,
): MyApplicationRecord {
  if (!application.opportunity) {
    throw new Error("Project application is missing opportunity");
  }

  return {
    opportunityId: application.opportunity.id,
    opportunityTitle: application.opportunity.title,
    sourceType: "PROJECT",
    imageKey: application.imageKey,
    appliedAt: application.appliedAt,
    deadline: application.deadline,
    status: application.status,
    filled: false,
    archived: application.archived,
    opportunity: application.opportunity,
    category: mapReference(application.category),
    location: mapReference(application.location),
    role: {
      applicationId: application.id,
      roleId: application.roleId,
      title: application.title,
      status: application.status,
      appliedAt: application.appliedAt,
    },
  };
}

function resolveOpportunityStatus(statuses: MyApplicationStatus[]) {
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

function buildMyApplicationGroups(
  applications: MyApplicationRecord[],
): MyApplicationGroup[] {
  const groupByOpportunity = new Map<string, MyApplicationGroup>();

  for (const application of applications) {
    const groupKey = `${application.sourceType}:${application.opportunity.id}`;
    const existing = groupByOpportunity.get(groupKey);

    if (!existing) {
      groupByOpportunity.set(groupKey, {
        opportunityId: application.opportunity.id,
        opportunityTitle: application.opportunity.title,
        sourceType: application.sourceType,
        imageKey: application.imageKey,
        appliedAt: application.appliedAt,
        deadline: application.deadline,
        status: application.status,
        needAttention: application.status === "APPROVED",
        totalRoleApplied: 1,
        filled: application.filled,
        category: application.category,
        location: application.location,
        roles: [application.role],
        approvedRole:
          application.status === "APPROVED" ? application.role : null,
        archived: application.archived,
      });
      continue;
    }

    existing.roles.push(application.role);
    existing.totalRoleApplied = existing.roles.length;
    existing.status = resolveOpportunityStatus(
      existing.roles.map((role) => role.status),
    );
    existing.needAttention = existing.roles.some(
      (role) => role.status === "APPROVED",
    );
    existing.approvedRole =
      existing.roles.find((role) => role.status === "APPROVED") ?? null;
    existing.archived = existing.archived && application.archived;

    if (Date.parse(application.appliedAt) > Date.parse(existing.appliedAt)) {
      existing.appliedAt = application.appliedAt;
    }
  }

  return [...groupByOpportunity.values()]
    .map((application) => ({
      ...application,
      roles: application.roles.sort(
        (left, right) =>
          Date.parse(right.appliedAt) - Date.parse(left.appliedAt),
      ),
    }))
    .sort(
      (left, right) =>
        Date.parse(right.appliedAt) - Date.parse(left.appliedAt),
    );
}

function buildSummary(applications: MyApplicationGroup[]) {
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

function matchesFilter(
  application: MyApplicationGroup,
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

function toResponseApplication({
  archived,
  ...application
}: MyApplicationGroup): MyApplicationItem {
  return application;
}

function findApplicationGroupByOpportunityId(
  applications: MyApplicationGroup[],
  opportunityId: string,
) {
  return applications.find(
    (application) => application.opportunityId === opportunityId,
  );
}

function findApplicationGroupByRoleApplicationId(
  applications: MyApplicationGroup[],
  applicationId: string,
) {
  return applications.find((application) =>
    application.roles.some((role) => role.applicationId === applicationId),
  );
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
    const applicationRecords = [
      ...volunteerApplications.map(mapVolunteerApplication),
      ...projectApplications.map(mapProjectApplication),
    ];
    const applications = buildMyApplicationGroups(applicationRecords);
    const filteredApplications = applications.filter((application) =>
      matchesFilter(application, query.filter),
    );
    const responseApplications = filteredApplications.map(toResponseApplication);

    return c.json(
      {
        ok: true,
        applications: responseApplications,
        summary: buildSummary(applications),
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
            params.postingId,
          )
        : await findMyProjectApplicationDetail(
            authResult.userId,
            params.postingId,
          );

    if (!application) {
      return c.json(
        { ok: false, error: "Posting application not found" },
        404,
      );
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
    const application = findApplicationGroupByRoleApplicationId(
      buildMyApplicationGroups(applicationRecords),
      params.applicationId,
    );

    if (!application) {
      return c.json({ ok: false, error: "Application not found" }, 404);
    }

    return c.json(
      {
        ok: true,
        application: toResponseApplication(application),
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
      return c.json(
        { ok: false, error: "Opportunity application group not found" },
        404,
      );
    }

    if (result === "conflict") {
      return c.json(
        {
          ok: false,
          error:
            "Only completed groups or groups containing only declined/withdrawn roles can be archived",
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
    const application = findApplicationGroupByOpportunityId(
      buildMyApplicationGroups(applicationRecords),
      params.opportunityId,
    );

    if (!application) {
      return c.json(
        { ok: false, error: "Opportunity application group not found" },
        404,
      );
    }

    return c.json(
      {
        ok: true,
        application: {
          ...toResponseApplication(application),
          archived: application.archived,
        },
      },
      200,
    );
  } catch (error) {
    console.error("Failed to change my application archived state", error);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}
