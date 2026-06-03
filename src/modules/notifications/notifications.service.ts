import type { Context } from "hono";
import { getAuthUserId } from "../auth/utils/get-auth";
import { getMessaging } from "../../lib/firebase";
import {
  countUnreadByTypeForUser,
  createNotification,
  createOrAggregateNotification,
  createNotificationsForAllUsers,
  deleteFcmToken,
  getAllFcmTokens,
  getFcmTokensByUserId,
  listNotificationsForUser,
  markAllNotificationsRead,
  markNotificationsRead,
  upsertFcmToken,
} from "./notifications.query";
import type {
  BroadcastPayload,
  ListNotificationsQuery,
  MarkReadPayload,
  MarkAllReadQuery,
  NotificationType,
  RegisterTokenPayload,
  SendToUserPayload,
  UnregisterTokenPayload,
} from "./schema/notifications.request.schema";
import { resolveNotificationIcon } from "./schema/notifications.request.schema";

type NotificationSendResult = {
  successCount: number;
  failureCount: number;
  aggregated?: boolean;
};

export type SendNotificationToUserPayload = {
  userId: string;
  title: string;
  body: string;
  imageUrl?: string;
  type?: NotificationType;
  eventType?: string;
  dedupeKey?: string;
  aggregateBody?: (aggregateCount: number) => string;
  aggregateTitle?: (aggregateCount: number) => string;
  aggregateCount?: number;
  incrementBy?: number;
  sendPushOnAggregate?: boolean;
  reuseAfterRead?: boolean;
  archived?: boolean;
  data?: Record<string, string>;
  webRoute?: string;
  mobileRoute?: string;
};

type ForumQuestionNotificationPayload = {
  recipientUserId: string;
  questionId: string;
  questionTitle?: string | null;
};

type ForumAnswerNotificationPayload = ForumQuestionNotificationPayload & {
  answerId: string;
};

type ForumAnswerReplyNotificationPayload = ForumAnswerNotificationPayload & {
  parentAnswerId: string;
};

type ForumQuestionUpvoteNotificationPayload =
  ForumQuestionNotificationPayload & {
    upvoteCount: number;
  };

type ForumAnswerUpvoteNotificationPayload = ForumAnswerNotificationPayload & {
  upvoteCount: number;
};

type PostingNotificationSource = "volunteer" | "projects";

type PostingNotificationPayload = {
  recipientUserId: string;
  postingId: string;
  postingTitle?: string | null;
  sourceType: PostingNotificationSource;
  applicantName?: string | null;
};

type MyspaceNotificationPayload = {
  recipientUserId: string;
  title: string;
  body: string;
  eventType: string;
  type?: NotificationType;
  data?: Record<string, string>;
};

function withMobileRouteData(
  data: Record<string, string> | undefined,
  mobileRoute: string | undefined,
) {
  return mobileRoute ? { ...data, route: mobileRoute } : data;
}

function forumQuestionRoute(questionId: string) {
  return `/forum/detail/${questionId}`;
}

function forumAnswerRoute(questionId: string, answerId: string) {
  return `${forumQuestionRoute(questionId)}#answer-${answerId}`;
}

function managePostingRoute(
  sourceType: PostingNotificationSource,
  postingId: string,
) {
  return `/manage-post/${sourceType}/${postingId}`;
}

function myApplicationRoute(
  sourceType: PostingNotificationSource,
  postingId: string,
) {
  return `/my-applications/detail/${sourceType}/${postingId}`;
}

function quoteTitle(title?: string | null) {
  const normalizedTitle = title?.trim();
  return normalizedTitle ? `"${normalizedTitle}"` : null;
}

function postingDedupeKey(
  payload: PostingNotificationPayload,
  eventType: string,
) {
  return `${eventType}:${payload.postingId}`;
}

function applicationCountText(count: number) {
  return `${count} ${count === 1 ? "application" : "applications"}`;
}

function applicantCountText(count: number) {
  return `${count} ${count === 1 ? "applicant" : "applicants"}`;
}

async function sendMobilePushToUser(
  userId: string,
  payload: {
    title: string;
    body: string;
    imageUrl?: string;
    data?: Record<string, string>;
    mobileRoute?: string;
  },
): Promise<NotificationSendResult> {
  const allTokens = await getFcmTokensByUserId(userId);
  const mobileTokens = allTokens.filter(
    (t) => t.platform === "android" || t.platform === "ios",
  );

  if (mobileTokens.length === 0) {
    return { successCount: 0, failureCount: 0 };
  }

  const messaging = getMessaging();
  const CHUNK_SIZE = 500;
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < mobileTokens.length; i += CHUNK_SIZE) {
    const chunk = mobileTokens.slice(i, i + CHUNK_SIZE);
    const result = await messaging.sendEachForMulticast({
      tokens: chunk.map((t) => t.token),
      notification: {
        title: payload.title,
        body: payload.body,
        imageUrl: payload.imageUrl,
      },
      data: withMobileRouteData(payload.data, payload.mobileRoute),
    });
    successCount += result.successCount;
    failureCount += result.failureCount;
  }

  return { successCount, failureCount };
}

/**
 * Internal backend helper for system-triggered notifications.
 *
 * This stores the notification row, emits the realtime SSE event via
 * createNotification, then sends mobile FCM to the recipient's android/ios
 * tokens. Callers should pass trusted server-computed title/body/routes.
 */
export async function sendNotificationToUser(
  payload: SendNotificationToUserPayload,
): Promise<NotificationSendResult> {
  if (payload.dedupeKey) {
    const result = await createOrAggregateNotification({
      userId: payload.userId,
      title: payload.title,
      body: payload.body,
      imageUrl: payload.imageUrl,
      type: payload.type,
      eventType: payload.eventType,
      dedupeKey: payload.dedupeKey,
      archived: payload.archived,
      data: payload.data,
      webRoute: payload.webRoute,
      mobileRoute: payload.mobileRoute,
      aggregateBody: payload.aggregateBody,
      aggregateTitle: payload.aggregateTitle,
      aggregateCount: payload.aggregateCount,
      incrementBy: payload.incrementBy,
      reuseAfterRead: payload.reuseAfterRead,
    });

    if (
      result.aggregated &&
      !result.reopened &&
      !payload.sendPushOnAggregate
    ) {
      return { successCount: 0, failureCount: 0, aggregated: true };
    }

    const pushResult = await sendMobilePushToUser(payload.userId, payload);
    return { ...pushResult, aggregated: result.aggregated };
  }

  await createNotification({
    userId: payload.userId,
    title: payload.title,
    body: payload.body,
    imageUrl: payload.imageUrl,
    type: payload.type,
    eventType: payload.eventType,
    archived: payload.archived,
    data: payload.data,
    webRoute: payload.webRoute,
    mobileRoute: payload.mobileRoute,
  });

  const pushResult = await sendMobilePushToUser(payload.userId, payload);
  return { ...pushResult, aggregated: false };
}

export function notifyForumAnswerCreated(
  payload: ForumAnswerNotificationPayload,
) {
  const route = forumAnswerRoute(payload.questionId, payload.answerId);
  const questionTitle = quoteTitle(payload.questionTitle);

  return sendNotificationToUser({
    userId: payload.recipientUserId,
    title: "Someone answered your question",
    body: questionTitle
      ? `A new answer was posted on ${questionTitle}`
      : "A new answer was posted on your question",
    type: "forum",
    eventType: "forum_answer_created",
    dedupeKey: `forum_answer_created:${payload.questionId}`,
    aggregateBody: (count) =>
      questionTitle
        ? `${count} new answers were posted on ${questionTitle}`
        : `${count} new answers were posted on your question`,
    data: {
      questionId: payload.questionId,
      answerId: payload.answerId,
    },
    webRoute: route,
    mobileRoute: route,
  });
}

export function notifyForumAnswerReplyCreated(
  payload: ForumAnswerReplyNotificationPayload,
) {
  const route = forumAnswerRoute(payload.questionId, payload.answerId);
  const questionTitle = quoteTitle(payload.questionTitle);

  return sendNotificationToUser({
    userId: payload.recipientUserId,
    title: "Someone replied to your answer",
    body: questionTitle
      ? `A new reply was posted on ${questionTitle}`
      : "A new reply was posted on your answer",
    type: "forum",
    eventType: "forum_answer_reply_created",
    dedupeKey: `forum_answer_reply_created:${payload.parentAnswerId}`,
    aggregateBody: (count) =>
      questionTitle
        ? `${count} new replies were posted to your answer on ${questionTitle}`
        : `${count} new replies were posted to your answer`,
    data: {
      questionId: payload.questionId,
      answerId: payload.answerId,
      parentAnswerId: payload.parentAnswerId,
    },
    webRoute: route,
    mobileRoute: route,
  });
}

export function notifyForumQuestionUpvoted(
  payload: ForumQuestionUpvoteNotificationPayload,
) {
  const route = forumQuestionRoute(payload.questionId);
  const questionTitle = quoteTitle(payload.questionTitle);
  const formatBody = (count: number) =>
    questionTitle
      ? `${count} ${count === 1 ? "person" : "people"} upvoted ${questionTitle}`
      : `${count} ${count === 1 ? "person" : "people"} upvoted your question`;

  return sendNotificationToUser({
    userId: payload.recipientUserId,
    title: "Your question got an upvote",
    body: formatBody(payload.upvoteCount),
    type: "forum",
    eventType: "forum_question_upvoted",
    dedupeKey: `forum_question_upvoted:${payload.questionId}`,
    reuseAfterRead: true,
    aggregateCount: payload.upvoteCount,
    aggregateBody: formatBody,
    data: {
      questionId: payload.questionId,
    },
    webRoute: route,
    mobileRoute: route,
  });
}

export function notifyForumAnswerUpvoted(
  payload: ForumAnswerUpvoteNotificationPayload,
) {
  const route = forumAnswerRoute(payload.questionId, payload.answerId);
  const questionTitle = quoteTitle(payload.questionTitle);
  const formatBody = (count: number) =>
    questionTitle
      ? `${count} ${count === 1 ? "person" : "people"} upvoted your answer on ${questionTitle}`
      : `${count} ${count === 1 ? "person" : "people"} upvoted your answer`;

  return sendNotificationToUser({
    userId: payload.recipientUserId,
    title: "Your answer got an upvote",
    body: formatBody(payload.upvoteCount),
    type: "forum",
    eventType: "forum_answer_upvoted",
    dedupeKey: `forum_answer_upvoted:${payload.answerId}`,
    reuseAfterRead: true,
    aggregateCount: payload.upvoteCount,
    aggregateBody: formatBody,
    data: {
      questionId: payload.questionId,
      answerId: payload.answerId,
    },
    webRoute: route,
    mobileRoute: route,
  });
}

export function notifyForumBestAnswerSelected(
  payload: ForumAnswerNotificationPayload,
) {
  const route = forumAnswerRoute(payload.questionId, payload.answerId);
  const questionTitle = quoteTitle(payload.questionTitle);

  return sendNotificationToUser({
    userId: payload.recipientUserId,
    title: "Your answer was selected",
    body: questionTitle
      ? `Your answer was selected as best answer on ${questionTitle}`
      : "Your answer was selected as the best answer",
    type: "achievement",
    eventType: "forum_best_answer_selected",
    data: {
      questionId: payload.questionId,
      answerId: payload.answerId,
    },
    webRoute: route,
    mobileRoute: route,
  });
}

export function notifyApplicationReceived(payload: PostingNotificationPayload) {
  const route = managePostingRoute(payload.sourceType, payload.postingId);
  const title = payload.postingTitle ?? "your posting";
  const eventType = `${payload.sourceType}_application_received`;
  const formatBody = (count: number) =>
    count === 1
      ? payload.applicantName
        ? `${payload.applicantName} applied to ${title}`
        : `Someone applied to ${title}`
      : `${applicationCountText(count)} received for ${title}`;

  return sendNotificationToUser({
    userId: payload.recipientUserId,
    title: "New application received",
    body: formatBody(1),
    type:
      payload.sourceType === "projects" ? "launchpad_update" : "application",
    eventType,
    dedupeKey: postingDedupeKey(payload, eventType),
    reuseAfterRead: true,
    aggregateBody: formatBody,
    data: {
      postingId: payload.postingId,
      sourceType: payload.sourceType,
    },
    webRoute: route,
    mobileRoute: route,
  });
}

export function notifyApplicantApplicationUnderReview(
  payload: PostingNotificationPayload,
) {
  const route = myApplicationRoute(payload.sourceType, payload.postingId);
  const eventType = `${payload.sourceType}_application_under_review`;
  const formatBody = (count: number) =>
    count === 1
      ? payload.postingTitle
        ? `Your application for ${payload.postingTitle} is under review`
        : "Your application is under review"
      : `${applicationCountText(count)} for this posting are under review`;

  return sendNotificationToUser({
    userId: payload.recipientUserId,
    title: "Application under review",
    body: formatBody(1),
    type:
      payload.sourceType === "projects" ? "launchpad_update" : "application",
    eventType,
    dedupeKey: postingDedupeKey(payload, eventType),
    reuseAfterRead: true,
    aggregateBody: formatBody,
    data: {
      postingId: payload.postingId,
      sourceType: payload.sourceType,
    },
    webRoute: route,
    mobileRoute: route,
  });
}

export function notifyApplicantApplicationApproved(
  payload: PostingNotificationPayload,
) {
  const route = myApplicationRoute(payload.sourceType, payload.postingId);
  const eventType = `${payload.sourceType}_application_approved`;
  const formatBody = (count: number) =>
    count === 1
      ? payload.postingTitle
        ? `Your application for ${payload.postingTitle} was approved`
        : "Your application was approved"
      : `${applicationCountText(count)} for this posting were approved`;

  return sendNotificationToUser({
    userId: payload.recipientUserId,
    title: "Application approved",
    body: formatBody(1),
    type:
      payload.sourceType === "projects" ? "launchpad_update" : "application",
    eventType,
    dedupeKey: postingDedupeKey(payload, eventType),
    reuseAfterRead: true,
    aggregateBody: formatBody,
    data: {
      postingId: payload.postingId,
      sourceType: payload.sourceType,
    },
    webRoute: route,
    mobileRoute: route,
  });
}

export function notifyApplicantApplicationDeclined(
  payload: PostingNotificationPayload,
) {
  const route = myApplicationRoute(payload.sourceType, payload.postingId);
  const eventType = `${payload.sourceType}_application_declined`;
  const formatBody = (count: number) =>
    count === 1
      ? payload.postingTitle
        ? `Your application for ${payload.postingTitle} was declined`
        : "Your application was declined"
      : `${applicationCountText(count)} for this posting were declined`;

  return sendNotificationToUser({
    userId: payload.recipientUserId,
    title: "Application declined",
    body: formatBody(1),
    type:
      payload.sourceType === "projects" ? "launchpad_update" : "application",
    eventType,
    dedupeKey: postingDedupeKey(payload, eventType),
    reuseAfterRead: true,
    aggregateBody: formatBody,
    data: {
      postingId: payload.postingId,
      sourceType: payload.sourceType,
    },
    webRoute: route,
    mobileRoute: route,
  });
}

export function notifyApplicantApplicationDeadlineExtended(
  payload: PostingNotificationPayload,
) {
  const route = myApplicationRoute(payload.sourceType, payload.postingId);

  return sendNotificationToUser({
    userId: payload.recipientUserId,
    title: "Application deadline extended",
    body: payload.postingTitle
      ? `The deadline for ${payload.postingTitle} was extended`
      : "An application deadline was extended",
    type: "event_reminder",
    eventType: `${payload.sourceType}_deadline_extended`,
    data: {
      postingId: payload.postingId,
      sourceType: payload.sourceType,
    },
    webRoute: route,
    mobileRoute: route,
  });
}

export function notifyApplicantPostingStatusChanged(
  payload: PostingNotificationPayload & {
    status: "closed" | "canceled" | "completed" | "in_progress";
  },
) {
  const route = myApplicationRoute(payload.sourceType, payload.postingId);
  const titleByStatus = {
    closed: "Posting closed",
    canceled: "Posting canceled",
    completed: "Posting completed",
    in_progress: "Posting in progress",
  } as const;
  const bodyByStatus = {
    closed: payload.postingTitle
      ? `${payload.postingTitle} was closed`
      : "A posting you applied to was closed",
    canceled: payload.postingTitle
      ? `${payload.postingTitle} was canceled`
      : "A posting you applied to was canceled",
    completed: payload.postingTitle
      ? `${payload.postingTitle} was completed`
      : "A posting you applied to was completed",
    in_progress: payload.postingTitle
      ? `${payload.postingTitle} is now in progress`
      : "A posting you applied to is now in progress",
  } as const;

  return sendNotificationToUser({
    userId: payload.recipientUserId,
    title: titleByStatus[payload.status],
    body: bodyByStatus[payload.status],
    type:
      payload.sourceType === "projects" ? "launchpad_update" : "application",
    eventType: `${payload.sourceType}_posting_${payload.status}`,
    data: {
      postingId: payload.postingId,
      sourceType: payload.sourceType,
      status: payload.status,
    },
    webRoute: route,
    mobileRoute: route,
  });
}

export function notifyApplicantParticipationConfirmed(
  payload: PostingNotificationPayload,
) {
  const route = managePostingRoute(payload.sourceType, payload.postingId);
  const eventType = `${payload.sourceType}_application_confirmed`;
  const formatBody = (count: number) =>
    count === 1
      ? payload.applicantName
        ? `${payload.applicantName} confirmed participation`
        : "An applicant confirmed participation"
      : `${applicantCountText(count)} confirmed participation`;

  return sendNotificationToUser({
    userId: payload.recipientUserId,
    title: "Applicant confirmed participation",
    body: formatBody(1),
    type:
      payload.sourceType === "projects" ? "launchpad_update" : "application",
    eventType,
    dedupeKey: postingDedupeKey(payload, eventType),
    reuseAfterRead: true,
    aggregateBody: formatBody,
    data: {
      postingId: payload.postingId,
      sourceType: payload.sourceType,
    },
    webRoute: route,
    mobileRoute: route,
  });
}

export function notifyApplicantParticipationDeclined(
  payload: PostingNotificationPayload,
) {
  const route = managePostingRoute(payload.sourceType, payload.postingId);
  const eventType = `${payload.sourceType}_application_declined_by_applicant`;
  const formatBody = (count: number) =>
    count === 1
      ? payload.applicantName
        ? `${payload.applicantName} declined participation`
        : "An applicant declined participation"
      : `${applicantCountText(count)} declined participation`;

  return sendNotificationToUser({
    userId: payload.recipientUserId,
    title: "Applicant declined participation",
    body: formatBody(1),
    type:
      payload.sourceType === "projects" ? "launchpad_update" : "application",
    eventType,
    dedupeKey: postingDedupeKey(payload, eventType),
    reuseAfterRead: true,
    aggregateBody: formatBody,
    data: {
      postingId: payload.postingId,
      sourceType: payload.sourceType,
    },
    webRoute: route,
    mobileRoute: route,
  });
}

export function notifyApplicantApplicationWithdrawn(
  payload: PostingNotificationPayload,
) {
  const route = managePostingRoute(payload.sourceType, payload.postingId);
  const eventType = `${payload.sourceType}_application_withdrawn`;
  const formatBody = (count: number) =>
    count === 1
      ? payload.applicantName
        ? `${payload.applicantName} withdrew their application`
        : "An applicant withdrew their application"
      : `${applicationCountText(count)} were withdrawn`;

  return sendNotificationToUser({
    userId: payload.recipientUserId,
    title: "Applicant withdrew application",
    body: formatBody(1),
    type:
      payload.sourceType === "projects" ? "launchpad_update" : "application",
    eventType,
    dedupeKey: postingDedupeKey(payload, eventType),
    reuseAfterRead: true,
    aggregateBody: formatBody,
    data: {
      postingId: payload.postingId,
      sourceType: payload.sourceType,
    },
    webRoute: route,
    mobileRoute: route,
  });
}

export function notifyMyspaceAchievement(payload: MyspaceNotificationPayload) {
  return sendNotificationToUser({
    userId: payload.recipientUserId,
    title: payload.title,
    body: payload.body,
    type: payload.type ?? "achievement",
    eventType: payload.eventType,
    data: payload.data,
    webRoute: "/myspace",
    mobileRoute: "/myspace",
  });
}

export async function handleRegisterToken(
  c: Context,
  payload: RegisterTokenPayload,
) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) return authResult.response;

  try {
    await upsertFcmToken(authResult.userId, payload.token, payload.platform);
    return c.json(
      {
        ok: true,
        message: "FCM token registered",
        platform: payload.platform || "web",
      },
      200,
    );
  } catch (err) {
    console.error("Failed to register FCM token", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}

export async function handleUnregisterToken(
  c: Context,
  payload: UnregisterTokenPayload,
) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) return authResult.response;

  try {
    await deleteFcmToken(authResult.userId, payload.token);
    return c.json({ ok: true, message: "FCM token unregistered" }, 200);
  } catch (err) {
    console.error("Failed to unregister FCM token", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}

export async function handleSendToUser(c: Context, payload: SendToUserPayload) {
  try {
    await createNotification({
      userId: payload.userId,
      title: payload.title,
      body: payload.body,
      imageUrl: payload.imageUrl,
      type: payload.type,
      archived: payload.archived,
      data: payload.data,
      webRoute: payload.webRoute,
      mobileRoute: payload.mobileRoute,
    });

    const allTokens = await getFcmTokensByUserId(payload.userId);
    const mobileTokens = allTokens.filter(
      (t) => t.platform === "android" || t.platform === "ios",
    );

    if (mobileTokens.length === 0) {
      return c.json({ ok: true, successCount: 0, failureCount: 0 }, 200);
    }

    const messaging = getMessaging();
    const CHUNK_SIZE = 500;
    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < mobileTokens.length; i += CHUNK_SIZE) {
      const chunk = mobileTokens.slice(i, i + CHUNK_SIZE);
      // For mobile FCM, include mobileRoute in data payload
      const fcmData = payload.mobileRoute
        ? { ...payload.data, route: payload.mobileRoute }
        : payload.data;
      const result = await messaging.sendEachForMulticast({
        tokens: chunk.map((t) => t.token),
        notification: {
          title: payload.title,
          body: payload.body,
          imageUrl: payload.imageUrl,
        },
        data: fcmData,
      });
      successCount += result.successCount;
      failureCount += result.failureCount;
    }

    return c.json({ ok: true, successCount, failureCount }, 200);
  } catch (err) {
    console.error("Failed to send notification to user", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}

export async function handleBroadcast(c: Context, payload: BroadcastPayload) {
  try {
    await createNotificationsForAllUsers({
      title: payload.title,
      body: payload.body,
      imageUrl: payload.imageUrl,
      type: payload.type,
      archived: payload.archived,
      data: payload.data,
      webRoute: payload.webRoute,
      mobileRoute: payload.mobileRoute,
    });

    const allTokens = await getAllFcmTokens();
    const mobileTokens = allTokens.filter(
      (t) => t.platform === "android" || t.platform === "ios",
    );

    if (mobileTokens.length === 0) {
      return c.json({ ok: true, successCount: 0, failureCount: 0 }, 200);
    }

    const messaging = getMessaging();
    const CHUNK_SIZE = 500;
    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < mobileTokens.length; i += CHUNK_SIZE) {
      const chunk = mobileTokens.slice(i, i + CHUNK_SIZE);
      // For mobile FCM, include mobileRoute in data payload
      const fcmData = payload.mobileRoute
        ? { ...payload.data, route: payload.mobileRoute }
        : payload.data;
      const result = await messaging.sendEachForMulticast({
        tokens: chunk.map((t) => t.token),
        notification: {
          title: payload.title,
          body: payload.body,
          imageUrl: payload.imageUrl,
        },
        data: fcmData,
      });
      successCount += result.successCount;
      failureCount += result.failureCount;
    }

    return c.json({ ok: true, successCount, failureCount }, 200);
  } catch (err) {
    console.error("Failed to broadcast notification", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}

export async function handleListNotifications(
  c: Context,
  query: ListNotificationsQuery,
) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) return authResult.response;

  try {
    const { rows, total } = await listNotificationsForUser(
      authResult.userId,
      query,
    );

    // Get unread counts by type
    const countsByType = await countUnreadByTypeForUser(authResult.userId);

    // Get all notification types from the enum
    const allTypes = [
      "forum",
      "profile_view",
      "new_message",
      "achievement",
      "event_reminder",
      "application",
      "launchpad_update",
      "points",
      "system",
    ];

    // Ensure all types are included, even if count is 0
    const unreadCounts: Record<string, number> = {};
    for (const type of allTypes) {
      unreadCounts[type] = countsByType[type] || 0;
    }

    const notifications = rows.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      imageUrl: n.imageUrl,
      icon: resolveNotificationIcon(n.type, n.eventType),
      type: n.type,
      eventType: n.eventType,
      dedupeKey: n.dedupeKey,
      aggregateCount: n.aggregateCount,
      data: n.data as Record<string, string> | null,
      isRead: n.isRead,
      readAt: n.readAt ? n.readAt.toISOString() : null,
      archived: n.archived,
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.updatedAt.toISOString(),
      webRoute: n.webRoute,
      mobileRoute: n.mobileRoute,
    }));

    return c.json(
      {
        ok: true,
        notifications,
        total,
        page: query.page,
        limit: query.limit,
        unreadCounts,
      },
      200,
    );
  } catch (err) {
    console.error("Failed to list notifications", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}

export async function handleMarkRead(c: Context, payload: MarkReadPayload) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) return authResult.response;

  try {
    await markNotificationsRead(authResult.userId, payload.notificationIds);
    return c.json({ ok: true, message: "Notifications marked as read" }, 200);
  } catch (err) {
    console.error("Failed to mark notifications as read", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}

export async function handleMarkAllRead(c: Context, query: MarkAllReadQuery) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) return authResult.response;

  try {
    await markAllNotificationsRead(authResult.userId, {
      archived: query.archived,
      type: query.type,
    });
    return c.json(
      { ok: true, message: "All notifications marked as read" },
      200,
    );
  } catch (err) {
    console.error("Failed to mark all notifications as read", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}
