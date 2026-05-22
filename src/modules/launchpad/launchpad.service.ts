import { Context } from "hono";
import { getAuthUserId } from "../auth/utils/get-auth";
import {
  CreateLaunchpadRequestInput,
  GetLaunchpadQueryInput,
  GetLaunchpadQueryListInput,
  PresignLaunchpadDocumentUploadPayload,
  PresignLaunchpadImageUploadPayload,
  UpdateLaunchpadRequestInput,
} from "./schema/launchpad.request.schema";
import {
  presignLaunchpadCoverUpload,
  presignLaunchpadDocumentUpload,
  presignLaunchpadLogoUpload,
} from "../uploads/uploads.service";
import {
  createLaunchpad,
  findActiveLaunchpadCategoryById,
  findLaunchpadCityById,
  findLaunchpadEditTargetById,
  findLaunchpadById,
  findLaunchpads,
  incrementLaunchpadViewCount,
  LaunchpadRoleCapacityError,
  LaunchpadRoleNotFoundError,
  LaunchpadRoleRemovalBlockedError,
  updateLaunchpad,
} from "./launchpad.query";
import { recordRecentActivityQuietly } from "../recent-activity/recent-activity.service";

function quoteActivityText(value: string) {
  if (value.includes("'") && value.includes('"')) {
    return value;
  }

  if (value.includes("'")) {
    return `"${value}"`;
  }

  return `'${value}'`;
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

function normalizeOwnedLaunchpadLogoKey(userId: string, logoKey: string) {
  return normalizeOwnedObjectKey(`launchpad-logos/${userId}/`, logoKey);
}

function normalizeOwnedLaunchpadCoverKey(userId: string, coverKey: string) {
  return normalizeOwnedObjectKey(`launchpad-covers/${userId}/`, coverKey);
}

function normalizeOwnedLaunchpadDocumentKeys(
  userId: string,
  documentKeys: string[],
): string[] | null {
  const normalizedKeys = documentKeys.map((documentKey) =>
    normalizeOwnedObjectKey(`launchpad-document/${userId}/`, documentKey),
  );

  if (normalizedKeys.some((documentKey) => documentKey === null)) {
    return null;
  }

  const resolvedNormalizedKeys = normalizedKeys as string[];
  if (new Set(resolvedNormalizedKeys).size !== resolvedNormalizedKeys.length) {
    return null;
  }

  return resolvedNormalizedKeys;
}

export async function handlePresignLaunchpadLogoUpload(
  c: Context,
  payload: PresignLaunchpadImageUploadPayload,
) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const upload = presignLaunchpadLogoUpload({
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
    console.error("Failed to generate launchpad logo upload URL", error);
    return c.json({ ok: false, error: "Failed to generate upload URL" }, 500);
  }
}

export async function handlePresignLaunchpadCoverUpload(
  c: Context,
  payload: PresignLaunchpadImageUploadPayload,
) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const upload = presignLaunchpadCoverUpload({
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
    console.error("Failed to generate launchpad cover upload URL", error);
    return c.json({ ok: false, error: "Failed to generate upload URL" }, 500);
  }
}

export async function handlePresignLaunchpadDocumentUpload(
  c: Context,
  payload: PresignLaunchpadDocumentUploadPayload,
) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const upload = presignLaunchpadDocumentUpload({
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
    console.error("Failed to generate launchpad document upload URL", error);
    return c.json({ ok: false, error: "Failed to generate upload URL" }, 500);
  }
}

export async function handleCreateLaunchpad(
  c: Context,
  payload: CreateLaunchpadRequestInput,
) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const created = await createLaunchpad(payload, authResult.userId);
    recordRecentActivityQuietly({
      userId: authResult.userId,
      type: "launchpad_created",
      title: `Created ${quoteActivityText(created.name)} launchpad`,
      description: created.description,
      targetType: "launchpad",
      targetId: created.id,
      referenceType: "launchpad",
      referenceId: created.id,
      data: {
        launchpadId: created.id,
        categoryId: created.category?.id ?? null,
        cityId: created.city?.id ?? null,
      },
    });

    return c.json({ ok: true, launchpad: created }, 201);
  } catch (error) {
    console.error("Failed to create launchpad", {
      error,
      userId: authResult.userId,
      categoryId: payload.categoryId,
      cityId: payload.cityId,
      launchpadName: payload.name,
    });

    // Handle specific database errors
    const pgErr = error as { code?: string; constraint_name?: string };

    if (pgErr?.code === "23505") {
      const isRoleDup =
        pgErr.constraint_name === "launchpad_role_title_unique_idx";
      return c.json(
        {
          ok: false,
          error: isRoleDup
            ? "Duplicate role title within the launchpad"
            : "Launchpad with this name already exists",
        },
        409,
      );
    }

    // PostgreSQL foreign key violation (23503)
    if (pgErr?.code === "23503") {
      return c.json(
        { ok: false, error: "Invalid category or city reference" },
        400,
      );
    }

    return c.json({ ok: false, error: "Failed to create launchpad" }, 500);
  }
}

export async function handleUpdateLaunchpad(
  c: Context,
  params: GetLaunchpadQueryInput,
  data: UpdateLaunchpadRequestInput,
) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const target = await findLaunchpadEditTargetById(params.launchpadId);

    if (!target) {
      return c.json({ ok: false, error: "Launchpad not found" }, 404);
    }

    if (target.createdBy !== authResult.userId) {
      return c.json(
        { ok: false, error: "You can only edit your own launchpad" },
        403,
      );
    }

    let logoKey = data.logoKey;
    if (data.logoKey !== undefined) {
      const normalizedLogoKey = normalizeOwnedLaunchpadLogoKey(
        authResult.userId,
        data.logoKey,
      );

      if (!normalizedLogoKey) {
        return c.json(
          {
            ok: false,
            error: "Validation failed",
            issues: [
              {
                path: "logoKey",
                message: "logoKey does not belong to current user",
              },
            ],
          },
          400,
        );
      }

      logoKey = normalizedLogoKey;
    }

    let coverKey = data.coverKey;
    if (data.coverKey !== undefined) {
      const normalizedCoverKey = normalizeOwnedLaunchpadCoverKey(
        authResult.userId,
        data.coverKey,
      );

      if (!normalizedCoverKey) {
        return c.json(
          {
            ok: false,
            error: "Validation failed",
            issues: [
              {
                path: "coverKey",
                message: "coverKey does not belong to current user",
              },
            ],
          },
          400,
        );
      }

      coverKey = normalizedCoverKey;
    }

    let materialDocumentKey = data.materialDocumentKey;
    if (data.materialDocumentKey !== undefined) {
      const normalizedDocumentKeys = normalizeOwnedLaunchpadDocumentKeys(
        authResult.userId,
        data.materialDocumentKey,
      );

      if (!normalizedDocumentKeys) {
        return c.json(
          {
            ok: false,
            error: "Validation failed",
            issues: [
              {
                path: "materialDocumentKey",
                message: "materialDocumentKey must belong to current user",
              },
            ],
          },
          400,
        );
      }

      materialDocumentKey = normalizedDocumentKeys;
    }

    const [category, city] = await Promise.all([
      data.categoryId
        ? findActiveLaunchpadCategoryById(data.categoryId)
        : Promise.resolve(null),
      data.cityId ? findLaunchpadCityById(data.cityId) : Promise.resolve(null),
    ]);

    if (data.categoryId && !category) {
      return c.json({ ok: false, error: "Launchpad category not found" }, 404);
    }

    if (data.cityId && !city) {
      return c.json({ ok: false, error: "City not found" }, 404);
    }

    const launchpad = await updateLaunchpad(
      params.launchpadId,
      authResult.userId,
      {
        ...data,
        ...(logoKey !== undefined ? { logoKey } : {}),
        ...(coverKey !== undefined ? { coverKey } : {}),
        ...(materialDocumentKey !== undefined ? { materialDocumentKey } : {}),
      },
    );

    if (!launchpad) {
      return c.json({ ok: false, error: "Launchpad not found" }, 404);
    }

    return c.json({ ok: true, launchpad }, 200);
  } catch (error) {
    if (error instanceof LaunchpadRoleNotFoundError) {
      return c.json({ ok: false, error: error.message }, 404);
    }

    if (error instanceof LaunchpadRoleRemovalBlockedError) {
      return c.json({ ok: false, error: error.message }, 409);
    }

    if (error instanceof LaunchpadRoleCapacityError) {
      return c.json({ ok: false, error: error.message }, 409);
    }

    const pgErr = error as { code?: string; constraint_name?: string };
    if (pgErr?.code === "23505") {
      const isRoleDup =
        pgErr.constraint_name === "launchpad_role_title_unique_idx";
      return c.json(
        {
          ok: false,
          error: isRoleDup
            ? "Duplicate role title within the launchpad"
            : "Launchpad with this name already exists",
        },
        409,
      );
    }

    if (pgErr?.code === "23503") {
      return c.json(
        { ok: false, error: "Invalid category or city reference" },
        400,
      );
    }

    console.error("Failed to update launchpad", {
      error,
      userId: authResult.userId,
      launchpadId: params.launchpadId,
    });
    return c.json({ ok: false, error: "Failed to update launchpad" }, 500);
  }
}

export async function handleFindLaunchpadById(
  c: Context,
  payload: GetLaunchpadQueryInput,
) {
  try {
    const launchpad = await findLaunchpadById(payload.launchpadId);

    if (!launchpad) {
      return c.json({ ok: false, error: "Launchpad not found" }, 404);
    }

    try {
      await incrementLaunchpadViewCount(payload.launchpadId);
      launchpad.totalView += 1;
    } catch (error) {
      console.warn("Failed to increment launchpad view count", {
        error,
        launchpadId: payload.launchpadId,
      });
    }

    return c.json({ ok: true, launchpad }, 200);
  } catch (error) {
    console.error("Failed to find launchpad", {
      error,
      launchpadId: payload.launchpadId,
    });
    return c.json({ ok: false, error: "Failed to find launchpad" }, 500);
  }
}

export async function handleFindLaunchpads(
  c: Context,
  query: GetLaunchpadQueryListInput,
) {
  let viewerId: string | undefined;
  const authResult = getAuthUserId(c);

  if (authResult.ok) {
    viewerId = authResult.userId;
  }

  try {
    const result = await findLaunchpads(query, viewerId);
    return c.json({ ok: true, ...result }, 200);
  } catch (error) {
    console.error("Failed to find launchpads", { error });
    return c.json({ ok: false, error: "Failed to find launchpads" }, 500);
  }
}
