import { createMiddleware } from "hono/factory";
import type { AuthContext, AuthPayload } from "./types";
import { verifyJwtToken } from "./helper";
import { findUserOnboardingStatusById, findUserRoleById } from "../auth.query";
import { ONBOARDING_COMPLETE_STEP } from "../../onboarding/constants";
import type { Context } from "hono";
import { UUID_RE } from "../../../lib/constant";

const AUTH_USER_ID_UUID_RE = UUID_RE;

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

function authErrorResponse(
  c: Context,
  status: 401 | 403,
  error: string,
  code?: string,
) {
  return c.json(
    {
      ok: false as const,
      error,
      ...(code ? { code } : {}),
    },
    status,
  );
}

async function authenticateAccessToken(c: Context) {
  const token = readBearerToken(c.req.header("authorization"));

  if (!token) {
    return authErrorResponse(c, 401, "Missing bearer token");
  }

  const verifyResult = await verifyJwtToken(token);
  if (!verifyResult.ok) {
    return authErrorResponse(c, 401, "Invalid or expired access token");
  }

  if (!isAccessTokenPayload(verifyResult.payload)) {
    return authErrorResponse(c, 401, "Access token required");
  }

  const sub = (verifyResult.payload as AuthPayload).sub;
  if (typeof sub !== "string" || sub.trim().length === 0) {
    return authErrorResponse(c, 401, "Invalid access token payload");
  }

  const userId = sub.trim();
  if (!AUTH_USER_ID_UUID_RE.test(userId)) {
    return authErrorResponse(c, 401, "User identifier must be a valid UUID");
  }

  c.set("auth", { userId } satisfies AuthContext);
  return null;
}

function createRequireAccessTokenMiddleware(options?: {
  allowIncompleteOnboarding?: boolean;
}) {
  return createMiddleware(async (c, next) => {
    const authError = await authenticateAccessToken(c);
    if (authError) {
      return authError;
    }

    const auth = c.get("auth") as AuthContext | undefined;
    if (!auth) {
      return authErrorResponse(c, 401, "Invalid access token payload");
    }

    if (!options?.allowIncompleteOnboarding) {
      const onboardingStatus = await findUserOnboardingStatusById(auth.userId);

      if (!onboardingStatus) {
        return authErrorResponse(c, 401, "User not found");
      }

      const isOnboardingCompleted =
        onboardingStatus.onboardingCompletedAt !== null &&
        onboardingStatus.onboardingStep >= ONBOARDING_COMPLETE_STEP;

      if (!isOnboardingCompleted) {
        return authErrorResponse(
          c,
          403,
          "Onboarding required",
          "ONBOARDING_REQUIRED",
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

  const auth = c.get("auth") as AuthContext | undefined;
  if (!auth) {
    return authErrorResponse(c, 401, "Invalid access token payload");
  }

  const user = await findUserRoleById(auth.userId);

  if (!user) {
    return authErrorResponse(c, 401, "User not found");
  }

  if (user.role !== "admin") {
    return authErrorResponse(c, 403, "Admin role required");
  }

  await next();
});
