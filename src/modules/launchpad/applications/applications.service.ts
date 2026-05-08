import type { Context } from "hono";
import { getAuthUserId } from "../../auth/utils/get-auth";
import { recordRecentActivityQuietly } from "../../recent-activity/recent-activity.service";
import { presignLaunchpadApplicationDocumentUpload } from "../../uploads/uploads.service";
import {
  createLaunchpadApplication,
  findExistingApplication,
  findLaunchpadApplicationById,
  findLaunchpadApplicationTarget,
} from "./applications.query";
import type {
  CreateLaunchpadApplicationInput,
  LaunchpadApplicationByIdParamInput,
  LaunchpadApplicationParamInput,
  PresignLaunchpadApplicationDocumentUploadPayload,
} from "./schema/applications.request.schema";

function validateOwnedDocumentKeys(
  launchpadId: string,
  applicantId: string,
  documentKeys: string[],
): boolean {
  const expectedPrefix = `launchpad-application/${launchpadId}/${applicantId}/`;
  return documentKeys.every((key) => key.startsWith(expectedPrefix));
}

export async function handlePresignLaunchpadApplicationDocumentUpload(
  c: Context,
  params: LaunchpadApplicationParamInput,
  payload: PresignLaunchpadApplicationDocumentUploadPayload,
) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const upload = presignLaunchpadApplicationDocumentUpload({
      launchpadId: params.launchpadId,
      applicantId: authResult.userId,
      contentType: payload.contentType,
      fileSize: payload.fileSize,
    });

    return c.json({ ok: true, upload }, 200);
  } catch (error) {
    console.error(
      "Failed to generate launchpad application document upload URL",
      error,
    );
    return c.json({ ok: false, error: "Failed to generate upload URL" }, 500);
  }
}

export async function handleCreateLaunchpadApplication(
  c: Context,
  params: LaunchpadApplicationParamInput,
  data: CreateLaunchpadApplicationInput,
) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const target = await findLaunchpadApplicationTarget(
      params.launchpadId,
      data.launchpadRoleId,
    );

    if (!target) {
      return c.json({ ok: false, error: "Launchpad role not found" }, 404);
    }

    if (
      data.documentKeys.length > 0 &&
      !validateOwnedDocumentKeys(
        params.launchpadId,
        authResult.userId,
        data.documentKeys,
      )
    ) {
      return c.json(
        {
          ok: false,
          error: "Validation failed",
          issues: [
            {
              path: "documentKeys",
              message:
                "documentKeys must belong to the current user and launchpad",
            },
          ],
        },
        400,
      );
    }

    const existing = await findExistingApplication(
      data.launchpadRoleId,
      authResult.userId,
    );
    if (existing && existing.status !== "WITHDRAWN") {
      return c.json(
        { ok: false, error: "You have already applied for this role" },
        409,
      );
    }

    const application = await createLaunchpadApplication({
      launchpadId: params.launchpadId,
      launchpadRoleId: data.launchpadRoleId,
      motivation: data.motivation,
      portfolio: data.portfolio,
      documentKeys: data.documentKeys,
      documentNames: data.documentNames,
      createdBy: authResult.userId,
    });

    recordRecentActivityQuietly({
      userId: authResult.userId,
      type: "launchpad_application_submitted",
      title: `Applied to '${target.launchpadName}' as ${target.roleTitle}`,
      targetType: "launchpad",
      targetId: params.launchpadId,
      referenceType: "launchpad_application",
      referenceId: application.id,
      data: {
        launchpadId: params.launchpadId,
        applicationId: application.id,
        roleId: target.roleId,
      },
    });

    return c.json({ ok: true, application }, 201);
  } catch (err) {
    console.error("Failed to create launchpad application", {
      err,
      launchpadId: params.launchpadId,
      userId: authResult.userId,
    });
    return c.json({ ok: false, error: "Failed to submit application" }, 500);
  }
}

export async function handleGetLaunchpadApplication(
  c: Context,
  params: LaunchpadApplicationByIdParamInput,
) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const application = await findLaunchpadApplicationById(
      params.applicationId,
      params.launchpadId,
    );

    if (!application) {
      return c.json({ ok: false, error: "Application not found" }, 404);
    }

    if (application.createdBy !== authResult.userId) {
      return c.json({ ok: false, error: "Application not found" }, 404);
    }

    return c.json({ ok: true, application }, 200);
  } catch (error) {
    console.error("Failed to get launchpad application", {
      error,
      launchpadId: params.launchpadId,
      applicationId: params.applicationId,
    });
    return c.json({ ok: false, error: "Failed to get application" }, 500);
  }
}
