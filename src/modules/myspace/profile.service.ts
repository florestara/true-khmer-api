import type { Context } from "hono";
import { getAuthUserId } from "../auth/utils/get-auth";
import { validateCountryCityIds } from "../onboarding/onboarding.query";
import { resolveR2PublicUrl } from "../uploads/uploads.service";
import { getProfile, getPublicProfile, updateProfile } from "./profile.query";
import type {
  GetPublicProfileParams,
  UpdateProfilePayload,
} from "./profile.schema";

function normalizeOwnedAvatarKey(userId: string, avatarKey: string): string | null {
  const rawKey = avatarKey.startsWith("/") ? avatarKey.slice(1) : avatarKey;

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

  if (!normalizedKey.startsWith(`avatars/${userId}/`)) {
    return null;
  }

  return normalizedKey;
}

function isPostgresDateError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = "code" in error ? String(error.code) : "";
  return code === "22007" || code === "22008";
}

export async function handleGetProfile(c: Context) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const profile = await getProfile(authResult.userId);
    if (!profile) {
      return c.json({ ok: false, error: "User not found" }, 404);
    }

    return c.json({ ok: true, profile }, 200);
  } catch (err) {
    console.error("Failed to get profile", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}

export async function handleGetPublicProfile(
  c: Context,
  params: GetPublicProfileParams,
) {
  try {
    const result = await getPublicProfile(params.userId);
    if (!result) {
      return c.json({ ok: false, error: "User not found" }, 404);
    }

    return c.json({ ok: true, profile: result.profile }, 200);
  } catch (err) {
    console.error("Failed to get public profile", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}

export async function handleUpdateProfile(
  c: Context,
  payload: UpdateProfilePayload,
) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) {
    return authResult.response;
  }

  let countryId: string | undefined;
  let cityId: string | undefined;
  if (payload.countryId !== undefined && payload.cityId !== undefined) {
    const locationResult = await validateCountryCityIds(
      payload.countryId,
      payload.cityId,
    );
    if (!locationResult.ok) {
      return c.json({ ok: false, error: locationResult.error }, 400);
    }
    countryId = locationResult.countryId;
    cityId = locationResult.cityId;
  }

  let avatarKey = payload.avatarKey;
  let avatarUrl: string | null | undefined;
  if (payload.avatarKey !== undefined && payload.avatarKey !== null) {
    const normalizedKey = normalizeOwnedAvatarKey(
      authResult.userId,
      payload.avatarKey,
    );
    if (!normalizedKey) {
      return c.json(
        { ok: false, error: "avatarKey does not belong to current user" },
        400,
      );
    }
    avatarKey = normalizedKey;
    avatarUrl = resolveR2PublicUrl(normalizedKey);
  } else if (payload.avatarKey === null) {
    avatarUrl = null;
  }

  try {
    const profile = await updateProfile(authResult.userId, {
      ...payload,
      ...(countryId ? { countryId } : {}),
      ...(cityId ? { cityId } : {}),
      ...(payload.avatarKey !== undefined ? { avatarKey, avatarUrl } : {}),
    });

    if (!profile) {
      return c.json({ ok: false, error: "User not found" }, 404);
    }

    return c.json({ ok: true, profile }, 200);
  } catch (err) {
    if (isPostgresDateError(err)) {
      return c.json(
        { ok: false, error: "dateOfBirth must be a valid date" },
        400,
      );
    }

    console.error("Failed to update profile", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}
