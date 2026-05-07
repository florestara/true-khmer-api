import type { Context } from "hono";
import { POSTGRES_UNIQUE_VIOLATION } from "../../../db/constants";
import {
  presignVolunteerApplicationDocumentUpload,
  presignVolunteerCoverUpload,
} from "../../uploads/uploads.service";
import { getAuthUserId } from "../../auth/utils/get-auth";
import {
  createVolunteerApplication,
  createVolunteerCategory,
  createVolunteerOpportunity,
  findActiveVolunteerCategoryById,
  findVolunteerApplicationTargetByRoleId,
  findVolunteerLocationById,
  findVolunteerOpportunityApplicationTargetById,
  getSavedVolunteerOpportunities,
  getVolunteerCategories,
  getVolunteerOpportunityById,
  getVolunteerLocations,
  getVolunteerOpportunities,
  saveVolunteerOpportunityForUser,
  unsaveVolunteerOpportunityForUser,
} from "./post-volunteer.query";
import type {
  CreateVolunteerApplicationBodyInput,
  CreateVolunteerCategoryBodyInput,
  CreateVolunteerOpportunityBodyInput,
  GetSavedVolunteerOpportunitiesQuery,
  GetVolunteerOpportunityParams,
  GetVolunteerOpportunitiesQuery,
  PresignVolunteerApplicationDocumentUploadPayload,
  PresignVolunteerOpportunityCoverUploadPayload,
} from "./post-volunteer.schema";
import { recordRecentActivityQuietly } from "../../recent-activity/recent-activity.service";

const VOLUNTEER_CATEGORY_SLUG_UNIQUE_INDEX =
  "volunteer_category_slug_unique_idx";
const VOLUNTEER_CATEGORY_NAME_UNIQUE_INDEX =
  "volunteer_category_name_unique_idx";
const VOLUNTEER_APPLICATION_APPLICANT_ROLE_UNIQUE_INDEX =
  "volunteer_application_applicant_role_active_unique_idx";

function quoteActivityText(value: string) {
  return `'${value}'`;
}

type PostgresErrorLike = {
  code?: string;
  constraint?: string;
  constraint_name?: string;
  cause?: PostgresErrorLike;
};

function getPostgresError(error: unknown): PostgresErrorLike | null {
  const candidate = error as PostgresErrorLike | null;
  return candidate?.cause ?? candidate ?? null;
}

function getPostgresConstraint(error: PostgresErrorLike | null) {
  return error?.constraint ?? error?.constraint_name;
}

function sanitizePublicVolunteerOpportunity<
  T extends {
    createdBy: string;
  },
>(opportunity: T) {
  const { createdBy: _createdBy, ...publicOpportunity } = opportunity;

  return publicOpportunity;
}

function normalizeOwnedCoverImageKey(
  userId: string,
  coverImageKey: string,
): string | null {
  return normalizeOwnedObjectKey(`volunteer-covers/${userId}/`, coverImageKey);
}

function normalizeOwnedSupportingDocumentKey(
  opportunityId: string,
  applicantId: string,
  supportingDocumentKey: string,
): string | null {
  return normalizeOwnedObjectKey(
    `volunteer-applicant/supporting-docs/${opportunityId}/${applicantId}/`,
    supportingDocumentKey,
  );
}

function normalizeOwnedSupportingDocumentKeys(
  opportunityId: string,
  applicantId: string,
  supportingDocumentKeys: string[],
): string[] | null {
  const normalizedKeys = supportingDocumentKeys.map((key) =>
    normalizeOwnedSupportingDocumentKey(opportunityId, applicantId, key),
  );

  if (normalizedKeys.some((key) => key === null)) {
    return null;
  }

  const resolvedNormalizedKeys = normalizedKeys as string[];
  if (new Set(resolvedNormalizedKeys).size !== resolvedNormalizedKeys.length) {
    return null;
  }

  return resolvedNormalizedKeys;
}

function normalizeOwnedObjectKey(
  expectedPrefix: string,
  objectKey: string,
): string | null {
  const rawKey = objectKey.startsWith("/") ? objectKey.slice(1) : objectKey;
  let normalizedKey: string;
  try {
    normalizedKey = decodeURIComponent(rawKey);
  } catch {
    return null;
  }

  const forbiddenPattern = /(^|\/)\.\.(\/|$)|\\|\/\/|[\u0000-\u001F\u007F]/;
  if (forbiddenPattern.test(normalizedKey)) {
    return null;
  }

  if (!normalizedKey.startsWith(expectedPrefix)) {
    return null;
  }

  return normalizedKey;
}

function resolveVolunteerApplicationTargetError(
  target:
    | {
        createdBy: string;
        applicationDeadline: string;
        status: string;
        publishedAt: string | null;
      }
    | null,
  applicantId: string,
  notFoundError: string,
) {
  if (!target || target.status !== "PUBLISHED" || !target.publishedAt) {
    return { status: 404 as const, error: notFoundError };
  }

  if (target.createdBy === applicantId) {
    return {
      status: 400 as const,
      error: "You cannot apply to your own volunteer opportunity",
    };
  }

  if (Date.parse(target.applicationDeadline) <= Date.now()) {
    return {
      status: 400 as const,
      error: "Application deadline has passed or been reached",
    };
  }

  return null;
}

export async function handleGetVolunteerCategories(c: Context) {
  try {
    const categories = await getVolunteerCategories();
    return c.json({ ok: true, categories }, 200);
  } catch (err) {
    console.error("Failed to get volunteer categories", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}

export async function handleGetVolunteerLocations(c: Context) {
  try {
    const locations = await getVolunteerLocations();
    return c.json({ ok: true, locations }, 200);
  } catch (err) {
    console.error("Failed to get volunteer locations", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}

export async function handleGetVolunteerOpportunities(
  c: Context,
  query: GetVolunteerOpportunitiesQuery,
  isPublic = false,
) {
  let viewerId: string | undefined;
  if (!isPublic) {
    const authResult = getAuthUserId(c);
    if (!authResult.ok) {
      return authResult.response;
    }
    viewerId = authResult.userId;
  }

  try {
    const checks = await Promise.all([
      query.categoryId
        ? findActiveVolunteerCategoryById(query.categoryId)
        : Promise.resolve(null),
      query.locationId
        ? findVolunteerLocationById(query.locationId)
        : Promise.resolve(null),
    ]);

    if (query.categoryId && !checks[0]) {
      return c.json({ ok: false, error: "Volunteer category not found" }, 404);
    }

    if (query.locationId && !checks[1]) {
      return c.json({ ok: false, error: "Location not found" }, 404);
    }

    const result = await getVolunteerOpportunities(query, viewerId);
    return c.json({ ok: true, ...result }, 200);
  } catch (err) {
    console.error("Failed to get volunteer opportunities", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}

export async function handleGetSavedVolunteerOpportunities(
  c: Context,
  query: GetSavedVolunteerOpportunitiesQuery,
) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const result = await getSavedVolunteerOpportunities(
      authResult.userId,
      query,
    );
    return c.json({ ok: true, ...result }, 200);
  } catch (err) {
    console.error("Failed to get saved volunteer opportunities", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}

export async function handleGetVolunteerOpportunity(
  c: Context,
  params: GetVolunteerOpportunityParams,
  isPublic = false,
) {
  let viewerId: string | undefined;
  if (!isPublic) {
    const authResult = getAuthUserId(c);
    if (!authResult.ok) {
      return authResult.response;
    }
    viewerId = authResult.userId;
  }

  try {
    const opportunity = await getVolunteerOpportunityById(
      params.opportunityId,
      viewerId,
    );

    if (!opportunity) {
      return c.json({ ok: false, error: "Volunteer opportunity not found" }, 404);
    }

    const responseOpportunity = isPublic
      ? sanitizePublicVolunteerOpportunity(opportunity)
      : opportunity;

    return c.json({ ok: true, opportunity: responseOpportunity }, 200);
  } catch (err) {
    console.error("Failed to get volunteer opportunity", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}

export async function handleSaveVolunteerOpportunity(
  c: Context,
  params: GetVolunteerOpportunityParams,
) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const savedOpportunity = await saveVolunteerOpportunityForUser(
      params.opportunityId,
      authResult.userId,
    );

    if (!savedOpportunity) {
      return c.json({ ok: false, error: "Volunteer opportunity not found" }, 404);
    }

    if (savedOpportunity.created) {
      recordRecentActivityQuietly({
        userId: authResult.userId,
        type: "volunteer_opportunity_saved",
        title: `Saved ${quoteActivityText(savedOpportunity.opportunity.title)} volunteer opportunity`,
        description: savedOpportunity.opportunity.overview,
        targetType: "volunteer_opportunity",
        targetId: savedOpportunity.opportunity.id,
        referenceType: "volunteer_opportunity",
        referenceId: savedOpportunity.opportunity.id,
        data: {
          opportunityId: savedOpportunity.opportunity.id,
        },
      });
    }

    return c.json({ ok: true }, 200);
  } catch (err) {
    console.error("Failed to save volunteer opportunity", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}

export async function handleUnsaveVolunteerOpportunity(
  c: Context,
  params: GetVolunteerOpportunityParams,
) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const unsavedOpportunity = await unsaveVolunteerOpportunityForUser(
      params.opportunityId,
      authResult.userId,
    );

    if (!unsavedOpportunity) {
      return c.json({ ok: false, error: "Volunteer opportunity not found" }, 404);
    }

    return c.json({ ok: true }, 200);
  } catch (err) {
    console.error("Failed to unsave volunteer opportunity", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}

export async function handleCreateVolunteerCategory(
  c: Context,
  data: CreateVolunteerCategoryBodyInput,
) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const category = await createVolunteerCategory({
      ...data,
      createdBy: authResult.userId,
    });

    return c.json({ ok: true, category }, 201);
  } catch (err) {
    const error = getPostgresError(err);

    if (error?.code === POSTGRES_UNIQUE_VIOLATION) {
      const constraint = getPostgresConstraint(error);

      if (constraint === VOLUNTEER_CATEGORY_NAME_UNIQUE_INDEX) {
        return c.json({ ok: false, error: "Category name already exists" }, 409);
      }

      if (constraint === VOLUNTEER_CATEGORY_SLUG_UNIQUE_INDEX) {
        return c.json({ ok: false, error: "Category slug already exists" }, 409);
      }

      return c.json({ ok: false, error: "Category already exists" }, 409);
    }

    console.error("Failed to create volunteer category", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}

export async function handlePresignVolunteerOpportunityCoverUpload(
  c: Context,
  payload: PresignVolunteerOpportunityCoverUploadPayload,
) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const upload = presignVolunteerCoverUpload({
      userId: authResult.userId,
      contentType: payload.contentType,
      fileSize: payload.fileSize,
    });

    return c.json(
      {
        ok: true,
        upload,
      },
      200,
    );
  } catch (error) {
    console.error("Failed to generate volunteer cover upload URL", error);
    return c.json({ ok: false, error: "Failed to generate upload URL" }, 500);
  }
}

export async function handlePresignVolunteerApplicationDocumentUpload(
  c: Context,
  payload: PresignVolunteerApplicationDocumentUploadPayload,
) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const target = await findVolunteerOpportunityApplicationTargetById(
      payload.opportunityId,
    );
    const targetError = resolveVolunteerApplicationTargetError(
      target,
      authResult.userId,
      "Volunteer opportunity not found",
    );

    if (targetError) {
      return c.json({ ok: false, error: targetError.error }, targetError.status);
    }

    const uploads = payload.files.map((file) =>
      presignVolunteerApplicationDocumentUpload({
        opportunityId: payload.opportunityId,
        applicantId: authResult.userId,
        contentType: file.contentType,
        fileSize: file.fileSize,
      }),
    );

    return c.json({ ok: true, uploads }, 200);
  } catch (error) {
    console.error(
      "Failed to generate volunteer application document upload URL",
      error,
    );
    return c.json({ ok: false, error: "Failed to generate upload URL" }, 500);
  }
}

export async function handleCreateVolunteerApplication(
  c: Context,
  data: CreateVolunteerApplicationBodyInput,
) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const target = await findVolunteerApplicationTargetByRoleId(data.roleId);
    const targetError = resolveVolunteerApplicationTargetError(
      target,
      authResult.userId,
      "Volunteer role not found",
    );

    if (targetError) {
      return c.json({ ok: false, error: targetError.error }, targetError.status);
    }

    if (!target) {
      throw new Error("Volunteer application target missing after validation");
    }

    const normalizedSupportingDocumentKeys = normalizeOwnedSupportingDocumentKeys(
      target.opportunityId,
      authResult.userId,
      data.supportingDocumentKeys,
    );

    if (!normalizedSupportingDocumentKeys) {
      return c.json(
        {
          ok: false,
          error: "Validation failed",
          issues: [
            {
              path: "supportingDocumentKeys",
              message:
                "supportingDocumentKeys must belong to current user and opportunity",
            },
          ],
        },
        400,
      );
    }

    const application = await createVolunteerApplication({
      ...data,
      applicantId: authResult.userId,
      opportunityId: target.opportunityId,
      opportunityTitle: target.opportunityTitle,
      coverImageKey: target.coverImageKey,
      applicationDeadline: target.applicationDeadline,
      category: {
        id: target.categoryId,
        name: target.categoryName,
      },
      location: {
        id: target.cityId,
        name: target.cityName,
      },
      roleTitle: target.roleTitle,
      supportingDocumentKeys: normalizedSupportingDocumentKeys,
    });

    recordRecentActivityQuietly({
      userId: authResult.userId,
      type: "volunteer_application_submitted",
      title: `Applied to ${quoteActivityText(target.opportunityTitle)} volunteer opportunity`,
      description: target.opportunityOverview,
      targetType: "volunteer_opportunity",
      targetId: target.opportunityId,
      referenceType: "volunteer_application",
      referenceId: application.id,
      data: {
        opportunityId: target.opportunityId,
        applicationId: application.id,
        roleId: target.roleId,
        roleTitle: target.roleTitle,
      },
    });

    return c.json({ ok: true, application }, 201);
  } catch (err) {
    const error = getPostgresError(err);

    if (
      error?.code === POSTGRES_UNIQUE_VIOLATION &&
      getPostgresConstraint(error) ===
        VOLUNTEER_APPLICATION_APPLICANT_ROLE_UNIQUE_INDEX
    ) {
      return c.json(
        { ok: false, error: "You have already applied to this role" },
        409,
      );
    }

    console.error("Failed to create volunteer application", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}

export async function handleCreateVolunteerOpportunity(
  c: Context,
  data: CreateVolunteerOpportunityBodyInput,
) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) {
    return authResult.response;
  }

  const normalizedCoverImageKey = normalizeOwnedCoverImageKey(
    authResult.userId,
    data.coverImageKey,
  );

  if (!normalizedCoverImageKey) {
    return c.json(
      {
        ok: false,
        error: "Validation failed",
        issues: [
          {
            path: "coverImageKey",
            message: "coverImageKey does not belong to current user",
          },
        ],
      },
      400,
    );
  }

  try {
    const [category, location] = await Promise.all([
      findActiveVolunteerCategoryById(data.categoryId),
      findVolunteerLocationById(data.locationId),
    ]);

    if (!category) {
      return c.json({ ok: false, error: "Volunteer category not found" }, 404);
    }

    if (!location) {
      return c.json({ ok: false, error: "Location not found" }, 404);
    }

    const opportunity = await createVolunteerOpportunity({
      ...data,
      category,
      location,
      coverImageKey: normalizedCoverImageKey,
      createdBy: authResult.userId,
    });

    recordRecentActivityQuietly({
      userId: authResult.userId,
      type: "volunteer_opportunity_posted",
      title: `Posted ${quoteActivityText(opportunity.title)} volunteer opportunity`,
      description: opportunity.overview,
      targetType: "volunteer_opportunity",
      targetId: opportunity.id,
      referenceType: "volunteer_opportunity",
      referenceId: opportunity.id,
      data: {
        opportunityId: opportunity.id,
        categoryId: opportunity.category.id,
        locationId: opportunity.location.id,
      },
    });

    return c.json({ ok: true, opportunity }, 201);
  } catch (error) {
    console.error("Failed to create volunteer opportunity", error);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}
