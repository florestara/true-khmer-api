import { createMiddleware } from "hono/factory";
import { getAuthUserId, type AuthPayload } from "./types";
import { verifyJwtToken } from "./helper";
import { findUserOnboardingStatusById, findUserRoleById } from "./query";
import { ONBOARDING_COMPLETE_STEP } from "../onboarding/constants";
import type { Context } from "hono";

function isAccessTokenPayload(payload: Record<string, unknown>) {
  const tokenType = payload.type ?? payload.tokenType ?? payload.token_type;

  if (typeof tokenType !== "string") {
    return false;
  }

  const normalized = tokenType.toLowerCase();
  return (
    normalized === "access" ||
    normalized === "access_token" ||
    normalized === "accesstoken"
  );
}

function readBearerToken(authorization?: string) {
  if (!authorization) return null;
  if (!authorization.toLowerCase().startsWith("bearer ")) return null;

  const token = authorization.slice(7).trim();
  return token || null;
}

async function authenticateAccessToken(c: Context) {
  const token = readBearerToken(c.req.header("authorization"));

  if (!token) {
    return c.json({ error: "Missing bearer token" }, 401);
  }

  const verifyResult = await verifyJwtToken(token);
  if (!verifyResult.ok) {
    return c.json({ error: "Invalid or expired access token" }, 401);
  }

  if (!isAccessTokenPayload(verifyResult.payload)) {
    return c.json({ error: "Access token required" }, 401);
  }

  const userId = getAuthUserId(verifyResult.payload as AuthPayload);
  if (!userId) {
    return c.json({ error: "Invalid access token payload" }, 401);
  }

  c.set("auth", verifyResult.payload);
  return null;
}

function createRequireAccessTokenMiddleware(options?: { allowIncompleteOnboarding?: boolean }) {
  return createMiddleware(async (c, next) => {
    const authError = await authenticateAccessToken(c);
    if (authError) {
      return authError;
    }

    const authPayload = c.get("auth") as AuthPayload | undefined;
    if (!authPayload) {
      return c.json({ error: "Invalid access token payload" }, 401);
    }

    const userId = getAuthUserId(authPayload);
    if (!userId) {
      return c.json({ error: "Invalid access token payload" }, 401);
    }

    if (!options?.allowIncompleteOnboarding) {
      const onboardingStatus = await findUserOnboardingStatusById(userId);

      if (!onboardingStatus) {
        return c.json({ error: "User not found" }, 401);
      }

      const isOnboardingCompleted =
        onboardingStatus.onboardingCompletedAt !== null &&
        onboardingStatus.onboardingStep >= ONBOARDING_COMPLETE_STEP;

      if (!isOnboardingCompleted) {
        return c.json(
          {
            error: "Onboarding required",
            code: "ONBOARDING_REQUIRED",
          },
          403,
        );
      }
    }

    await next();
  });
}

export const requireAccessToken = createRequireAccessTokenMiddleware();

export const requireAccessTokenAllowIncompleteOnboarding =
  createRequireAccessTokenMiddleware({
    allowIncompleteOnboarding: true,
  });

export const requireAdmin = createMiddleware(async (c, next) => {
  const authError = await authenticateAccessToken(c);
  if (authError) {
    return authError;
  }

  const authPayload = c.get("auth") as AuthPayload | undefined;
  if (!authPayload) {
    return c.json({ error: "Invalid access token payload" }, 401);
  }

  const userId = getAuthUserId(authPayload);
  if (!userId) {
    return c.json({ error: "Invalid access token payload" }, 401);
  }

  const user = await findUserRoleById(userId);

  if (!user) {
    return c.json({ error: "User not found" }, 401);
  }

  if (user.role !== "admin") {
    return c.json({ error: "Admin role required" }, 403);
  }

  await next();
});