import type { Context } from "hono";
import { getAuthUserId } from "../auth/utils/get-auth";
import { getMessaging } from "../../lib/firebase";
import {
  countUnreadForUser,
  createNotification,
  createNotificationsForAllUsers,
  deleteFcmToken,
  getAllFcmTokens,
  getFcmTokensByUserId,
  listNotificationsForUser,
  markNotificationsRead,
  upsertFcmToken,
} from "./notifications.query";
import type {
  BroadcastPayload,
  ListNotificationsQuery,
  MarkReadPayload,
  RegisterTokenPayload,
  SendToUserPayload,
  UnregisterTokenPayload,
} from "./notifications.schema";

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
    createNotification({
      userId: payload.userId,
      title: payload.title,
      body: payload.body,
      imageUrl: payload.imageUrl,
      data: payload.data,
    }).catch((err) => console.error("Failed to persist notification", err));

    const allTokens = await getFcmTokensByUserId(payload.userId);
    const mobileTokens = allTokens.filter(
      (t) => t.platform === "android" || t.platform === "ios",
    );

    if (mobileTokens.length === 0) {
      return c.json({ ok: true, successCount: 0, failureCount: 0 }, 200);
    }

    const messaging = getMessaging();
    const result = await messaging.sendEachForMulticast({
      tokens: mobileTokens.map((t) => t.token),
      notification: {
        title: payload.title,
        body: payload.body,
        imageUrl: payload.imageUrl,
      },
      data: payload.data,
    });

    return c.json(
      {
        ok: true,
        successCount: result.successCount,
        failureCount: result.failureCount,
      },
      200,
    );
  } catch (err) {
    console.error("Failed to send notification to user", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}

export async function handleBroadcast(c: Context, payload: BroadcastPayload) {
  try {
    createNotificationsForAllUsers({
      title: payload.title,
      body: payload.body,
      imageUrl: payload.imageUrl,
      data: payload.data,
    }).catch((err) =>
      console.error("Failed to persist broadcast notifications", err),
    );

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
      const result = await messaging.sendEachForMulticast({
        tokens: chunk.map((t) => t.token),
        notification: {
          title: payload.title,
          body: payload.body,
          imageUrl: payload.imageUrl,
        },
        data: payload.data,
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

    const notifications = rows.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      imageUrl: n.imageUrl,
      data: n.data as Record<string, string> | null,
      isRead: n.isRead,
      readAt: n.readAt ? n.readAt.toISOString() : null,
      createdAt: n.createdAt.toISOString(),
    }));

    return c.json(
      { ok: true, notifications, total, page: query.page, limit: query.limit },
      200,
    );
  } catch (err) {
    console.error("Failed to list notifications", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}

export async function handleCountUnread(c: Context) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) return authResult.response;

  try {
    const count = await countUnreadForUser(authResult.userId);
    return c.json({ ok: true, unreadCount: count }, 200);
  } catch (err) {
    console.error("Failed to count unread notifications", err);
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
