import { Context } from "hono";
import { getAuthUserId } from "../auth/utils/get-auth";
import {
  CreateLaunchpadRequestInput,
  GetLaunchpadQueryInput,
  GetLaunchpadQueryListInput,
  PresignLaunchpadDocumentUploadPayload,
  PresignLaunchpadImageUploadPayload,
} from "./schema/launchpad.request.schema";
import {
  presignLaunchpadCoverUpload,
  presignLaunchpadDocumentUpload,
  presignLaunchpadLogoUpload,
} from "../uploads/uploads.service";
import {
  createLaunchpad,
  findLaunchpadById,
  findLaunchpads,
  incrementLaunchpadViewCount,
} from "./launchpad.query";

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
  try {
    const result = await findLaunchpads(query);
    return c.json({ ok: true, ...result }, 200);
  } catch (error) {
    console.error("Failed to find launchpads", { error });
    return c.json({ ok: false, error: "Failed to find launchpads" }, 500);
  }
}
