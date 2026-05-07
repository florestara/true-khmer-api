import type { Context } from "hono";
import { getAuthUserId } from "../auth/utils/get-auth";
import {
  findMyVolunteerApplications,
  type MySpaceVolunteerApplication,
} from "./applications.query";
import type { GetMyApplicationsQuery } from "./applications.schema";

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
    if (query.type === "projects") {
      return c.json(
        {
          ok: true,
          applications: null,
          summary: buildSummary([]),
        },
        200,
      );
    }

    const volunteerApplications = await findMyVolunteerApplications(
      authResult.userId,
    );
    const applications = volunteerApplications.map(mapVolunteerApplication).sort(
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
