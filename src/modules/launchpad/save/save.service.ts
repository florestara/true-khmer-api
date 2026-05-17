import type { Context } from "hono";
import { getAuthUserId } from "../../auth/utils/get-auth";
import {
  getSavedLaunchpads,
  saveLaunchpadForUser,
  unsaveLaunchpadForUser,
} from "./save.query";
import type {
  GetSavedLaunchpadsQuery,
  GetLaunchpadParams,
} from "./schema/save.request.schema";
import { recordRecentActivityQuietly } from "../../recent-activity/recent-activity.service";

function quoteActivityText(value: string) {
  return `'${value}'`;
}

export async function handleGetSavedLaunchpads(
  c: Context,
  query: GetSavedLaunchpadsQuery,
) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const result = await getSavedLaunchpads(authResult.userId, query);

    return c.json(
      {
        ok: true,
        launchpads: result.launchpads,
        nextCursor: result.pagination.nextCursor,
      },
      200,
    );
  } catch (err) {
    console.error("Failed to get saved launchpads", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}

export async function handleSaveLaunchpad(
  c: Context,
  params: GetLaunchpadParams,
) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const savedLaunchpad = await saveLaunchpadForUser(
      params.launchpadId,
      authResult.userId,
    );

    if (!savedLaunchpad) {
      return c.json({ ok: false, error: "Launchpad not found" }, 404);
    }

    if (savedLaunchpad.created) {
      recordRecentActivityQuietly({
        userId: authResult.userId,
        type: "launchpad_saved",
        title: `Saved ${quoteActivityText(savedLaunchpad.launchpad.name)}`,
        description: savedLaunchpad.launchpad.description ?? undefined,
        targetType: "launchpad",
        targetId: savedLaunchpad.launchpad.id,
        referenceType: "launchpad",
        referenceId: savedLaunchpad.launchpad.id,
        data: {
          launchpadId: savedLaunchpad.launchpad.id,
        },
      });
    }

    return c.json({ ok: true }, 200);
  } catch (err) {
    console.error("Failed to save launchpad", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}

export async function handleUnsaveLaunchpad(
  c: Context,
  params: GetLaunchpadParams,
) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const unsaved = await unsaveLaunchpadForUser(
      params.launchpadId,
      authResult.userId,
    );

    if (!unsaved) {
      return c.json({ ok: false, error: "Launchpad not found" }, 404);
    }

    return c.json({ ok: true }, 200);
  } catch (err) {
    console.error("Failed to unsave launchpad", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}