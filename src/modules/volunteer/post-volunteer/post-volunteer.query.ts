import {
  and,
  asc,
  desc,
  eq,
  exists,
  getTableColumns,
  ilike,
  inArray,
  isNotNull,
  lt,
  or,
  sql,
  aliasedTable,
  type SQL,
  type SQLWrapper,
} from "drizzle-orm";
import { env } from "../../../config/env";
import { db } from "../../../db/index";
import {
  city,
  country,
  user,
  userProfile,
  volunteerApplication,
  volunteerCategory,
  volunteerOpportunity,
  volunteerOpportunitySave,
  volunteerRole,
  volunteerRoleRequirement,
} from "../../../db/schema";
import {
  buildCursorPagination,
  normalizePaginationTotal,
  type CursorPagination,
} from "../../../utils/pagination.helper";
import {
  VOLUNTEER_ADVISORY_LOCK_NAMESPACE,
  VOLUNTEER_CATEGORY_DISPLAY_ORDER_LOCK_KEY,
} from "../lib/constants";
import {
  encodeVolunteerOpportunitiesPageCursor,
  encodeSavedVolunteerOpportunitiesPageCursor,
  type CreateVolunteerCategoryInput,
  type CreateVolunteerOpportunityBodyInput,
  type GetSavedVolunteerOpportunitiesQuery,
  type GetVolunteerOpportunitiesQuery,
  type SavedVolunteerOpportunitiesPageCursor,
  type VolunteerOpportunitiesPageCursor,
} from "./post-volunteer.schema";

const ACTIVE_VOLUNTEER_APPLICATION_STATUSES = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "CONFIRMED",
  "COMPLETED",
] as const;

type VolunteerCategoryRow = typeof volunteerCategory.$inferSelect;
type VolunteerCategoryInsert = typeof volunteerCategory.$inferInsert;
type VolunteerCategoryWithOpportunityCountRow = VolunteerCategoryRow & {
  opportunityCount: number;
};
type VolunteerLocationRow = {
  id: string;
  name: string;
};
type VolunteerOpportunityRow = typeof volunteerOpportunity.$inferSelect;
type VolunteerApplicationRow = typeof volunteerApplication.$inferSelect;
type VolunteerOpportunitySaveInsert =
  typeof volunteerOpportunitySave.$inferInsert;
type VolunteerRoleRow = typeof volunteerRole.$inferSelect;
type VolunteerRoleRequirementRow = typeof volunteerRoleRequirement.$inferSelect;
export type VolunteerSupportingDocument = {
  name: string;
  key: string;
};
type HydratedVolunteerRole = Pick<
  VolunteerRoleRow,
  | "id"
  | "title"
  | "commitmentLabel"
  | "capacity"
  | "responsibilities"
  | "displayOrder"
>;
type HydratedVolunteerRequirement = Pick<
  VolunteerRoleRequirementRow,
  "requirementText"
>;
type VolunteerReference = {
  id: string;
  name: string;
};
type VolunteerOrganizerBase = {
  id: string;
  name: string;
  avatarUrl: string | null;
  opportunityCount: number;
  location: VolunteerReference | null;
};
type VolunteerOrganizer = VolunteerOrganizerBase & {
  contact: {
    email: string;
    telegramUsername: string | null;
    phone: string | null;
    websiteUrl: string | null;
  };
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
type VolunteerOpportunityBaseRow = {
  opportunity: VolunteerOpportunityRow;
  category: VolunteerReference;
  location: VolunteerReference;
};
type SavedVolunteerOpportunityListRow = VolunteerOpportunityBaseRow & {
  applicationCount: number;
  capacity: number;
  viewerSave: boolean;
  savedAt: string;
};
export type VolunteerActivityTarget = {
  id: string;
  title: string;
  overview: string;
};
export type VolunteerOpportunityListItem = {
  id: string;
  title: string;
  overview: string;
  durationLabel: string | null;
  commitmentLabel: string | null;
  applicationDeadline: string;
  applicationCount: number;
  capacity: number;
  coverImageKey: string;
  createdAt: string;
  viewerSave: boolean;
  category: VolunteerReference;
  location: VolunteerReference;
};
export type VolunteerOpportunityDetail = {
  id: string;
  category: VolunteerReference;
  location: VolunteerReference;
  title: string;
  overview: string;
  communityImpact: string | null;
  durationLabel: string | null;
  commitmentLabel: string | null;
  applicationDeadline: string;
  applicationCount: number;
  capacity: number;
  coverImageKey: string;
  benefits: string[];
  status: VolunteerOpportunityRow["status"];
  publishedAt: string | null;
  organizer: VolunteerOrganizer;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  viewerSave: boolean;
  roles: Array<{
    id: string;
    title: string;
    commitmentLabel: string;
    capacity: number;
    responsibilities: string[];
    requirements: string[];
    displayOrder: number;
    viewerApplied: boolean;
  }>;
};
export type VolunteerApplicationDetail = {
  id: string;
  opportunity: {
    id: string;
    title: string;
    coverImageKey: string;
    applicationDeadline: string;
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
  supportingDocuments: VolunteerSupportingDocument[];
  status: VolunteerApplicationRow["status"];
  createdAt: string;
  updatedAt: string;
};
type VolunteerOpportunitiesListResult = {
  opportunities: VolunteerOpportunityListItem[];
  pagination: CursorPagination;
};
type VolunteerApplicationTarget = {
  opportunityId: string;
  opportunityTitle: string;
  opportunityOverview: string;
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

const CAMBODIA_NORMALIZED_NAME = env.VOLUNTEER_COUNTRY_NORMALIZED_NAME;
const volunteerRoleSearch = aliasedTable(
  volunteerRole,
  "volunteer_role_search",
);
const volunteerRoleRequirementSearch = aliasedTable(
  volunteerRoleRequirement,
  "volunteer_role_requirement_search",
);
const volunteerOpportunitySaveList = aliasedTable(
  volunteerOpportunitySave,
  "volunteer_opportunity_save_list",
);
const organizerProfileCity = aliasedTable(city, "organizer_profile_city");

function buildJsonbTextSearch(column: SQLWrapper, pattern: string) {
  return sql`${column}::text ilike ${pattern}`;
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

function toInteger(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function getVolunteerCategories(): Promise<
  VolunteerCategoryWithOpportunityCountRow[]
> {
  const opportunityCounts = db
    .select({
      categoryId: volunteerOpportunity.categoryId,
      opportunityCount: sql<number>`count(*)::int`.as("opportunity_count"),
    })
    .from(volunteerOpportunity)
    .where(
      and(
        eq(volunteerOpportunity.status, "PUBLISHED"),
        isNotNull(volunteerOpportunity.publishedAt),
      ),
    )
    .groupBy(volunteerOpportunity.categoryId)
    .as("volunteer_category_opportunity_counts");

  return db
    .select({
      ...getTableColumns(volunteerCategory),
      opportunityCount:
        sql<number>`coalesce(${opportunityCounts.opportunityCount}, 0)::int`.as(
          "opportunityCount",
        ),
    })
    .from(volunteerCategory)
    .leftJoin(
      opportunityCounts,
      eq(opportunityCounts.categoryId, volunteerCategory.id),
    )
    .where(eq(volunteerCategory.status, "ACTIVE"))
    .orderBy(volunteerCategory.displayOrder, volunteerCategory.name);
}

export async function createVolunteerCategory(
  data: CreateVolunteerCategoryInput,
): Promise<VolunteerCategoryRow> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(${VOLUNTEER_ADVISORY_LOCK_NAMESPACE}, ${VOLUNTEER_CATEGORY_DISPLAY_ORDER_LOCK_KEY})`,
    );

    const [orderRow] = await tx
      .select({
        maxDisplayOrder: sql`coalesce(max(${volunteerCategory.displayOrder}), -1)`,
      })
      .from(volunteerCategory);

    const rawMaxDisplayOrder = orderRow?.maxDisplayOrder;
    const maxDisplayOrderNumber =
      typeof rawMaxDisplayOrder === "number"
        ? rawMaxDisplayOrder
        : Number(rawMaxDisplayOrder ?? -1);

    if (!Number.isFinite(maxDisplayOrderNumber)) {
      throw new Error("Invalid display order value returned from database");
    }

    const insertData: VolunteerCategoryInsert = {
      name: data.name,
      slug: data.slug,
      description: data.description ?? null,
      iconKey: data.iconKey ?? null,
      displayOrder: maxDisplayOrderNumber + 1,
      status: "ACTIVE",
      createdBy: data.createdBy,
    };

    const [newCategory] = await tx
      .insert(volunteerCategory)
      .values(insertData)
      .returning();

    return newCategory;
  });
}

export async function getVolunteerLocations(): Promise<VolunteerLocationRow[]> {
  return db
    .select({
      id: city.id,
      name: city.name,
    })
    .from(city)
    .innerJoin(country, eq(city.countryId, country.id))
    .where(
      and(
        eq(city.isActive, true),
        eq(country.isActive, true),
        eq(country.normalizedName, CAMBODIA_NORMALIZED_NAME),
      ),
    )
    .orderBy(
      sql`CASE WHEN ${city.name} = 'Phnom Penh' THEN 0 ELSE 1 END`,
      asc(city.name),
    );
}

export async function findActiveVolunteerCategoryById(
  categoryId: string,
): Promise<VolunteerReference | null> {
  const [categoryRow] = await db
    .select({
      id: volunteerCategory.id,
      name: volunteerCategory.name,
    })
    .from(volunteerCategory)
    .where(
      and(
        eq(volunteerCategory.id, categoryId),
        eq(volunteerCategory.status, "ACTIVE"),
      ),
    )
    .limit(1);

  return categoryRow ?? null;
}

export async function findVolunteerLocationById(
  locationId: string,
): Promise<VolunteerLocationRow | null> {
  const [locationRow] = await db
    .select({
      id: city.id,
      name: city.name,
    })
    .from(city)
    .innerJoin(country, eq(city.countryId, country.id))
    .where(
      and(
        eq(city.id, locationId),
        eq(city.isActive, true),
        eq(country.isActive, true),
        eq(country.normalizedName, CAMBODIA_NORMALIZED_NAME),
      ),
    )
    .limit(1);

  return locationRow ?? null;
}

export async function findVolunteerOpportunityApplicationTargetById(
  opportunityId: string,
): Promise<VolunteerApplicationOpportunityTarget | null> {
  const [row] = await db
    .select({
      opportunityId: volunteerOpportunity.id,
      opportunityTitle: volunteerOpportunity.title,
      opportunityOverview: volunteerOpportunity.overview,
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
      opportunityOverview: volunteerOpportunity.overview,
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

export type CreateVolunteerOpportunityInput =
  CreateVolunteerOpportunityBodyInput & {
    createdBy: string;
    category: VolunteerReference;
    location: VolunteerReference;
  };

type CreateVolunteerApplicationInput = {
  roleId: string;
  applicantId: string;
  opportunityId: string;
  opportunityTitle: string;
  coverImageKey: string;
  applicationDeadline: string;
  category: VolunteerReference;
  location: VolunteerReference;
  roleTitle: string;
  availability: string;
  relevantExperience: string;
  supportingDocuments: VolunteerSupportingDocument[];
};

type VolunteerOpportunityListRow = VolunteerOpportunityBaseRow & {
  applicationCount: number;
  capacity: number;
  viewerSave: boolean;
};

function hydrateVolunteerOpportunityListItem(
  row: VolunteerOpportunityListRow,
): VolunteerOpportunityListItem {
  return {
    id: row.opportunity.id,
    title: row.opportunity.title,
    overview: row.opportunity.overview,
    durationLabel: row.opportunity.durationLabel,
    commitmentLabel: row.opportunity.commitmentLabel,
    applicationDeadline: row.opportunity.applicationDeadline,
    applicationCount: toInteger(row.applicationCount),
    capacity: toInteger(row.capacity),
    coverImageKey: row.opportunity.coverImageKey,
    createdAt: row.opportunity.createdAt,
    viewerSave: row.viewerSave,
    category: row.category,
    location: row.location,
  };
}

function hydrateVolunteerApplication(
  application: VolunteerApplicationRow,
  roleTitle: string,
  opportunity: {
    id: string;
    title: string;
    coverImageKey: string;
    applicationDeadline: string;
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
    supportingDocuments:
      application.supportingDocuments as VolunteerSupportingDocument[],
    status: application.status,
    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
  };
}

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

function hydrateVolunteerOpportunityDetail(
  opportunity: VolunteerOpportunityRow,
  category: VolunteerReference,
  location: VolunteerReference,
  organizer: VolunteerOrganizerBase,
  roles: HydratedVolunteerRole[],
  requirementsByRoleId: Map<string, HydratedVolunteerRequirement[]>,
  applicationCount: number,
  viewerSave: boolean,
  appliedRoleIds: Set<string>,
): VolunteerOpportunityDetail {
  const capacity = roles.reduce(
    (total, role) => total + toInteger(role.capacity),
    0,
  );

  return {
    id: opportunity.id,
    category,
    location,
    title: opportunity.title,
    overview: opportunity.overview,
    communityImpact: opportunity.communityImpact,
    durationLabel: opportunity.durationLabel,
    commitmentLabel: opportunity.commitmentLabel,
    applicationDeadline: opportunity.applicationDeadline,
    applicationCount,
    capacity,
    coverImageKey: opportunity.coverImageKey,
    benefits: opportunity.benefits as string[],
    status: opportunity.status,
    publishedAt: opportunity.publishedAt,
    organizer: {
      ...organizer,
      contact: {
        email: opportunity.contactEmail,
        telegramUsername: opportunity.contactTelegramUsername,
        phone: opportunity.contactPhone,
        websiteUrl: opportunity.contactWebsiteUrl,
      },
    },
    createdBy: opportunity.createdBy,
    createdAt: opportunity.createdAt,
    updatedAt: opportunity.updatedAt,
    viewerSave,
    roles: roles.map((role) => ({
      id: role.id,
      title: role.title,
      commitmentLabel: role.commitmentLabel,
      capacity: role.capacity,
      responsibilities: role.responsibilities as string[],
      requirements: (requirementsByRoleId.get(role.id) ?? []).map(
        (requirement) => requirement.requirementText,
      ),
      displayOrder: role.displayOrder,
      viewerApplied: appliedRoleIds.has(role.id),
    })),
  };
}

function buildVolunteerOpportunitiesCursorFilter(
  cursor?: VolunteerOpportunitiesPageCursor,
): SQL<unknown> | undefined {
  if (!cursor) {
    return undefined;
  }

  return or(
    lt(volunteerOpportunity.publishedAt, cursor.publishedAt),
    and(
      eq(volunteerOpportunity.publishedAt, cursor.publishedAt),
      lt(volunteerOpportunity.createdAt, cursor.createdAt),
    ),
    and(
      eq(volunteerOpportunity.publishedAt, cursor.publishedAt),
      eq(volunteerOpportunity.createdAt, cursor.createdAt),
      lt(volunteerOpportunity.id, cursor.id),
    ),
  );
}

function buildVolunteerOpportunitiesWhereClause({
  categoryId,
  locationId,
  search,
  cursor,
}: Pick<
  GetVolunteerOpportunitiesQuery,
  "categoryId" | "locationId" | "search" | "cursor"
>) {
  const filters: SQL<unknown>[] = [
    eq(volunteerOpportunity.status, "PUBLISHED"),
    eq(volunteerCategory.status, "ACTIVE"),
    eq(city.isActive, true),
    isNotNull(volunteerOpportunity.publishedAt),
  ];

  if (categoryId) {
    filters.push(eq(volunteerOpportunity.categoryId, categoryId));
  }

  if (locationId) {
    filters.push(eq(volunteerOpportunity.cityId, locationId));
  }

  if (search) {
    const searchPattern = `%${search}%`;
    const searchFilter = or(
      ilike(volunteerOpportunity.title, searchPattern),
      ilike(volunteerOpportunity.overview, searchPattern),
      ilike(volunteerOpportunity.communityImpact, searchPattern),
      ilike(volunteerOpportunity.durationLabel, searchPattern),
      ilike(volunteerOpportunity.commitmentLabel, searchPattern),
      buildJsonbTextSearch(volunteerOpportunity.benefits, searchPattern),
      ilike(volunteerOpportunity.contactEmail, searchPattern),
      ilike(volunteerOpportunity.contactTelegramUsername, searchPattern),
      ilike(volunteerOpportunity.contactPhone, searchPattern),
      ilike(volunteerOpportunity.contactWebsiteUrl, searchPattern),
      ilike(volunteerCategory.name, searchPattern),
      ilike(volunteerCategory.description, searchPattern),
      ilike(volunteerCategory.slug, searchPattern),
      ilike(city.name, searchPattern),
      exists(
        db
          .select({ id: volunteerRoleSearch.id })
          .from(volunteerRoleSearch)
          .where(
            and(
              eq(volunteerRoleSearch.opportunityId, volunteerOpportunity.id),
              or(
                ilike(volunteerRoleSearch.title, searchPattern),
                ilike(volunteerRoleSearch.commitmentLabel, searchPattern),
                buildJsonbTextSearch(
                  volunteerRoleSearch.responsibilities,
                  searchPattern,
                ),
              ),
            ),
          ),
      ),
      exists(
        db
          .select({ id: volunteerRoleRequirementSearch.id })
          .from(volunteerRoleRequirementSearch)
          .innerJoin(
            volunteerRoleSearch,
            eq(volunteerRoleSearch.id, volunteerRoleRequirementSearch.roleId),
          )
          .where(
            and(
              eq(volunteerRoleSearch.opportunityId, volunteerOpportunity.id),
              ilike(
                volunteerRoleRequirementSearch.requirementText,
                searchPattern,
              ),
            ),
          ),
      ),
    );

    if (searchFilter) {
      filters.push(searchFilter);
    }
  }

  const cursorFilter = buildVolunteerOpportunitiesCursorFilter(cursor);
  if (cursorFilter) {
    filters.push(cursorFilter);
  }

  return and(...filters);
}

async function countVolunteerOpportunities({
  categoryId,
  locationId,
  search,
}: Omit<GetVolunteerOpportunitiesQuery, "limit" | "cursor">) {
  const [result] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(volunteerOpportunity)
    .innerJoin(
      volunteerCategory,
      eq(volunteerCategory.id, volunteerOpportunity.categoryId),
    )
    .innerJoin(city, eq(city.id, volunteerOpportunity.cityId))
    .where(
      buildVolunteerOpportunitiesWhereClause({
        categoryId,
        locationId,
        search,
        cursor: undefined,
      }),
    );

  return normalizePaginationTotal(result?.total);
}

function buildNextVolunteerOpportunitiesCursor(
  row: VolunteerOpportunityBaseRow,
): string {
  if (!row.opportunity.publishedAt) {
    throw new Error(
      "Cannot build volunteer opportunities cursor without publishedAt",
    );
  }

  return encodeVolunteerOpportunitiesPageCursor({
    publishedAt: row.opportunity.publishedAt,
    createdAt: row.opportunity.createdAt,
    id: row.opportunity.id,
  });
}

function buildNextSavedVolunteerOpportunitiesCursor(
  row: SavedVolunteerOpportunityListRow,
): string {
  return encodeSavedVolunteerOpportunitiesPageCursor({
    savedAt: row.savedAt,
    opportunityId: row.opportunity.id,
  });
}

function buildSavedVolunteerOpportunitiesCursorFilter(
  cursor?: SavedVolunteerOpportunitiesPageCursor,
): SQL<unknown> | undefined {
  if (!cursor) {
    return undefined;
  }

  return or(
    lt(volunteerOpportunitySaveList.createdAt, cursor.savedAt),
    and(
      eq(volunteerOpportunitySaveList.createdAt, cursor.savedAt),
      lt(volunteerOpportunity.id, cursor.opportunityId),
    ),
  );
}

// async function getActiveApplicationCountsByOpportunityIds(
//   executor: VolunteerQueryExecutor,
//   opportunityIds: string[],
// ): Promise<Map<string, number>> {
//   const uniqueOpportunityIds = [...new Set(opportunityIds)];
//   if (uniqueOpportunityIds.length === 0) {
//     return new Map();
//   }

//   const rows = await executor
//     .select({
//       opportunityId: volunteerApplication.opportunityId,
//       applicationCount: sql<number>`count(*)::int`.as("application_count"),
//     })
//     .from(volunteerApplication)
//     .where(
//       and(
//         inArray(volunteerApplication.opportunityId, uniqueOpportunityIds),
//         inArray(
//           volunteerApplication.status,
//           ACTIVE_VOLUNTEER_APPLICATION_STATUSES,
//         ),
//       ),
//     )
//     .groupBy(volunteerApplication.opportunityId);

//   return new Map(
//     rows.map((row) => [row.opportunityId, toInteger(row.applicationCount)]),
//   );
// }

async function getAcceptedApplicationCountsByOpportunityIds(
  executor: VolunteerQueryExecutor,
  opportunityIds: string[],
): Promise<Map<string, number>> {
  const uniqueOpportunityIds = [...new Set(opportunityIds)];
  if (uniqueOpportunityIds.length === 0) {
    return new Map();
  }

  const rows = await executor
    .select({
      opportunityId: volunteerApplication.opportunityId,
      applicationCount: sql<number>`count(*)::int`.as("application_count"),
    })
    .from(volunteerApplication)
    .where(
      and(
        inArray(volunteerApplication.opportunityId, uniqueOpportunityIds),
        eq(volunteerApplication.status, "CONFIRMED"),
      ),
    )
    .groupBy(volunteerApplication.opportunityId);

  return new Map(
    rows.map((row) => [row.opportunityId, toInteger(row.applicationCount)]),
  );
}

async function getOpportunityCapacitiesByOpportunityIds(
  executor: VolunteerQueryExecutor,
  opportunityIds: string[],
): Promise<Map<string, number>> {
  const uniqueOpportunityIds = [...new Set(opportunityIds)];
  if (uniqueOpportunityIds.length === 0) {
    return new Map();
  }

  const rows = await executor
    .select({
      opportunityId: volunteerRole.opportunityId,
      capacity:
        sql<number>`coalesce(sum(${volunteerRole.capacity}), 0)::int`.as(
          "capacity",
        ),
    })
    .from(volunteerRole)
    .where(inArray(volunteerRole.opportunityId, uniqueOpportunityIds))
    .groupBy(volunteerRole.opportunityId);

  return new Map(
    rows.map((row) => [row.opportunityId, toInteger(row.capacity)]),
  );
}

async function getSavedOpportunityIdsByOpportunityIds(
  executor: VolunteerQueryExecutor,
  opportunityIds: string[],
  viewerId?: string,
): Promise<Set<string>> {
  const uniqueOpportunityIds = [...new Set(opportunityIds)];
  if (!viewerId || uniqueOpportunityIds.length === 0) {
    return new Set();
  }

  const rows = await executor
    .select({
      opportunityId: volunteerOpportunitySave.opportunityId,
    })
    .from(volunteerOpportunitySave)
    .where(
      and(
        inArray(volunteerOpportunitySave.opportunityId, uniqueOpportunityIds),
        eq(volunteerOpportunitySave.saverId, viewerId),
      ),
    );

  return new Set(rows.map((row) => row.opportunityId));
}

async function getAppliedRoleIdsByRoleIds(
  executor: VolunteerQueryExecutor,
  roleIds: string[],
  viewerId?: string,
): Promise<Set<string>> {
  const uniqueRoleIds = [...new Set(roleIds)];
  if (!viewerId || uniqueRoleIds.length === 0) {
    return new Set();
  }

  const rows = await executor
    .select({
      roleId: volunteerApplication.roleId,
    })
    .from(volunteerApplication)
    .where(
      and(
        inArray(volunteerApplication.roleId, uniqueRoleIds),
        eq(volunteerApplication.applicantId, viewerId),
        inArray(
          volunteerApplication.status,
          ACTIVE_VOLUNTEER_APPLICATION_STATUSES,
        ),
      ),
    );

  return new Set(rows.map((row) => row.roleId));
}

async function hydrateVolunteerOpportunityDetails(
  rows: VolunteerOpportunityBaseRow[],
  viewerId?: string,
): Promise<VolunteerOpportunityDetail[]> {
  if (rows.length === 0) {
    return [];
  }

  const opportunityIds = rows.map((row) => row.opportunity.id);
  const roles = await db
    .select()
    .from(volunteerRole)
    .where(inArray(volunteerRole.opportunityId, opportunityIds))
    .orderBy(
      asc(volunteerRole.displayOrder),
      asc(volunteerRole.createdAt),
      asc(volunteerRole.id),
    );

  const rolesByOpportunityId = new Map<string, VolunteerRoleRow[]>();
  for (const role of roles) {
    const opportunityRoles = rolesByOpportunityId.get(role.opportunityId);
    if (!opportunityRoles) {
      rolesByOpportunityId.set(role.opportunityId, [role]);
      continue;
    }

    opportunityRoles.push(role);
  }

  const roleIds = roles.map((role) => role.id);
  const requirements =
    roleIds.length === 0
      ? []
      : await db
          .select()
          .from(volunteerRoleRequirement)
          .where(inArray(volunteerRoleRequirement.roleId, roleIds))
          .orderBy(
            asc(volunteerRoleRequirement.displayOrder),
            asc(volunteerRoleRequirement.createdAt),
            asc(volunteerRoleRequirement.id),
          );

  const requirementsByRoleId = new Map<string, VolunteerRoleRequirementRow[]>();
  for (const requirement of requirements) {
    const roleRequirements = requirementsByRoleId.get(requirement.roleId);
    if (!roleRequirements) {
      requirementsByRoleId.set(requirement.roleId, [requirement]);
      continue;
    }

    roleRequirements.push(requirement);
  }

  const organizerIds = [
    ...new Set(rows.map((row) => row.opportunity.createdBy)),
  ];
  const organizerById = await getVolunteerOrganizersByUserIds(db, organizerIds);
  const [applicationCountByOpportunityId, savedOpportunityIds, appliedRoleIds] =
    await Promise.all([
      getAcceptedApplicationCountsByOpportunityIds(db, opportunityIds),
      getSavedOpportunityIdsByOpportunityIds(db, opportunityIds, viewerId),
      getAppliedRoleIdsByRoleIds(db, roleIds, viewerId),
    ]);

  return rows.map((row) => {
    const organizer = organizerById.get(row.opportunity.createdBy);

    if (!organizer) {
      throw new Error(
        `Volunteer organizer could not be loaded for user ${row.opportunity.createdBy}`,
      );
    }

    return hydrateVolunteerOpportunityDetail(
      row.opportunity,
      row.category,
      row.location,
      organizer,
      rolesByOpportunityId.get(row.opportunity.id) ?? [],
      requirementsByRoleId,
      applicationCountByOpportunityId.get(row.opportunity.id) ?? 0,
      savedOpportunityIds.has(row.opportunity.id),
      appliedRoleIds,
    );
  });
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
        isNotNull(volunteerOpportunity.publishedAt),
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
      locationId: organizerProfileCity.id,
      locationName: organizerProfileCity.name,
      opportunityCount:
        sql<number>`coalesce(${opportunityCounts.opportunityCount}, 0)::int`.as(
          "opportunityCount",
        ),
    })
    .from(user)
    .leftJoin(userProfile, eq(userProfile.userId, user.id))
    .leftJoin(
      organizerProfileCity,
      eq(organizerProfileCity.id, userProfile.cityId),
    )
    .leftJoin(opportunityCounts, eq(opportunityCounts.userId, user.id))
    .where(inArray(user.id, uniqueUserIds));

  return new Map(
    rows.map((row) => [
      row.id,
      hydrateVolunteerOrganizer(row as VolunteerOrganizerQueryRow),
    ]),
  );
}

async function getVolunteerOrganizerByUserId(
  executor: VolunteerQueryExecutor,
  userId: string,
): Promise<VolunteerOrganizerBase | null> {
  const organizersById = await getVolunteerOrganizersByUserIds(executor, [
    userId,
  ]);
  return organizersById.get(userId) ?? null;
}

export async function getVolunteerOpportunities(
  {
    categoryId,
    locationId,
    search,
    limit,
    cursor,
  }: GetVolunteerOpportunitiesQuery,
  viewerId?: string,
): Promise<VolunteerOpportunitiesListResult> {
  const rowsQuery = db
    .select({
      opportunity: volunteerOpportunity,
      category: {
        id: volunteerCategory.id,
        name: volunteerCategory.name,
      },
      location: {
        id: city.id,
        name: city.name,
      },
    })
    .from(volunteerOpportunity)
    .innerJoin(
      volunteerCategory,
      eq(volunteerCategory.id, volunteerOpportunity.categoryId),
    )
    .innerJoin(city, eq(city.id, volunteerOpportunity.cityId))
    .where(
      buildVolunteerOpportunitiesWhereClause({
        categoryId,
        locationId,
        search,
        cursor,
      }),
    )
    .orderBy(
      desc(volunteerOpportunity.publishedAt),
      desc(volunteerOpportunity.createdAt),
      desc(volunteerOpportunity.id),
    )
    .limit(limit + 1);

  const [rows, total] = await Promise.all([
    rowsQuery,
    countVolunteerOpportunities({
      categoryId,
      locationId,
      search,
    }),
  ]);
  const { pageRows: paginatedRows, pagination } =
    buildCursorPagination<VolunteerOpportunityBaseRow>({
      rows,
      limit,
      total,
      getNextCursor: buildNextVolunteerOpportunitiesCursor,
    });
  const opportunityIds = paginatedRows.map((row) => row.opportunity.id);
  const [
    applicationCountByOpportunityId,
    capacityByOpportunityId,
    savedOpportunityIds,
  ] = await Promise.all([
    getAcceptedApplicationCountsByOpportunityIds(db, opportunityIds),
    getOpportunityCapacitiesByOpportunityIds(db, opportunityIds),
    getSavedOpportunityIdsByOpportunityIds(db, opportunityIds, viewerId),
  ]);

  const opportunityRows: VolunteerOpportunityListRow[] = paginatedRows.map(
    (row) => ({
      ...row,
      applicationCount:
        applicationCountByOpportunityId.get(row.opportunity.id) ?? 0,
      capacity: capacityByOpportunityId.get(row.opportunity.id) ?? 0,
      viewerSave: savedOpportunityIds.has(row.opportunity.id),
    }),
  );
  const opportunities = opportunityRows.map((row) =>
    hydrateVolunteerOpportunityListItem(row),
  );

  return {
    opportunities,
    pagination,
  };
}

export async function getSavedVolunteerOpportunities(
  userId: string,
  { limit, cursor }: GetSavedVolunteerOpportunitiesQuery,
): Promise<VolunteerOpportunitiesListResult> {
  const cursorFilter = buildSavedVolunteerOpportunitiesCursorFilter(cursor);
  const filters: SQL<unknown>[] = [
    eq(volunteerOpportunitySaveList.saverId, userId),
    eq(volunteerOpportunity.status, "PUBLISHED"),
    eq(volunteerCategory.status, "ACTIVE"),
    eq(city.isActive, true),
    eq(country.isActive, true),
    eq(country.normalizedName, CAMBODIA_NORMALIZED_NAME),
    isNotNull(volunteerOpportunity.publishedAt),
  ];

  if (cursorFilter) {
    filters.push(cursorFilter);
  }

  const rowsQuery = db
    .select({
      opportunity: volunteerOpportunity,
      category: {
        id: volunteerCategory.id,
        name: volunteerCategory.name,
      },
      location: {
        id: city.id,
        name: city.name,
      },
      savedAt: volunteerOpportunitySaveList.createdAt,
    })
    .from(volunteerOpportunitySaveList)
    .innerJoin(
      volunteerOpportunity,
      eq(volunteerOpportunity.id, volunteerOpportunitySaveList.opportunityId),
    )
    .innerJoin(
      volunteerCategory,
      eq(volunteerCategory.id, volunteerOpportunity.categoryId),
    )
    .innerJoin(city, eq(city.id, volunteerOpportunity.cityId))
    .innerJoin(country, eq(country.id, city.countryId))
    .where(and(...filters))
    .orderBy(
      desc(volunteerOpportunitySaveList.createdAt),
      desc(volunteerOpportunity.id),
    )
    .limit(limit + 1);

  const countQuery = db
    .select({ total: sql<number>`count(*)::int` })
    .from(volunteerOpportunitySaveList)
    .innerJoin(
      volunteerOpportunity,
      eq(volunteerOpportunity.id, volunteerOpportunitySaveList.opportunityId),
    )
    .innerJoin(
      volunteerCategory,
      eq(volunteerCategory.id, volunteerOpportunity.categoryId),
    )
    .innerJoin(city, eq(city.id, volunteerOpportunity.cityId))
    .innerJoin(country, eq(country.id, city.countryId))
    .where(
      and(
        eq(volunteerOpportunitySaveList.saverId, userId),
        eq(volunteerOpportunity.status, "PUBLISHED"),
        eq(volunteerCategory.status, "ACTIVE"),
        eq(city.isActive, true),
        eq(country.isActive, true),
        eq(country.normalizedName, CAMBODIA_NORMALIZED_NAME),
        isNotNull(volunteerOpportunity.publishedAt),
      ),
    );

  const [rows, countResult] = await Promise.all([rowsQuery, countQuery]);
  const total = normalizePaginationTotal(countResult[0]?.total);
  const { pageRows: paginatedRows, pagination } =
    buildCursorPagination<SavedVolunteerOpportunityListRow>({
      rows: rows.map((row) => ({
        ...row,
        applicationCount: 0,
        capacity: 0,
        viewerSave: true,
      })),
      limit,
      total,
      getNextCursor: buildNextSavedVolunteerOpportunitiesCursor,
    });
  const opportunityIds = paginatedRows.map((row) => row.opportunity.id);
  const [applicationCountByOpportunityId, capacityByOpportunityId] =
    await Promise.all([
      getAcceptedApplicationCountsByOpportunityIds(db, opportunityIds),
      getOpportunityCapacitiesByOpportunityIds(db, opportunityIds),
    ]);

  const opportunities = paginatedRows.map((row) =>
    hydrateVolunteerOpportunityListItem({
      ...row,
      applicationCount:
        applicationCountByOpportunityId.get(row.opportunity.id) ?? 0,
      capacity: capacityByOpportunityId.get(row.opportunity.id) ?? 0,
      viewerSave: true,
    }),
  );

  return {
    opportunities,
    pagination,
  };
}

export async function getVolunteerOpportunityById(
  opportunityId: string,
  viewerId?: string,
) {
  const [row] = await db
    .select({
      opportunity: volunteerOpportunity,
      category: {
        id: volunteerCategory.id,
        name: volunteerCategory.name,
      },
      location: {
        id: city.id,
        name: city.name,
      },
    })
    .from(volunteerOpportunity)
    .innerJoin(
      volunteerCategory,
      eq(volunteerCategory.id, volunteerOpportunity.categoryId),
    )
    .innerJoin(city, eq(city.id, volunteerOpportunity.cityId))
    .innerJoin(country, eq(city.countryId, country.id))
    .where(
      and(
        eq(volunteerOpportunity.id, opportunityId),
        eq(volunteerOpportunity.status, "PUBLISHED"),
        eq(volunteerCategory.status, "ACTIVE"),
        eq(city.isActive, true),
        eq(country.isActive, true),
        eq(country.normalizedName, CAMBODIA_NORMALIZED_NAME),
        isNotNull(volunteerOpportunity.publishedAt),
      ),
    )
    .limit(1);

  if (!row) {
    return null;
  }

  const [opportunity] = await hydrateVolunteerOpportunityDetails(
    [row],
    viewerId,
  );
  return opportunity ?? null;
}

export async function createVolunteerOpportunity(
  data: CreateVolunteerOpportunityInput,
): Promise<VolunteerOpportunityDetail> {
  return db.transaction(async (tx) => {
    const [newOpportunity] = await tx
      .insert(volunteerOpportunity)
      .values({
        categoryId: data.categoryId,
        cityId: data.locationId,
        title: data.title,
        overview: data.overview,
        communityImpact: data.communityImpact,
        durationLabel: data.durationLabel,
        commitmentLabel: data.commitmentLabel,
        applicationDeadline: data.applicationDeadline,
        coverImageKey: data.coverImageKey,
        benefits: data.benefits,
        contactEmail: data.contact.email,
        contactTelegramUsername: data.contact.telegramUsername,
        contactPhone: data.contact.phone,
        contactWebsiteUrl: data.contact.websiteUrl,
        status: "PUBLISHED",
        publishedAt: new Date().toISOString(),
        createdBy: data.createdBy,
      })
      .returning();

    const createdRoles: Array<
      Omit<VolunteerOpportunityDetail["roles"][number], "viewerApplied">
    > = [];

    for (const [roleIndex, roleInput] of data.roles.entries()) {
      const [newRole] = await tx
        .insert(volunteerRole)
        .values({
          opportunityId: newOpportunity.id,
          title: roleInput.title,
          commitmentLabel: roleInput.commitmentLabel,
          capacity: roleInput.capacity,
          responsibilities: roleInput.responsibilities,
          displayOrder: roleIndex,
        })
        .returning();

      let insertedRequirements: VolunteerRoleRequirementRow[] = [];
      if (roleInput.requirements.length > 0) {
        insertedRequirements = await tx
          .insert(volunteerRoleRequirement)
          .values(
            roleInput.requirements.map((requirementText, requirementIndex) => ({
              roleId: newRole.id,
              requirementText,
              displayOrder: requirementIndex,
            })),
          )
          .returning();
      }

      createdRoles.push({
        id: newRole.id,
        title: newRole.title,
        commitmentLabel: newRole.commitmentLabel,
        capacity: newRole.capacity,
        responsibilities: newRole.responsibilities as string[],
        requirements: insertedRequirements
          .sort((left, right) => left.displayOrder - right.displayOrder)
          .map((requirement) => requirement.requirementText),
        displayOrder: newRole.displayOrder,
      });
    }

    const organizer = await getVolunteerOrganizerByUserId(tx, data.createdBy);

    if (!organizer) {
      throw new Error(
        "Created volunteer opportunity organizer could not be loaded",
      );
    }

    return hydrateVolunteerOpportunityDetail(
      newOpportunity,
      data.category,
      data.location,
      organizer,
      createdRoles.map((role) => ({
        id: role.id,
        title: role.title,
        commitmentLabel: role.commitmentLabel,
        capacity: role.capacity,
        responsibilities: role.responsibilities,
        displayOrder: role.displayOrder,
      })),
      new Map(
        createdRoles.map((role) => [
          role.id,
          role.requirements.map((requirementText) => ({
            requirementText,
          })),
        ]),
      ),
      0,
      false,
      new Set(),
    );
  });
}

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
        supportingDocuments: data.supportingDocuments,
        status: "SUBMITTED",
      })
      .returning();

    return hydrateVolunteerApplication(application, data.roleTitle, {
      id: data.opportunityId,
      title: data.opportunityTitle,
      coverImageKey: data.coverImageKey,
      applicationDeadline: data.applicationDeadline,
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
      applicationDeadline: volunteerOpportunity.applicationDeadline,
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
      applicationDeadline: row.applicationDeadline,
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

export async function saveVolunteerOpportunityForUser(
  opportunityId: string,
  userId: string,
): Promise<{ opportunity: VolunteerActivityTarget; created: boolean } | null> {
  return db.transaction(async (tx) => {
    const [opportunity] = await tx
      .select({
        id: volunteerOpportunity.id,
        title: volunteerOpportunity.title,
        overview: volunteerOpportunity.overview,
      })
      .from(volunteerOpportunity)
      .innerJoin(
        volunteerCategory,
        eq(volunteerCategory.id, volunteerOpportunity.categoryId),
      )
      .innerJoin(city, eq(city.id, volunteerOpportunity.cityId))
      .innerJoin(country, eq(city.countryId, country.id))
      .where(
        and(
          eq(volunteerOpportunity.id, opportunityId),
          eq(volunteerOpportunity.status, "PUBLISHED"),
          eq(volunteerCategory.status, "ACTIVE"),
          eq(city.isActive, true),
          eq(country.isActive, true),
          eq(country.normalizedName, CAMBODIA_NORMALIZED_NAME),
          isNotNull(volunteerOpportunity.publishedAt),
        ),
      )
      .limit(1);

    if (!opportunity) {
      return null;
    }

    const saveInsertData: VolunteerOpportunitySaveInsert = {
      opportunityId,
      saverId: userId,
    };

    const insertedSaves = await tx
      .insert(volunteerOpportunitySave)
      .values(saveInsertData)
      .onConflictDoNothing({
        target: [
          volunteerOpportunitySave.opportunityId,
          volunteerOpportunitySave.saverId,
        ],
      })
      .returning({ opportunityId: volunteerOpportunitySave.opportunityId });

    return {
      opportunity,
      created: insertedSaves.length > 0,
    };
  });
}

export async function unsaveVolunteerOpportunityForUser(
  opportunityId: string,
  userId: string,
): Promise<boolean> {
  const unsavedOpportunityId = await db.transaction(async (tx) => {
    const [deletedSave] = await tx
      .delete(volunteerOpportunitySave)
      .where(
        and(
          eq(volunteerOpportunitySave.opportunityId, opportunityId),
          eq(volunteerOpportunitySave.saverId, userId),
        ),
      )
      .returning({ opportunityId: volunteerOpportunitySave.opportunityId });

    return deletedSave?.opportunityId ?? null;
  });

  return Boolean(unsavedOpportunityId);
}
