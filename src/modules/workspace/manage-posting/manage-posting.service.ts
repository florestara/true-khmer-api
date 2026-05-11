import type { Context } from "hono";
import { getAuthUserId } from "../../auth/utils/get-auth";
import {
  findManagePostingDetail,
  findManagePostings,
} from "./manage-posting.query";
import type {
  GetManagePostingDetailParam,
  GetManagePostingDetailQuery,
  GetManagePostingsQuery,
} from "./manage-posting.schema";

export async function handleGetManagePostings(
  c: Context,
  query: GetManagePostingsQuery,
) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const result = await findManagePostings(authResult.userId, query);

    return c.json(
      {
        ok: true,
        postings: result.postings,
        pagination: result.pagination,
      },
      200,
    );
  } catch (error) {
    console.error("Failed to get manage postings", error);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}

export async function handleGetManagePostingDetail(
  c: Context,
  params: GetManagePostingDetailParam,
  query: GetManagePostingDetailQuery,
) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const detail = await findManagePostingDetail(
      authResult.userId,
      params,
      query,
    );

    if (!detail) {
      return c.json({ ok: false, error: "Posting not found" }, 404);
    }

    return c.json(
      {
        ok: true,
        detail,
      },
      200,
    );
  } catch (error) {
    console.error("Failed to get manage posting detail", error);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}
