import type { Context } from "hono";
import type { AuthContext, GetAuthUserIdResult } from "../lib/types";

export function getAuthUserId(c: Context): GetAuthUserIdResult {
  const auth = c.get("auth") as AuthContext | undefined;
  if (!auth) {
    return {
      ok: false,
      response: c.json({ ok: false, error: "Unauthorized" }, 401),
    };
  }

  return { ok: true, userId: auth.userId };
}
