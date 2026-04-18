import {
  and,
  asc,
  desc,
  eq,
  exists,
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
  volunteerCategory,
  volunteerOpportunity,
  volunteerRole,
  volunteerRoleRequirement,
} from "../../../db/schema";
import {
  VOLUNTEER_ADVISORY_LOCK_NAMESPACE,
  VOLUNTEER_CATEGORY_DISPLAY_ORDER_LOCK_KEY,
} from "../lib/constants";
import type {
  CreateVolunteerCategoryInput,
  CreateVolunteerOpportunityBodyInput,
  GetVolunteerOpportunitiesQuery,
  VolunteerOpportunitiesPageCursor,
} from "./post-volunteer.schema";
import { encodeVolunteerOpportunitiesPageCursor } from "./post-volunteer.schema";

type VolunteerCategoryRow = typeof volunteerCategory.$inferSelect;
type VolunteerCategoryInsert = typeof volunteerCategory.$inferInsert;
type VolunteerLocationRow = {
  id: string;
  name: string;
};
type VolunteerOpportunityRow = typeof volunteerOpportunity.$inferSelect;
type VolunteerRoleRow = typeof volunteerRole.$inferSelect;
type VolunteerRoleRequirementRow = typeof volunteerRoleRequirement.$inferSelect;
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
type VolunteerOpportunitiesPagination = {
  limit: number;
  hasMore: boolean;
  nextCursor: string | null;
};
type VolunteerReference = {
  id: string;
  name: string;
};
export type VolunteerOpportunityListItem = {
  id: string;
  title: string;
  overview: string;
  durationLabel: string;
  commitmentLabel: string;
  applicationDeadline: string;
  coverImageUrl: string | null;
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
  durationLabel: string;
  commitmentLabel: string;
  applicationDeadline: string;
  coverImageKey: string;
  coverImageUrl: string | null;
  benefits: string[];
  contact: {
    email: string;
    telegramUsername: string | null;
    phone: string | null;
    websiteUrl: string | null;
  };
  status: VolunteerOpportunityRow["status"];
  publishedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  roles: Array<{
    id: string;
    title: string;
    commitmentLabel: string;
    capacity: number;
    responsibilities: string[];
    requirements: string[];
    displayOrder: number;
  }>;
};
type VolunteerOpportunitiesListResult = {
  opportunities: VolunteerOpportunityListItem[];
  pagination: VolunteerOpportunitiesPagination;
};

const CAMBODIA_NORMALIZED_NAME =
  env.VOLUNTEER_COUNTRY_NORMALIZED_NAME;
const volunteerRoleSearch = aliasedTable(volunteerRole, "volunteer_role_search");
const volunteerRoleRequirementSearch = aliasedTable(
  volunteerRoleRequirement,
  "volunteer_role_requirement_search",
);

function buildJsonbTextSearch(column: SQLWrapper, pattern: string) {
  return sql`${column}::text ilike ${pattern}`;
}

export async function getVolunteerCategories(): Promise<VolunteerCategoryRow[]> {
  return db
    .select()
    .from(volunteerCategory)
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
    .orderBy(asc(city.name));
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

export type CreateVolunteerOpportunityInput =
  CreateVolunteerOpportunityBodyInput & {
    createdBy: string;
    coverImageUrl: string | null;
    category: VolunteerReference;
    location: VolunteerReference;
  };

type VolunteerOpportunityListRow = {
  opportunity: VolunteerOpportunityRow;
  category: VolunteerReference;
  location: VolunteerReference;
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
    coverImageUrl: row.opportunity.coverImageUrl,
    category: row.category,
    location: row.location,
  };
}

function hydrateVolunteerOpportunityDetail(
  opportunity: VolunteerOpportunityRow,
  category: VolunteerReference,
  location: VolunteerReference,
  roles: HydratedVolunteerRole[],
  requirementsByRoleId: Map<string, HydratedVolunteerRequirement[]>,
): VolunteerOpportunityDetail {
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
    coverImageKey: opportunity.coverImageKey,
    coverImageUrl: opportunity.coverImageUrl,
    benefits: opportunity.benefits as string[],
    contact: {
      email: opportunity.contactEmail,
      telegramUsername: opportunity.contactTelegramUsername,
      phone: opportunity.contactPhone,
      websiteUrl: opportunity.contactWebsiteUrl,
    },
    status: opportunity.status,
    publishedAt: opportunity.publishedAt,
    createdBy: opportunity.createdBy,
    createdAt: opportunity.createdAt,
    updatedAt: opportunity.updatedAt,
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

function buildNextVolunteerOpportunitiesCursor(
  row: VolunteerOpportunityListRow,
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

async function hydrateVolunteerOpportunityDetails(
  rows: VolunteerOpportunityListRow[],
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

  return rows.map((row) =>
    hydrateVolunteerOpportunityDetail(
      row.opportunity,
      row.category,
      row.location,
      rolesByOpportunityId.get(row.opportunity.id) ?? [],
      requirementsByRoleId,
    ),
  );
}

export async function getVolunteerOpportunities({
  categoryId,
  locationId,
  search,
  limit,
  cursor,
}: GetVolunteerOpportunitiesQuery): Promise<VolunteerOpportunitiesListResult> {
  const rows = await db
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

  const hasMore = rows.length > limit;
  const opportunityRows: VolunteerOpportunityListRow[] = hasMore
    ? rows.slice(0, limit)
    : rows;
  const opportunities = opportunityRows.map((row) =>
    hydrateVolunteerOpportunityListItem(row),
  );
  const lastOpportunityRow =
    opportunityRows.length > 0
      ? opportunityRows[opportunityRows.length - 1]
      : null;
  const nextCursor =
    hasMore && lastOpportunityRow
      ? buildNextVolunteerOpportunitiesCursor(lastOpportunityRow)
      : null;

  return {
    opportunities,
    pagination: {
      limit,
      hasMore,
      nextCursor,
    },
  };
}

export async function getVolunteerOpportunityById(opportunityId: string) {
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
    .where(
      and(
        eq(volunteerOpportunity.id, opportunityId),
        eq(volunteerOpportunity.status, "PUBLISHED"),
        eq(volunteerCategory.status, "ACTIVE"),
        eq(city.isActive, true),
        isNotNull(volunteerOpportunity.publishedAt),
      ),
    )
    .limit(1);

  if (!row) {
    return null;
  }

  const [opportunity] = await hydrateVolunteerOpportunityDetails([row]);
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
        coverImageUrl: data.coverImageUrl,
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

    const createdRoles: VolunteerOpportunityDetail["roles"] = [];

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

    return hydrateVolunteerOpportunityDetail(
      newOpportunity,
      data.category,
      data.location,
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
    );
  });
}
