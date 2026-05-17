import type { Context } from "hono";
import { getAuthUserId } from "../../auth/utils/get-auth";
import {
  findManagePostingApplication,
  findManagePostingDetail,
  findManagePostings,
  updateManagePostingApplication,
} from "./manage-posting.query";
import type {
  ChangeManagePostingApplicationStatusParam,
  GetManagePostingApplicationParam,
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

export async function handleGetManagePostingApplication(
  c: Context,
  params: GetManagePostingApplicationParam,
) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const detail = await findManagePostingApplication(authResult.userId, params);

    if (!detail) {
      return c.json({ ok: false, error: "Application not found" }, 404);
    }

    return c.json(
      {
        ok: true,
        applicant: detail.applicant,
      },
      200,
    );
  } catch (error) {
    console.error("Failed to get manage posting application", error);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}

export async function handleUpdateManagePostingApplication(
  c: Context,
  params: ChangeManagePostingApplicationStatusParam,
) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const result = await updateManagePostingApplication(
      authResult.userId,
      params,
    );

    if (result === "not_found") {
      return c.json({ ok: false, error: "Application not found" }, 404);
    }

    if (result === "conflict") {
      return c.json(
        {
          ok: false,
          error: "Application can no longer be changed by poster",
        },
        409,
      );
    }

    if (result === "role_filled") {
      return c.json(
        {
          ok: false,
          error: "Role capacity has already been reached",
        },
        409,
      );
    }

    return c.json(
      {
        ok: true,
        applicant: result.applicant,
      },
      200,
    );
  } catch (error) {
    console.error("Failed to update manage posting application", error);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}
