import { createHash } from "node:crypto";
import type { Context } from "hono";
import { POSTGRES_UNIQUE_VIOLATION } from "../../../db/constants";
import { getAuthUserId } from "../../auth/utils/get-auth";
import { recordRecentActivityQuietly } from "../../recent-activity/recent-activity.service";
import { notifyApplicationReceived } from "../../notifications/notifications.service";
import { presignLaunchpadApplicationDocumentUpload } from "../../uploads/uploads.service";
import {
  createLaunchpadApplication,
  createLaunchpadApplicationsBatch,
  findExistingApplication,
  findExistingApplicationRoleIds,
  findLaunchpadApplicationById,
  findLaunchpadApplicationTarget,
  findLaunchpadApplicationTargetsByRoleIds,
  findLaunchpadTopPickedRoleId,
  hasLaunchpadApplicationBlock,
} from "./applications.query";
import type {
  CreateLaunchpadApplicationBatchInput,
  CreateLaunchpadApplicationInput,
  LaunchpadApplicationByIdParamInput,
  LaunchpadApplicationParamInput,
  PresignLaunchpadApplicationDocumentUploadPayload,
} from "./schema/applications.request.schema";

const LAUNCHPAD_APPLICATION_APPLICANT_ROLE_UNIQUE_INDEX =
  "launchpad_application_unique_active";
const LAUNCHPAD_APPLICATION_APPLICANT_LAUNCHPAD_TOP_PICK_UNIQUE_INDEX =
  "launchpad_application_created_by_launchpad_top_pick_active_unique_idx";

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

function validateOwnedDocumentKeys(
  launchpadId: string,
  applicantId: string,
  documentKeys: string[],
): boolean {
  const expectedPrefix = `launchpad-application/${launchpadId}/${applicantId}/`;
  return documentKeys.every((key) => key.startsWith(expectedPrefix));
}

function isLaunchpadOpenForApplications(target: {
  status: string;
}) {
  return target.status === "LIVE";
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

    if (!isLaunchpadOpenForApplications(target)) {
      return c.json(
        {
          ok: false,
          error: "Launchpad is not open for applications",
        },
        400,
      );
    }

    if (
      data.documentKeys && data.documentKeys.length > 0 &&
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
    if (existing) {
      return c.json(
        { ok: false, error: "You have already applied for this role" },
        409,
      );
    }

    if (await hasLaunchpadApplicationBlock(params.launchpadId, authResult.userId)) {
      return c.json(
        {
          ok: false,
          error: "You are blocked from applying to this launchpad",
        },
        409,
      );
    }

    if (data.topPickRoleId) {
      const existingTopPickedRoleId = await findLaunchpadTopPickedRoleId(
        params.launchpadId,
        authResult.userId,
      );

      if (existingTopPickedRoleId) {
        return c.json(
          {
            ok: false,
            error: "You have already selected a top pick for this launchpad",
          },
          409,
        );
      }
    }

    const application = await createLaunchpadApplication({
      launchpadId: params.launchpadId,
      launchpadRoleId: data.launchpadRoleId,
      motivation: data.motivation,
      relevantExperience: data.relevantExperience,
      portfolio: data.portfolio,
      documentKeys: data.documentKeys,
      documentNames: data.documentNames,
      topPickRoleId: data.topPickRoleId,
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

    if (target.createdBy !== authResult.userId) {
      notifyApplicationReceived({
        recipientUserId: target.createdBy,
        postingId: target.launchpadId,
        postingTitle: target.launchpadName,
        sourceType: "projects",
      }).catch((err) =>
        console.error("Failed to notify launchpad application received", err),
      );
    }

    return c.json({ ok: true, application }, 201);
  } catch (err) {
    const error = getPostgresError(err);

    if (
      error?.code === POSTGRES_UNIQUE_VIOLATION &&
      getPostgresConstraint(error) ===
        LAUNCHPAD_APPLICATION_APPLICANT_ROLE_UNIQUE_INDEX
    ) {
      return c.json(
        { ok: false, error: "You have already applied for this role" },
        409,
      );
    }

    if (
      error?.code === POSTGRES_UNIQUE_VIOLATION &&
      getPostgresConstraint(error) ===
        LAUNCHPAD_APPLICATION_APPLICANT_LAUNCHPAD_TOP_PICK_UNIQUE_INDEX
    ) {
      return c.json(
        {
          ok: false,
          error: "You have already selected a top pick for this launchpad",
        },
        409,
      );
    }

    console.error("Failed to create launchpad application", {
      err,
    });
    return c.json({ ok: false, error: "Failed to submit application" }, 500);
  }
}

export async function handleCreateLaunchpadApplicationBatch(
  c: Context,
  params: LaunchpadApplicationParamInput,
  data: CreateLaunchpadApplicationBatchInput,
) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const targets = await findLaunchpadApplicationTargetsByRoleIds(
      params.launchpadId,
      data.launchpadRoleIds,
    );
    const targetByRoleId = new Map(
      targets.map((target) => [target.roleId, target]),
    );
    const orderedTargets = data.launchpadRoleIds
      .map((roleId) => targetByRoleId.get(roleId))
      .filter((target) => target !== undefined);

    if (orderedTargets.length !== data.launchpadRoleIds.length) {
      return c.json({ ok: false, error: "Launchpad role not found" }, 404);
    }

    const firstTarget = orderedTargets[0];
    if (!firstTarget) {
      return c.json({ ok: false, error: "Launchpad role not found" }, 404);
    }

    for (const target of orderedTargets) {
      if (!isLaunchpadOpenForApplications(target)) {
        return c.json(
          {
            ok: false,
            error: "Launchpad is not open for applications",
          },
          400,
        );
      }

      if (target.launchpadId !== firstTarget.launchpadId) {
        return c.json(
          {
            ok: false,
            error: "All launchpadRoleIds must belong to the same launchpad",
          },
          400,
        );
      }
    }

    const existingRoleIds = await findExistingApplicationRoleIds(
      data.launchpadRoleIds,
      authResult.userId,
    );

    if (existingRoleIds.length > 0) {
      return c.json(
        { ok: false, error: "You have already applied for one or more roles" },
        409,
      );
    }

    if (await hasLaunchpadApplicationBlock(params.launchpadId, authResult.userId)) {
      return c.json(
        {
          ok: false,
          error: "You are blocked from applying to this launchpad",
        },
        409,
      );
    }

    if (data.topPickRoleId) {
      const existingTopPickedRoleId = await findLaunchpadTopPickedRoleId(
        params.launchpadId,
        authResult.userId,
      );

      if (existingTopPickedRoleId) {
        return c.json(
          {
            ok: false,
            error: "You have already selected a top pick for this launchpad",
          },
          409,
        );
      }
    }

    if (
      data.documentKeys &&
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

    const applications = await createLaunchpadApplicationsBatch({
      launchpadId: params.launchpadId,
      roles: orderedTargets.map((target) => ({
        roleId: target.roleId,
        roleTitle: target.roleTitle,
      })),
      motivation: data.motivation,
      relevantExperience: data.relevantExperience,
      portfolio: data.portfolio,
      documentKeys: data.documentKeys,
      documentNames: data.documentNames,
      topPickRoleId: data.topPickRoleId,
      createdBy: authResult.userId,
    });

    const applicationByRoleId = new Map(
      applications.map((application) => [
        application.launchpadRoleId,
        application,
      ]),
    );

    for (const target of orderedTargets) {
      const application = applicationByRoleId.get(target.roleId);
      if (!application) {
        continue;
      }

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
    }

    if (firstTarget.createdBy !== authResult.userId) {
      notifyApplicationReceived({
        recipientUserId: firstTarget.createdBy,
        postingId: firstTarget.launchpadId,
        postingTitle: firstTarget.launchpadName,
        sourceType: "projects",
      }).catch((err) =>
        console.error("Failed to notify launchpad application received", err),
      );
    }

    return c.json({ ok: true, applications }, 201);
  } catch (err) {
    const error = getPostgresError(err);

    if (
      error?.code === POSTGRES_UNIQUE_VIOLATION &&
      getPostgresConstraint(error) ===
        LAUNCHPAD_APPLICATION_APPLICANT_ROLE_UNIQUE_INDEX
    ) {
      return c.json(
        { ok: false, error: "You have already applied for one or more roles" },
        409,
      );
    }

    if (
      error?.code === POSTGRES_UNIQUE_VIOLATION &&
      getPostgresConstraint(error) ===
        LAUNCHPAD_APPLICATION_APPLICANT_LAUNCHPAD_TOP_PICK_UNIQUE_INDEX
    ) {
      return c.json(
        {
          ok: false,
          error: "You have already selected a top pick for this launchpad",
        },
        409,
      );
    }

    console.error("Failed to create launchpad application batch", {
      err,
    });
    return c.json({ ok: false, error: "Failed to submit applications" }, 500);
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
    });
    return c.json({ ok: false, error: "Failed to get application" }, 500);
  }
}
