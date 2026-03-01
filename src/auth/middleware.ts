import { createMiddleware } from "hono/factory";
import { getAuthUserId, type AuthPayload } from "./types";
import { verifyJwtToken } from "./helper";
import { findUserRoleById } from "./query";

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

export const requireAccessToken = createMiddleware(async (c, next) => {
  const authorization = c.req.header("authorization") ?? "";

  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return c.json({ error: "Missing bearer token" }, 401);
  }

  const token = authorization.slice(7).trim();
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
  await next();
});

export const requireAdmin = createMiddleware(async (c, next) => {
  const authResult = await requireAccessToken(c, async () => {});
  if (authResult) {
    return authResult;
  }

  const authPayload = c.get("auth") as AuthPayload | undefined;
  if (!authPayload) {
    return c.json({ error: "Invalid access token payload" }, 401);
  }
  const userId = getAuthUserId(authPayload);
  if (!userId) {
    return c.json({ error: "Invalid access token payload" }, 401);
  }

  const foundUser = await findUserRoleById(userId);

  if (!foundUser) {
    return c.json({ error: "User not found" }, 401);
  }

  if (foundUser.role !== "admin") {
    return c.json({ error: "Admin role required" }, 403);
  }

  await next();
});
