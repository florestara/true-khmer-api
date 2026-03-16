import type { Context } from "hono";
import { getAuthUserId, type AuthPayload } from "../../../auth/types";
import { FORUM_UUID_RE } from "../constants";

export function getValidatedForumAuthUserId(
  c: Context,
): { ok: true; userId: string } | { ok: false; response: Response } {
  const authPayload = c.get("auth") as AuthPayload | undefined;
  const userId = getAuthUserId(authPayload);

  if (!userId) {
    return {
      ok: false,
      response: c.json({ ok: false, error: "Authenticated user id not found" }, 401),
    };
  }

  if (!FORUM_UUID_RE.test(userId)) {
    return {
      ok: false,
      response: c.json(
        {
          ok: false,
          error:
            "Authenticated user id is not UUID. Align forum author_id type with auth user id type.",
        },
        400,
      ),
    };
  }

  return { ok: true, userId };
}
