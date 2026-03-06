import type { Context } from "hono";
import { getAuthUserId, type AuthPayload } from "../auth/types";
import type {
  OnboardingContributionsStepPayload,
  OnboardingInterestsStepPayload,
  OnboardingProfileStepPayload,
} from "./schema";
import {
  completeOnboarding,
  getContributionOptions,
  getInterestOptions,
  findUserById,
  validateCountryCityIds,
  getOnboardingOptions,
  getOnboardingState,
  listCitiesByCountryFromDb,
  listCountriesFromDb,
  replaceUserInterests,
  replaceUserContributions,
  saveProfileStep,
} from "./query";

function getUserId(c: Context) {
  const authPayload = c.get("auth") as AuthPayload | undefined;
  const userId = getAuthUserId(authPayload);

  if (!userId) {
    return null;
  }

  return userId;
}

function normalizeBaseUrl(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function resolveAvatarUrl(avatarKey?: string): string | null {
  if (!avatarKey) {
    return null;
  }

  const baseUrl = process.env.R2_PUBLIC_BASE_URL?.trim();
  if (!baseUrl) {
    throw new Error("R2_PUBLIC_BASE_URL is not configured");
  }

  const normalizedBase = normalizeBaseUrl(baseUrl);
  const normalizedKey = avatarKey.startsWith("/") ? avatarKey.slice(1) : avatarKey;
  return `${normalizedBase}/${normalizedKey}`;
}

function isAvatarKeyOwnedByUser(userId: string, avatarKey?: string) {
  if (!avatarKey) {
    return true;
  }

  const rawKey = avatarKey.startsWith("/") ? avatarKey.slice(1) : avatarKey;
  let normalizedKey: string;
  try {
    normalizedKey = decodeURIComponent(rawKey);
  } catch {
    // Reject keys with invalid percent-encoding.
    return false;
  }
  // Reject path traversal (`..`), backslashes, duplicate slashes, and control chars.
  const forbiddenPattern = /(^|\/)\.\.(\/|$)|\\|\/\/|[\u0000-\u001F\u007F]/;
  if (forbiddenPattern.test(normalizedKey)) {
    return false;
  }

  return normalizedKey.startsWith(`avatars/${userId}/`);
}

export async function handleGetOnboardingOptions(c: Context) {
  const options = await getOnboardingOptions();
  return c.json({ ok: true, options });
}

export async function handleGetInterests(c: Context) {
  const interests = await getInterestOptions();
  return c.json({ ok: true, interests });
}

export async function handleGetContributions(c: Context) {
  const contributions = await getContributionOptions();
  return c.json({ ok: true, contributions });
}

export async function handleGetCountries(c: Context) {
  const countries = await listCountriesFromDb();
  return c.json({ ok: true, countries });
}

export async function handleGetCities(c: Context) {
  const countryId = c.req.query("countryId")?.trim();
  const countryName = c.req.query("countryName")?.trim();
  if (!countryId && !countryName) {
    return c.json(
      { ok: false, error: "countryId or countryName query is required" },
      400,
    );
  }

  const cities = await listCitiesByCountryFromDb({ countryId, countryName });
  return c.json({ ok: true, cities });
}

export async function handleGetOnboardingState(c: Context) {
  const userId = getUserId(c);
  if (!userId) {
    return c.json({ ok: false, error: "Unauthorized" }, 401);
  }

  const state = await getOnboardingState(userId);
  if (!state) {
    return c.json({ ok: false, error: "User not found" }, 404);
  }

  return c.json({ ok: true, state });
}

export async function handleSaveProfileStep(
  c: Context,
  payload: OnboardingProfileStepPayload,
) {
  const userId = getUserId(c);
  if (!userId) {
    return c.json({ ok: false, error: "Unauthorized" }, 401);
  }

  const existingUser = await findUserById(userId);
  if (!existingUser) {
    return c.json({ ok: false, error: "User not found" }, 404);
  }

  if (!isAvatarKeyOwnedByUser(userId, payload.avatarKey)) {
    return c.json({ ok: false, error: "avatarKey does not belong to current user" }, 400);
  }

  const avatarUrl = resolveAvatarUrl(payload.avatarKey);

  const locationResult = await validateCountryCityIds(payload.countryId, payload.cityId);
  if (!locationResult.ok) {
    return c.json({ ok: false, error: locationResult.error }, 400);
  }

  await saveProfileStep(
    userId,
    payload,
    avatarUrl,
    locationResult.countryId,
    locationResult.cityId,
  );
  const state = await getOnboardingState(userId);

  return c.json({ ok: true, state });
}

export async function handleSaveInterestsStep(
  c: Context,
  payload: OnboardingInterestsStepPayload,
) {
  const userId = getUserId(c);
  if (!userId) {
    return c.json({ ok: false, error: "Unauthorized" }, 401);
  }

  const result = await replaceUserInterests(userId, payload);
  if (!result.ok) {
    return c.json({ ok: false, error: result.error }, 400);
  }

  const state = await getOnboardingState(userId);
  return c.json({ ok: true, state });
}

export async function handleSaveContributionsStep(
  c: Context,
  payload: OnboardingContributionsStepPayload,
) {
  const userId = getUserId(c);
  if (!userId) {
    return c.json({ ok: false, error: "Unauthorized" }, 401);
  }

  const result = await replaceUserContributions(userId, payload);
  if (!result.ok) {
    return c.json({ ok: false, error: result.error }, 400);
  }

  const state = await getOnboardingState(userId);
  return c.json({ ok: true, state });
}

export async function handleCompleteOnboarding(c: Context) {
  const userId = getUserId(c);
  if (!userId) {
    return c.json({ ok: false, error: "Unauthorized" }, 401);
  }

  await completeOnboarding(userId);
  const state = await getOnboardingState(userId);

  return c.json({ ok: true, state });
}
