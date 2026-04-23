import { Context } from "hono";
import { getAuthUserId } from "../auth/utils/get-auth";
import {
  PresignLaunchpadDocumentUploadPayload,
  PresignLaunchpadImageUploadPayload,
} from "./schema/launchpad.request.schema";
import {
  presignLaunchpadCoverUpload,
  presignLaunchpadDocumentUpload,
  presignLaunchpadLogoUpload,
} from "../uploads/uploads.service";

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
