import type { Context } from "hono";
import { getAuthUserId } from "../../auth/utils/get-auth";
import {
  declineManagePostingApplication,
  extendManagePostingDeadline,
  findManagePostingCandidate,
  findManagePostingApplicantNotificationTargets,
  findManagePostingDetail,
  findManagePostings,
  updateManagePostingAction,
  updateManagePostingApplication,
  upsertManagePostingCandidateNote,
} from "./manage-posting.query";
import {
  notifyApplicantApplicationApproved,
  notifyApplicantApplicationDeadlineExtended,
  notifyApplicantApplicationDeclined,
  notifyApplicantApplicationUnderReview,
  notifyApplicantPostingStatusChanged,
} from "../../notifications/notifications.service";
import type {
  ChangeManagePostingApplicationStatusParam,
  DeclineManagePostingApplicationQuery,
  ExtendManagePostingDeadlineBody,
  GetManagePostingApplicationParam,
  GetManagePostingCandidateParam,
  GetManagePostingDetailParam,
  GetManagePostingDetailQuery,
  GetManagePostingsQuery,
  UpsertManagePostingCandidateNoteBody,
  UpdateManagePostingActionParam,
} from "./manage-posting.schema";

async function notifyPostingApplicantsDeadlineExtended(
  userId: string,
  params: GetManagePostingDetailParam,
) {
  const targets = await findManagePostingApplicantNotificationTargets(
    userId,
    params,
  );

  await Promise.all(
    targets.map((target) =>
      notifyApplicantApplicationDeadlineExtended({
        recipientUserId: target.recipientUserId,
        postingId: params.postingId,
        postingTitle: target.postingTitle,
        sourceType: params.sourceType,
      }),
    ),
  );
}

async function notifyPostingApplicantsStatusChanged(
  userId: string,
  params: UpdateManagePostingActionParam,
  status: "closed" | "canceled" | "completed",
) {
  const targets = await findManagePostingApplicantNotificationTargets(
    userId,
    params,
  );

  await Promise.all(
    targets.map((target) =>
      notifyApplicantPostingStatusChanged({
        recipientUserId: target.recipientUserId,
        postingId: params.postingId,
        postingTitle: target.postingTitle,
        sourceType: params.sourceType,
        status,
      }),
    ),
  );
}

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

export async function handleUpdateManagePostingAction(
  c: Context,
  params: UpdateManagePostingActionParam,
) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const result = await updateManagePostingAction(authResult.userId, params);

    if (result === "not_found") {
      return c.json({ ok: false, error: "Posting not found" }, 404);
    }

    if (result === "not_in_progress") {
      return c.json(
        {
          ok: false,
          error: "Posting can only be completed after it is in progress",
        },
        409,
      );
    }

    if (result === "cancel_not_allowed") {
      return c.json(
        {
          ok: false,
          error:
            "Posting can only be canceled while it is live with applicants or in progress",
        },
        409,
      );
    }

    if (result === "close_not_allowed") {
      return c.json(
        {
          ok: false,
          error: "Posting can only be closed early while it is live",
        },
        409,
      );
    }

    if (result === "delete_not_allowed") {
      return c.json(
        {
          ok: false,
          error:
            "Posting can only be deleted while it is draft or live with no applicants",
        },
        409,
      );
    }

    if (result === "live_has_applicants") {
      return c.json(
        {
          ok: false,
          error:
            "Live posting already has applicants and must be canceled instead of deleted",
        },
        409,
      );
    }

    const notificationStatus =
      params.postingAction === "cancel"
        ? "canceled"
        : params.postingAction === "close"
          ? "closed"
          : params.postingAction === "mark_complete"
            ? "completed"
            : null;

    if (notificationStatus) {
      notifyPostingApplicantsStatusChanged(
        authResult.userId,
        params,
        notificationStatus,
      ).catch((err) =>
        console.error("Failed to notify posting status changed", err),
      );
    }

    return c.json({ ok: true, posting: result }, 200);
  } catch (error) {
    console.error("Failed to update manage posting action", error);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}

export async function handleExtendManagePostingDeadline(
  c: Context,
  params: GetManagePostingDetailParam,
  query: ExtendManagePostingDeadlineBody,
) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const result = await extendManagePostingDeadline(
      authResult.userId,
      params,
      query,
    );

    if (result === "not_found") {
      return c.json({ ok: false, error: "Posting not found" }, 404);
    }

    if (result === "deadline_extension_not_allowed") {
      return c.json(
        {
          ok: false,
          error: "Posting deadline can only be extended while it is in progress",
        },
        409,
      );
    }

    if (result === "deadline_not_later") {
      return c.json(
        {
          ok: false,
          error: "New deadline must be later than the current deadline",
        },
        409,
      );
    }

    notifyPostingApplicantsDeadlineExtended(authResult.userId, params).catch(
      (err) =>
        console.error("Failed to notify posting deadline extended", err),
    );

    return c.json({ ok: true, posting: result }, 200);
  } catch (error) {
    console.error("Failed to extend manage posting deadline", error);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}

export async function handleGetManagePostingCandidate(
  c: Context,
  params: GetManagePostingCandidateParam,
) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const detail = await findManagePostingCandidate(authResult.userId, params);

    if (!detail) {
      return c.json({ ok: false, error: "Candidate not found" }, 404);
    }

    return c.json(
      {
        ok: true,
        applicant: detail.applicant,
      },
      200,
    );
  } catch (error) {
    console.error("Failed to get manage posting candidate", error);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}

export async function handleUpsertManagePostingCandidateNote(
  c: Context,
  params: GetManagePostingCandidateParam,
  query: UpsertManagePostingCandidateNoteBody,
) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const detail = await upsertManagePostingCandidateNote(
      authResult.userId,
      params,
      query,
    );

    if (!detail) {
      return c.json({ ok: false, error: "Candidate not found" }, 404);
    }

    return c.json({ ok: true, applicant: detail.applicant }, 200);
  } catch (error) {
    console.error("Failed to upsert manage posting applicant note", error);
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

    if (result === "applicant_already_approved") {
      return c.json(
        {
          ok: false,
          error:
            "Applicant already has an approved or confirmed role for this posting",
        },
        409,
      );
    }

    const notificationPayload = {
      recipientUserId: result.applicant.candidate.id,
      postingId: params.postingId,
      sourceType: params.sourceType,
    };

    if (params.statusAction === "under_review") {
      notifyApplicantApplicationUnderReview(notificationPayload).catch((err) =>
        console.error("Failed to notify application under review", err),
      );
    } else if (params.statusAction === "approve") {
      notifyApplicantApplicationApproved(notificationPayload).catch((err) =>
        console.error("Failed to notify application approved", err),
      );
    } else {
      notifyApplicantApplicationDeclined(notificationPayload).catch((err) =>
        console.error("Failed to notify application declined", err),
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

export async function handleDeclineManagePostingApplication(
  c: Context,
  params: GetManagePostingApplicationParam,
  query: DeclineManagePostingApplicationQuery,
) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const result = await declineManagePostingApplication(
      authResult.userId,
      params,
      query,
    );

    if (result === "not_found") {
      return c.json({ ok: false, error: "Application not found" }, 404);
    }

    if (result === "conflict") {
      return c.json(
        {
          ok: false,
          error: "Application can no longer be declined by poster",
        },
        409,
      );
    }

    notifyApplicantApplicationDeclined({
      recipientUserId: result.applicant.candidate.id,
      postingId: params.postingId,
      sourceType: params.sourceType,
    }).catch((err) =>
      console.error("Failed to notify application declined", err),
    );

    return c.json(
      {
        ok: true,
        applicant: result.applicant,
      },
      200,
    );
  } catch (error) {
    console.error("Failed to decline manage posting application", error);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}
