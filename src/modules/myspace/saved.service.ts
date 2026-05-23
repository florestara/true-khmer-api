import type { Context } from "hono";
import { getAuthUserId } from "../auth/utils/get-auth";
import { getSavedItems } from "./saved.query";
import type { GetSavedItemsQuery } from "./schema/saved.schema";

export async function handleGetSavedItems(
  c: Context,
  query: GetSavedItemsQuery,
) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const result = await getSavedItems(authResult.userId, query);
    return c.json({ ok: true, ...result }, 200);
  } catch (err) {
    console.error("Failed to get saved items", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}
