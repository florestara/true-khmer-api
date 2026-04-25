import { Context } from "hono";
import { getAuthUserId } from "../auth/utils/get-auth";
import {
  CreateLaunchpadRequestInput,
  PresignLaunchpadDocumentUploadPayload,
  PresignLaunchpadImageUploadPayload,
} from "./schema/launchpad.request.schema";
import {
  presignLaunchpadCoverUpload,
  presignLaunchpadDocumentUpload,
  presignLaunchpadLogoUpload,
} from "../uploads/uploads.service";
import { createLaunchpad } from "./launchpad.query";

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
    return c.json({ ok: false, error: "Failed to create launchpad" }, 500);
  }
}
