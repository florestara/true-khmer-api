import { randomUUID } from "node:crypto";
import type { Context } from "hono";
import { z } from "zod";
import { POSTGRES_UNIQUE_VIOLATION } from "../../../db/constants";
import { uploadVolunteerCoverImage } from "../../uploads/uploads.service";
import { getAuthUserId } from "../../auth/utils/get-auth";
import {
  createVolunteerCategory,
  createVolunteerOpportunity,
  findActiveVolunteerCategoryById,
  findVolunteerLocationById,
  getVolunteerCategories,
  getVolunteerLocations,
} from "./post-volunteer.query";
import type {
  CreateVolunteerCategoryBodyInput,
  CreateVolunteerOpportunityPayloadInput,
} from "./post-volunteer.schema";
import {
  createVolunteerOpportunityPayloadSchema,
  isAllowedVolunteerCoverImageContentType,
  VOLUNTEER_COVER_IMAGE_MAX_BYTES,
} from "./post-volunteer.schema";

const VOLUNTEER_CATEGORY_SLUG_UNIQUE_INDEX =
  "volunteer_category_slug_unique_idx";
const VOLUNTEER_CATEGORY_NAME_UNIQUE_INDEX =
  "volunteer_category_name_unique_idx";

function toValidationIssues(error: z.ZodError) {
  return error.issues.map((issue) => ({
    path:
      issue.path.length === 0
        ? "payload"
        : issue.path
            .map((segment) =>
              typeof segment === "number" ? `[${segment}]` : String(segment),
            )
            .join(".")
            .replace(".[", "["),
    message: issue.message,
  }));
}

type ParsedCreateVolunteerOpportunityForm =
  | {
      ok: true;
      payload: CreateVolunteerOpportunityPayloadInput;
      coverImage: File;
    }
  | {
      ok: false;
      issues: Array<{ path: string; message: string }>;
    };

async function parseCreateVolunteerOpportunityForm(
  formData: FormData,
): Promise<ParsedCreateVolunteerOpportunityForm> {
  const issues: Array<{ path: string; message: string }> = [];

  const payloadValue = formData.get("payload");
  const payloadText = typeof payloadValue === "string" ? payloadValue : null;
  if (!payloadText) {
    issues.push({
      path: "payload",
      message: "payload is required and must be a JSON string",
    });
  }

  const coverImageValue = formData.get("coverImage");
  const coverImageFile = coverImageValue instanceof File ? coverImageValue : null;
  if (!coverImageFile) {
    issues.push({
      path: "coverImage",
      message: "coverImage is required and must be an image file",
    });
  }

  if (issues.length > 0 || !payloadText || !coverImageFile) {
    return { ok: false, issues };
  }

  let parsedPayloadJson: unknown;
  try {
    parsedPayloadJson = JSON.parse(payloadText);
  } catch {
    return {
      ok: false,
      issues: [
        {
          path: "payload",
          message: "payload must be valid JSON",
        },
      ],
    };
  }

  const parsedPayload =
    createVolunteerOpportunityPayloadSchema.safeParse(parsedPayloadJson);

  if (!parsedPayload.success) {
    return {
      ok: false,
      issues: toValidationIssues(parsedPayload.error),
    };
  }

  if (!isAllowedVolunteerCoverImageContentType(coverImageFile.type)) {
    return {
      ok: false,
      issues: [
        {
          path: "coverImage",
          message: "coverImage must be a JPEG, PNG, or WebP image",
        },
      ],
    };
  }

  if (coverImageFile.size <= 0) {
    return {
      ok: false,
      issues: [
        {
          path: "coverImage",
          message: "coverImage must not be empty",
        },
      ],
    };
  }

  if (coverImageFile.size > VOLUNTEER_COVER_IMAGE_MAX_BYTES) {
    return {
      ok: false,
      issues: [
        {
          path: "coverImage",
          message: `coverImage must be <= ${Math.floor(VOLUNTEER_COVER_IMAGE_MAX_BYTES / (1024 * 1024))} MB`,
        },
      ],
    };
  }

  return {
    ok: true,
    payload: parsedPayload.data,
    coverImage: coverImageFile,
  };
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
    const error = err as { code?: string; constraint?: string } | null;

    if (error?.code === POSTGRES_UNIQUE_VIOLATION) {
      if (error.constraint === VOLUNTEER_CATEGORY_NAME_UNIQUE_INDEX) {
        return c.json({ ok: false, error: "Category name already exists" }, 409);
      }

      if (error.constraint === VOLUNTEER_CATEGORY_SLUG_UNIQUE_INDEX) {
        return c.json({ ok: false, error: "Category slug already exists" }, 409);
      }

      return c.json({ ok: false, error: "Category already exists" }, 409);
    }

    console.error("Failed to create volunteer category", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}

export async function handleCreateVolunteerOpportunity(c: Context) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) {
    return authResult.response;
  }

  let formData: FormData;
  try {
    formData = await c.req.formData();
  } catch {
    return c.json(
      {
        ok: false,
        error: "Validation failed",
        issues: [
          {
            path: "payload",
            message: "Request body must be multipart/form-data",
          },
        ],
      },
      400,
    );
  }

  const parsedForm = await parseCreateVolunteerOpportunityForm(formData);
  if (!parsedForm.ok) {
    return c.json(
      { ok: false, error: "Validation failed", issues: parsedForm.issues },
      400,
    );
  }

  const opportunityId = randomUUID();
  const [category, location] = await Promise.all([
    findActiveVolunteerCategoryById(parsedForm.payload.categoryId),
    findVolunteerLocationById(parsedForm.payload.locationId),
  ]);

  if (!category) {
    return c.json({ ok: false, error: "Volunteer category not found" }, 404);
  }

  if (!location) {
    return c.json({ ok: false, error: "Location not found" }, 404);
  }

  let coverImageUpload:
    | Awaited<ReturnType<typeof uploadVolunteerCoverImage>>
    | undefined;

  try {
    const coverImageBuffer = await parsedForm.coverImage.arrayBuffer();
    coverImageUpload = await uploadVolunteerCoverImage({
      opportunityId,
      fileName: parsedForm.coverImage.name || "volunteer-cover",
      contentType: parsedForm.coverImage.type,
      fileSize: parsedForm.coverImage.size,
      body: coverImageBuffer,
    });
  } catch (error) {
    console.error("Failed to upload volunteer cover image", error);
    return c.json(
      { ok: false, error: "Failed to upload volunteer cover image" },
      500,
    );
  }

  try {
    const opportunity = await createVolunteerOpportunity({
      ...parsedForm.payload,
      opportunityId,
      createdBy: authResult.userId,
      coverImageKey: coverImageUpload.objectKey,
      coverImageUrl: coverImageUpload.publicUrl,
    });

    return c.json({ ok: true, opportunity }, 201);
  } catch (error) {
    console.error("Failed to create volunteer opportunity", error);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}
