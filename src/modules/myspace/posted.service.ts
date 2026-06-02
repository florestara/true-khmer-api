import type { Context } from "hono";
import { getAuthUserId } from "../auth/utils/get-auth";
import { profileUserExists } from "./profile.query";
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
  const viewerId = authResult.ok ? authResult.userId : undefined;

  try {
    if (!(await profileUserExists(params.userId))) {
      return c.json({ ok: false, error: "User not found" }, 404);
    }

    const result = await getPostedItemsByUserId(
      params.userId,
      viewerId,
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
