import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../db/index";
import {
  city,
  user,
  userProfile,
  volunteerApplication,
  volunteerCategory,
  volunteerOpportunity,
  volunteerRole,
} from "../../db/schema";
import {
  VOLUNTEER_ADVISORY_LOCK_NAMESPACE,
  VOLUNTEER_CATEGORY_DISPLAY_ORDER_LOCK_KEY,
} from "../volunteer/lib/constants";

const ACTIVE_VOLUNTEER_APPLICATION_STATUSES = [
  "SUBMITTED",
  "APPROVAL",
  "ACCEPTED",
] as const;

type VolunteerApplicationRow = typeof volunteerApplication.$inferSelect;
type VolunteerRoleRow = typeof volunteerRole.$inferSelect;
type VolunteerOpportunityRow = typeof volunteerOpportunity.$inferSelect;

type VolunteerReference = {
  id: string;
  name: string;
};

export type VolunteerApplicationDetail = {
  id: string;
  opportunity: {
    id: string;
    title: string;
    coverImageKey: string;
    status: VolunteerOpportunityRow["status"];
    category: VolunteerReference;
    location: VolunteerReference;
  };
  role: {
    id: string;
    title: string;
  };
  availability: string;
  relevantExperience: string;
  supportingDocumentKeys: string[];
  status: VolunteerApplicationRow["status"];
  createdAt: string;
  updatedAt: string;
};

type VolunteerApplicationTarget = {
  opportunityId: string;
  opportunityTitle: string;
  coverImageKey: string;
  categoryId: string;
  categoryName: string;
  cityId: string;
  cityName: string;
  roleId: string;
  roleTitle: string;
  createdBy: string;
  applicationDeadline: string;
  status: VolunteerOpportunityRow["status"];
  publishedAt: string | null;
};

type VolunteerApplicationOpportunityTarget = Omit<
  VolunteerApplicationTarget,
  "roleId" | "roleTitle"
>;

function toInteger(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function resolveVolunteerOrganizerName(
  displayName: string | null,
  fullName: string,
): string {
  const normalizedDisplayName = displayName?.trim();
  if (normalizedDisplayName && normalizedDisplayName.length > 0) {
    return normalizedDisplayName;
  }

  return fullName.trim();
}

type VolunteerOrganizerBase = {
  id: string;
  name: string;
  avatarUrl: string | null;
  opportunityCount: number;
  location: VolunteerReference | null;
};

type VolunteerOrganizerQueryRow = {
  id: string;
  displayName: string | null;
  fullName: string;
  avatarUrl: string | null;
  locationId: string | null;
  locationName: string | null;
  opportunityCount: number;
};

type VolunteerQueryExecutor = Pick<typeof db, "select">;

function hydrateVolunteerOrganizer(
  organizer: VolunteerOrganizerQueryRow,
): VolunteerOrganizerBase {
  return {
    id: organizer.id,
    name: resolveVolunteerOrganizerName(
      organizer.displayName,
      organizer.fullName,
    ),
    avatarUrl: organizer.avatarUrl,
    opportunityCount: toInteger(organizer.opportunityCount),
    location:
      organizer.locationId && organizer.locationName
        ? {
            id: organizer.locationId,
            name: organizer.locationName,
          }
        : null,
  };
}

async function getVolunteerOrganizersByUserIds(
  executor: VolunteerQueryExecutor,
  userIds: string[],
): Promise<Map<string, VolunteerOrganizerBase>> {
  const uniqueUserIds = [...new Set(userIds)];
  if (uniqueUserIds.length === 0) {
    return new Map();
  }

  const opportunityCounts = executor
    .select({
      userId: volunteerOpportunity.createdBy,
      opportunityCount: sql<number>`count(*)::int`.as("opportunity_count"),
    })
    .from(volunteerOpportunity)
    .where(
      and(
        inArray(volunteerOpportunity.createdBy, uniqueUserIds),
        eq(volunteerOpportunity.status, "PUBLISHED"),
      ),
    )
    .groupBy(volunteerOpportunity.createdBy)
    .as("opportunity_counts");

  const rows = await executor
    .select({
      id: user.id,
      displayName: userProfile.displayName,
      fullName: user.name,
      avatarUrl: userProfile.avatarUrl,
      locationId: city.id,
      locationName: city.name,
      opportunityCount:
        sql<number>`coalesce(${opportunityCounts.opportunityCount}, 0)::int`.as(
          "opportunityCount",
        ),
    })
    .from(user)
    .leftJoin(userProfile, eq(userProfile.userId, user.id))
    .leftJoin(city, eq(city.id, userProfile.cityId))
    .leftJoin(opportunityCounts, eq(opportunityCounts.userId, user.id))
    .where(inArray(user.id, uniqueUserIds));

  return new Map(
    rows.map((row) => [
      row.id,
      hydrateVolunteerOrganizer(row as VolunteerOrganizerQueryRow),
    ]),
  );
}

export async function findVolunteerOpportunityApplicationTargetById(
  opportunityId: string,
): Promise<VolunteerApplicationOpportunityTarget | null> {
  const [row] = await db
    .select({
      opportunityId: volunteerOpportunity.id,
      opportunityTitle: volunteerOpportunity.title,
      coverImageKey: volunteerOpportunity.coverImageKey,
      categoryId: volunteerCategory.id,
      categoryName: volunteerCategory.name,
      cityId: city.id,
      cityName: city.name,
      createdBy: volunteerOpportunity.createdBy,
      applicationDeadline: volunteerOpportunity.applicationDeadline,
      status: volunteerOpportunity.status,
      publishedAt: volunteerOpportunity.publishedAt,
    })
    .from(volunteerOpportunity)
    .innerJoin(
      volunteerCategory,
      eq(volunteerCategory.id, volunteerOpportunity.categoryId),
    )
    .innerJoin(city, eq(city.id, volunteerOpportunity.cityId))
    .where(eq(volunteerOpportunity.id, opportunityId))
    .limit(1);

  return row ?? null;
}

export async function findVolunteerApplicationTargetByRoleId(
  roleId: string,
): Promise<VolunteerApplicationTarget | null> {
  const [row] = await db
    .select({
      opportunityId: volunteerOpportunity.id,
      opportunityTitle: volunteerOpportunity.title,
      coverImageKey: volunteerOpportunity.coverImageKey,
      categoryId: volunteerCategory.id,
      categoryName: volunteerCategory.name,
      cityId: city.id,
      cityName: city.name,
      roleId: volunteerRole.id,
      roleTitle: volunteerRole.title,
      createdBy: volunteerOpportunity.createdBy,
      applicationDeadline: volunteerOpportunity.applicationDeadline,
      status: volunteerOpportunity.status,
      publishedAt: volunteerOpportunity.publishedAt,
    })
    .from(volunteerRole)
    .innerJoin(
      volunteerOpportunity,
      eq(volunteerOpportunity.id, volunteerRole.opportunityId),
    )
    .innerJoin(
      volunteerCategory,
      eq(volunteerCategory.id, volunteerOpportunity.categoryId),
    )
    .innerJoin(city, eq(city.id, volunteerOpportunity.cityId))
    .where(eq(volunteerRole.id, roleId))
    .limit(1);

  return row ?? null;
}

export async function hasVolunteerApplicationForRole(
  applicantId: string,
  roleId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: volunteerApplication.id })
    .from(volunteerApplication)
    .where(
      and(
        eq(volunteerApplication.applicantId, applicantId),
        eq(volunteerApplication.roleId, roleId),
        inArray(
          volunteerApplication.status,
          ACTIVE_VOLUNTEER_APPLICATION_STATUSES,
        ),
      ),
    )
    .limit(1);

  return Boolean(row);
}

function hydrateVolunteerApplication(
  application: VolunteerApplicationRow,
  roleTitle: string,
  opportunity: {
    id: string;
    title: string;
    coverImageKey: string;
    status: VolunteerOpportunityRow["status"];
    category: VolunteerReference;
    location: VolunteerReference;
  },
): VolunteerApplicationDetail {
  return {
    id: application.id,
    opportunity,
    role: {
      id: application.roleId,
      title: roleTitle,
    },
    availability: application.availability,
    relevantExperience: application.relevantExperience,
    supportingDocumentKeys: application.supportingDocumentKeys as string[],
    status: application.status,
    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
  };
}

type CreateVolunteerApplicationInput = {
  roleId: string;
  applicantId: string;
  opportunityId: string;
  opportunityTitle: string;
  coverImageKey: string;
  category: VolunteerReference;
  location: VolunteerReference;
  roleTitle: string;
  availability: string;
  relevantExperience: string;
  supportingDocumentKeys: string[];
};

export async function createVolunteerApplication(
  data: CreateVolunteerApplicationInput,
): Promise<VolunteerApplicationDetail> {
  return db.transaction(async (tx) => {
    const [application] = await tx
      .insert(volunteerApplication)
      .values({
        opportunityId: data.opportunityId,
        roleId: data.roleId,
        applicantId: data.applicantId,
        availability: data.availability,
        relevantExperience: data.relevantExperience,
        supportingDocumentKeys: data.supportingDocumentKeys,
        status: "SUBMITTED",
      })
      .returning();

    return hydrateVolunteerApplication(application, data.roleTitle, {
      id: data.opportunityId,
      title: data.opportunityTitle,
      coverImageKey: data.coverImageKey,
      status: "PUBLISHED",
      category: data.category,
      location: data.location,
    });
  });
}

export async function findVolunteerApplicationsByApplicantId(
  applicantId: string,
): Promise<VolunteerApplicationDetail[]> {
  const rows = await db
    .select({
      application: volunteerApplication,
      roleTitle: volunteerRole.title,
      opportunityId: volunteerOpportunity.id,
      opportunityTitle: volunteerOpportunity.title,
      coverImageKey: volunteerOpportunity.coverImageKey,
      opportunityStatus: volunteerOpportunity.status,
      categoryId: volunteerCategory.id,
      categoryName: volunteerCategory.name,
      cityId: city.id,
      cityName: city.name,
    })
    .from(volunteerApplication)
    .innerJoin(volunteerRole, eq(volunteerRole.id, volunteerApplication.roleId))
    .innerJoin(
      volunteerOpportunity,
      eq(volunteerOpportunity.id, volunteerApplication.opportunityId),
    )
    .innerJoin(
      volunteerCategory,
      eq(volunteerCategory.id, volunteerOpportunity.categoryId),
    )
    .innerJoin(city, eq(city.id, volunteerOpportunity.cityId))
    .where(eq(volunteerApplication.applicantId, applicantId))
    .orderBy(desc(volunteerApplication.createdAt));

  return rows.map((row) =>
    hydrateVolunteerApplication(row.application, row.roleTitle, {
      id: row.opportunityId,
      title: row.opportunityTitle,
      coverImageKey: row.coverImageKey,
      status: row.opportunityStatus,
      category: {
        id: row.categoryId,
        name: row.categoryName,
      },
      location: {
        id: row.cityId,
        name: row.cityName,
      },
    }),
  );
}

export async function findOpportunityTitleById(
  opportunityId: string,
): Promise<string | null> {
  const [row] = await db
    .select({
      title: volunteerOpportunity.title,
    })
    .from(volunteerOpportunity)
    .where(eq(volunteerOpportunity.id, opportunityId))
    .limit(1);

  return row?.title ?? null;
}
