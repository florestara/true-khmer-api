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
} from "./applications.query";
import type {
  ChangeMyApplicationArchiveParam,
  ChangeMyApplicationStatusParam,
  GetMyApplicationDetailParam,
  GetMyApplicationsQuery,
} from "./applications.schema";
import {
  awardLaunchpadValidationPoints,
  awardPoints,
} from "../points/points.service";

type MyApplicationStatus =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "DECLINED"
  | "CONFIRMED"
  | "COMPLETED"
  | "WITHDRAWN";

type MyApplicationItem = {
  id: string;
  sourceType: "VOLUNTEER" | "PROJECT";
  title: string;
  imageKey: string | null;
  appliedAt: string;
  deadline: string | null;
  status: MyApplicationStatus;
  opportunity: {
    id: string;
    title: string;
  } | null;
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
    id: application.id,
    sourceType: "VOLUNTEER",
    title: application.role.title,
    imageKey: application.opportunity.coverImageKey,
    appliedAt: application.createdAt,
    deadline: application.opportunity.applicationDeadline,
    status: application.status,
    archived: application.archived,
    opportunity: {
      id: application.opportunity.id,
      title: application.opportunity.title,
    },
    category: application.opportunity.category,
    location: application.opportunity.location,
  };
}

function mapProjectApplication(
  application: MySpaceProjectApplication,
): MyApplicationRecord {
  return {
    id: application.id,
    sourceType: "PROJECT",
    title: application.title,
    imageKey: application.imageKey,
    appliedAt: application.appliedAt,
    deadline: application.deadline,
    status: application.status,
    archived: application.archived,
    opportunity: application.opportunity,
    category: mapReference(application.category),
    location: mapReference(application.location),
  };
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
    ].sort(
      (left, right) =>
        Date.parse(right.appliedAt) - Date.parse(left.appliedAt),
    );
    const filteredApplications = applications.filter((application) =>
      matchesFilter(application, query.filter),
    );
    const responseApplications = filteredApplications.map(
      ({ archived, ...application }) => application,
    );

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

    const applications =
      params.sourceType === "volunteer"
        ? (await findMyVolunteerApplications(authResult.userId)).map(
            mapVolunteerApplication,
          )
        : (await findMyProjectApplications(authResult.userId)).map(
            mapProjectApplication,
          );
    const application = applications.find(
      (item) => item.id === params.applicationId,
    );

    if (!application) {
      return c.json({ ok: false, error: "Application not found" }, 404);
    }

    if (
      params.statusAction === "confirm" &&
      application.status === "CONFIRMED" &&
      application.opportunity
    ) {
      if (params.sourceType === "volunteer") {
        awardPoints({
          userId: authResult.userId,
          actionKey: "volunteer_registered",
          referenceType: "volunteer_opportunity",
          referenceId: application.opportunity.id,
        }).catch((err) =>
          console.error("Failed to award volunteer registration points", err),
        );
      } else {
        awardLaunchpadValidationPoints({
          launchpadId: application.opportunity.id,
        }).catch((err) =>
          console.error("Failed to award launchpad validation points", err),
        );
      }
    }

    return c.json(
      {
        ok: true,
        application,
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

    const applications =
      params.sourceType === "volunteer"
        ? (await findMyVolunteerApplications(authResult.userId)).map(
            mapVolunteerApplication,
          )
        : (await findMyProjectApplications(authResult.userId)).map(
            mapProjectApplication,
          );
    const application = applications.find(
      (item) => item.id === params.applicationId,
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
