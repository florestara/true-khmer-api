import type { Context } from "hono";
import { POSTGRES_UNIQUE_VIOLATION } from "../../db/constants";
import { presignVolunteerApplicationDocumentUpload } from "../uploads/uploads.service";
import { getAuthUserId } from "../auth/utils/get-auth";
import {
  createVolunteerApplication,
  findVolunteerApplicationTargetByRoleId,
  findVolunteerApplicationsByApplicantId,
  findVolunteerOpportunityApplicationTargetById,
} from "./application.query";
import type {
  CreateVolunteerApplicationBodyInput,
  PresignVolunteerApplicationDocumentUploadPayload,
} from "./application.schema";

const VOLUNTEER_APPLICATION_APPLICANT_ROLE_UNIQUE_INDEX =
  "volunteer_application_applicant_role_active_unique_idx";

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

    if (!target) {
      throw new Error("Volunteer application target missing after validation");
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
      roleId: data.roleId,
      applicantId: authResult.userId,
      opportunityId: target.opportunityId,
      opportunityTitle: target.opportunityTitle,
      coverImageKey: target.coverImageKey,
      category: {
        id: target.categoryId,
        name: target.categoryName,
      },
      location: {
        id: target.cityId,
        name: target.cityName,
      },
      roleTitle: target.roleTitle,
      availability: data.availability,
      relevantExperience: data.relevantExperience,
      supportingDocumentKeys: normalizedSupportingDocumentKeys,
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

export async function handleGetVolunteerApplications(c: Context) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const applications = await findVolunteerApplicationsByApplicantId(
      authResult.userId,
    );

    return c.json({ ok: true, applications }, 200);
  } catch (err) {
    console.error("Failed to get volunteer applications", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}
