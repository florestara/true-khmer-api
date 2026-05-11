import type { Context } from "hono";
import { getAuthUserId } from "../auth/utils/get-auth";
import {
  findMyProjectApplications,
  findMyVolunteerApplications,
  updateMyApplicationStatus,
  type MySpaceProjectApplication,
  type MySpaceVolunteerApplication,
} from "./applications.query";
import type {
  ChangeMyApplicationStatusParam,
  GetMyApplicationsQuery,
} from "./applications.schema";

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
): MyApplicationItem {
  return {
    id: application.id,
    sourceType: "VOLUNTEER",
    title: application.role.title,
    imageKey: application.opportunity.coverImageKey,
    appliedAt: application.createdAt,
    deadline: application.opportunity.applicationDeadline,
    status: application.status,
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
): MyApplicationItem {
  return {
    id: application.id,
    sourceType: "PROJECT",
    title: application.title,
    imageKey: application.imageKey,
    appliedAt: application.appliedAt,
    deadline: application.deadline,
    status: application.status,
    opportunity: application.opportunity,
    category: mapReference(application.category),
    location: mapReference(application.location),
  };
}

function buildSummary(applications: MyApplicationItem[]) {
  return applications.reduce(
    (summary, application) => {
      summary[application.status] += 1;

      return summary;
    },
    {
      SUBMITTED: 0,
      UNDER_REVIEW: 0,
      APPROVED: 0,
      DECLINED: 0,
      CONFIRMED: 0,
      COMPLETED: 0,
      WITHDRAWN: 0,
    },
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
    const applications = [
      ...volunteerApplications.map(mapVolunteerApplication),
      ...projectApplications.map(mapProjectApplication),
    ].sort(
      (left, right) =>
        Date.parse(right.appliedAt) - Date.parse(left.appliedAt),
    );

    return c.json(
      {
        ok: true,
        applications,
        summary: buildSummary(applications),
      },
      200,
    );
  } catch (error) {
    console.error("Failed to get my applications", error);
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
