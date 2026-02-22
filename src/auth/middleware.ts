import { createMiddleware } from "hono/factory";
import { verifyJwtToken } from "./helper";
import { findUserRoleById } from "./query";

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

  c.set("auth", verifyResult.payload);
  await next();
});

export const requireAdmin = createMiddleware(async (c, next) => {
  const authResult = await requireAccessToken(c, async () => {});
  if (authResult) {
    return authResult;
  }

  const authPayload = c.get("auth") as
    | {
        sub?: string;
        id?: string;
        [key: string]: unknown;
      }
    | undefined;

  const userId = authPayload?.sub ?? authPayload?.id;

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
