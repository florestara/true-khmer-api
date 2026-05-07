import type { Context } from "hono";
import { POSTGRES_UNIQUE_VIOLATION } from "../../../db/constants";
import { presignVolunteerCoverUpload } from "../../uploads/uploads.service";
import { getAuthUserId } from "../../auth/utils/get-auth";
import {
  createVolunteerCategory,
  createVolunteerOpportunity,
  findActiveVolunteerCategoryById,
  findVolunteerLocationById,
  getSavedVolunteerOpportunities,
  getVolunteerCategories,
  getVolunteerOpportunityById,
  getVolunteerLocations,
  getVolunteerOpportunities,
  saveVolunteerOpportunityForUser,
  unsaveVolunteerOpportunityForUser,
} from "./post-volunteer.query";
import type {
  CreateVolunteerCategoryBodyInput,
  CreateVolunteerOpportunityBodyInput,
  GetSavedVolunteerOpportunitiesQuery,
  GetVolunteerOpportunityParams,
  GetVolunteerOpportunitiesQuery,
  PresignVolunteerOpportunityCoverUploadPayload,
} from "./post-volunteer.schema";

const VOLUNTEER_CATEGORY_SLUG_UNIQUE_INDEX =
  "volunteer_category_slug_unique_idx";
const VOLUNTEER_CATEGORY_NAME_UNIQUE_INDEX =
  "volunteer_category_name_unique_idx";

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

    return c.json({ ok: true, opportunity }, 201);
  } catch (error) {
    console.error("Failed to create volunteer opportunity", error);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}
