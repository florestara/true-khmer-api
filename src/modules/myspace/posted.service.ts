import type { Context } from "hono";
import { getAuthUserId } from "../auth/utils/get-auth";
import { canViewProfileContributions } from "./profile.query";
import { getPostedItemsByUserId, MyPostedQueryError } from "./posted.query";
import type {
  GetMyPostedQuery,
  GetPublicProfileParams,
} from "./profile.schema";

export async function handleGetPostedItems(
  c: Context,
  params: GetPublicProfileParams,
  query: GetMyPostedQuery,
) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const canViewContributions = await canViewProfileContributions(
      params.userId,
      authResult.userId,
    );
    if (canViewContributions === null) {
      return c.json({ ok: false, error: "User not found" }, 404);
    }

    if (!canViewContributions) {
      return c.json({ ok: false, error: "Contributions are private" }, 403);
    }

    const result = await getPostedItemsByUserId(
      params.userId,
      authResult.userId,
      query,
    );
    return c.json({ ok: true, ...result }, 200);
  } catch (err) {
    if (err instanceof MyPostedQueryError) {
      return c.json({ ok: false, error: err.message }, 400);
    }

    console.error("Failed to get posted items", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}
