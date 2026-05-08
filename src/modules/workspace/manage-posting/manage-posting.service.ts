import type { Context } from "hono";
import { getAuthUserId } from "../../auth/utils/get-auth";
import { findManagePostings } from "./manage-posting.query";
import type { GetManagePostingsQuery } from "./manage-posting.schema";

export async function handleGetManagePostings(
  c: Context,
  query: GetManagePostingsQuery,
) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const postings = await findManagePostings(authResult.userId, query);

    return c.json(
      {
        ok: true,
        postings,
        total: postings.length,
      },
      200,
    );
  } catch (error) {
    console.error("Failed to get manage postings", error);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}
