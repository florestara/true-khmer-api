import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
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
} from "./post-volunteer.schema";

type VolunteerCategoryRow = typeof volunteerCategory.$inferSelect;
type VolunteerCategoryInsert = typeof volunteerCategory.$inferInsert;
type VolunteerLocationRow = {
  id: string;
  name: string;
};
type VolunteerOpportunityRow = typeof volunteerOpportunity.$inferSelect;
type VolunteerRoleRow = typeof volunteerRole.$inferSelect;
type VolunteerRoleRequirementRow = typeof volunteerRoleRequirement.$inferSelect;

const CAMBODIA_NORMALIZED_NAME =
  env.VOLUNTEER_COUNTRY_NORMALIZED_NAME;

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

export async function findActiveVolunteerCategoryById(categoryId: string) {
  const [categoryRow] = await db
    .select({
      id: volunteerCategory.id,
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

export async function findVolunteerLocationById(locationId: string) {
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
  };

export type CreatedVolunteerOpportunity = {
  id: string;
  categoryId: string;
  locationId: string;
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

function hydrateVolunteerOpportunity(
  opportunity: VolunteerOpportunityRow,
  roles: VolunteerRoleRow[],
  requirementsByRoleId: Map<string, VolunteerRoleRequirementRow[]>,
): CreatedVolunteerOpportunity {
  return {
    id: opportunity.id,
    categoryId: opportunity.categoryId,
    locationId: opportunity.cityId,
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
      requirements: (requirementsByRoleId.get(role.id) ?? [])
        .sort((left, right) => left.displayOrder - right.displayOrder)
        .map((requirement) => requirement.requirementText),
      displayOrder: role.displayOrder,
    })),
  };
}

export async function getVolunteerOpportunities(): Promise<
  CreatedVolunteerOpportunity[]
> {
  const opportunities = await db
    .select()
    .from(volunteerOpportunity)
    .where(eq(volunteerOpportunity.status, "PUBLISHED"))
    .orderBy(
      desc(volunteerOpportunity.publishedAt),
      desc(volunteerOpportunity.createdAt),
      desc(volunteerOpportunity.id),
    );

  if (opportunities.length === 0) {
    return [];
  }

  const opportunityIds = opportunities.map((opportunity) => opportunity.id);
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

  return opportunities.map((opportunity) =>
    hydrateVolunteerOpportunity(
      opportunity,
      rolesByOpportunityId.get(opportunity.id) ?? [],
      requirementsByRoleId,
    ),
  );
}

export async function createVolunteerOpportunity(
  data: CreateVolunteerOpportunityInput,
): Promise<CreatedVolunteerOpportunity> {
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

    const createdRoles: CreatedVolunteerOpportunity["roles"] = [];

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

    return hydrateVolunteerOpportunity(
      newOpportunity,
      createdRoles.map((role) => ({
        id: role.id,
        opportunityId: newOpportunity.id,
        title: role.title,
        commitmentLabel: role.commitmentLabel,
        capacity: role.capacity,
        responsibilities: role.responsibilities,
        displayOrder: role.displayOrder,
        createdAt: newOpportunity.createdAt,
        updatedAt: newOpportunity.updatedAt,
      })),
      new Map(
        createdRoles.map((role) => [
          role.id,
          role.requirements.map((requirementText, displayOrder) => ({
            id: `${role.id}:${displayOrder}`,
            roleId: role.id,
            requirementText,
            displayOrder,
            createdAt: newOpportunity.createdAt,
            updatedAt: newOpportunity.updatedAt,
          })),
        ]),
      ),
    );
  });
}
