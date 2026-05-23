import type { Context } from "hono";
import { getAuthUserId } from "../auth/utils/get-auth";
import { getMessaging } from "../../lib/firebase";
import {
  countUnreadByTypeForUser,
  createNotification,
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
import { NOTIFICATION_ICON_MAP } from "./schema/notifications.request.schema";

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
      icon:
        NOTIFICATION_ICON_MAP[n.type as NotificationType] ??
        NOTIFICATION_ICON_MAP.system,
      type: n.type,
      data: n.data as Record<string, string> | null,
      isRead: n.isRead,
      readAt: n.readAt ? n.readAt.toISOString() : null,
      archived: n.archived,
      createdAt: n.createdAt.toISOString(),
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
