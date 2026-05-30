import { EventEmitter } from "events";
import { db } from "../../db";
import { fcmToken } from "../../db/schema/fcm-token";
import { notification } from "../../db/schema/notification";
import { and, count, eq, inArray, sql } from "drizzle-orm";
import type {
  FcmTokenPlatform,
  ListNotificationsQuery,
  NotificationType,
} from "./schema/notifications.request.schema";
import { resolveNotificationIcon } from "./schema/notifications.request.schema";

export const notificationEmitter = new EventEmitter();
notificationEmitter.setMaxListeners(0);

function emitToUser(
  userId: string,
  row: {
    id: string;
    title: string;
    body: string;
    imageUrl: string | null;
    type?: string;
    eventType?: string | null;
    data?: Record<string, string> | null;
    webRoute?: string | null;
    mobileRoute?: string | null;
    aggregateCount?: number;
    createdAt: Date;
    updatedAt?: Date;
  },
) {
  notificationEmitter.emit(`notify:${userId}`, {
    id: row.id,
    title: row.title,
    body: row.body,
    imageUrl: row.imageUrl,
    icon: resolveNotificationIcon(row.type, row.eventType),
    type: row.type,
    eventType: row.eventType,
    data: row.data,
    webRoute: row.webRoute,
    mobileRoute: row.mobileRoute,
    aggregateCount: row.aggregateCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt?.toISOString(),
  });
}

export async function upsertFcmToken(
  userId: string,
  token: string,
  platform: FcmTokenPlatform,
) {
  const [inserted] = await db
    .insert(fcmToken)
    .values({ userId, token, platform })
    .onConflictDoUpdate({
      target: fcmToken.token,
      set: {
        userId,
        platform,
        updatedAt: new Date(),
      },
    })
    .returning();

  return inserted;
}

export async function deleteFcmToken(userId: string, token: string) {
  const [deleted] = await db
    .delete(fcmToken)
    .where(and(eq(fcmToken.userId, userId), eq(fcmToken.token, token)))
    .returning();

  return deleted ?? null;
}

export async function getFcmTokensByUserId(userId: string) {
  return db.query.fcmToken.findMany({
    where: eq(fcmToken.userId, userId),
  });
}

export async function getAllFcmTokens() {
  return db.query.fcmToken.findMany();
}

export async function createNotification(opts: {
  userId: string;
  title: string;
  body: string;
  imageUrl?: string;
  type?: NotificationType;
  eventType?: string;
  dedupeKey?: string;
  aggregateCount?: number;
  data?: Record<string, string>;
  archived?: boolean;
  webRoute?: string;
  mobileRoute?: string;
}) {
  const type = opts.type ?? "system";
  const [row] = await db
    .insert(notification)
    .values({
      userId: opts.userId,
      title: opts.title,
      body: opts.body,
      imageUrl: opts.imageUrl ?? null,
      type,
      eventType: opts.eventType ?? null,
      dedupeKey: opts.dedupeKey ?? null,
      aggregateCount: opts.aggregateCount ?? 1,
      data: opts.data ?? null,
      archived: opts.archived ?? false,
      webRoute: opts.webRoute ?? null,
      mobileRoute: opts.mobileRoute ?? null,
    })
    .returning();

  if (row && opts.userId) {
    emitToUser(opts.userId, row);
  }

  return row;
}

export async function createOrAggregateNotification(opts: {
  userId: string;
  title: string;
  body: string;
  imageUrl?: string;
  type?: NotificationType;
  eventType?: string;
  dedupeKey: string;
  data?: Record<string, string>;
  archived?: boolean;
  webRoute?: string;
  mobileRoute?: string;
  aggregateBody?: (aggregateCount: number) => string;
  aggregateTitle?: (aggregateCount: number) => string;
  aggregateCount?: number;
  incrementBy?: number;
  reuseAfterRead?: boolean;
}) {
  const type = opts.type ?? "system";
  const incrementBy = opts.incrementBy ?? 1;

  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${opts.userId}), hashtext(${opts.dedupeKey}))`,
    );

    const [existing] = await tx
      .select()
      .from(notification)
      .where(
        and(
          eq(notification.userId, opts.userId),
          eq(notification.dedupeKey, opts.dedupeKey),
          opts.reuseAfterRead ? undefined : eq(notification.isRead, false),
          eq(notification.archived, false),
        ),
      )
      .orderBy(
        sql`${notification.isRead} asc`,
        sql`${notification.updatedAt} desc`,
      )
      .limit(1)
      .for("update");

    if (existing) {
      const aggregateCount =
        opts.aggregateCount ?? existing.aggregateCount + incrementBy;
      const reopened = opts.reuseAfterRead === true && existing.isRead;
      const [row] = await tx
        .update(notification)
        .set({
          title: opts.aggregateTitle
            ? opts.aggregateTitle(aggregateCount)
            : opts.title,
          body: opts.aggregateBody
            ? opts.aggregateBody(aggregateCount)
            : opts.body,
          imageUrl: opts.imageUrl ?? existing.imageUrl,
          type,
          eventType: opts.eventType ?? existing.eventType,
          aggregateCount,
          data: opts.data ?? existing.data,
          archived: opts.archived ?? existing.archived,
          isRead: reopened ? false : existing.isRead,
          readAt: reopened ? null : existing.readAt,
          webRoute: opts.webRoute ?? existing.webRoute,
          mobileRoute: opts.mobileRoute ?? existing.mobileRoute,
          updatedAt: new Date(),
        })
        .where(eq(notification.id, existing.id))
        .returning();

      if (row) {
        emitToUser(opts.userId, row);
      }

      return { row, aggregated: true, reopened };
    }

    const [row] = await tx
      .insert(notification)
      .values({
        userId: opts.userId,
        title: opts.title,
        body: opts.body,
        imageUrl: opts.imageUrl ?? null,
        type,
        eventType: opts.eventType ?? null,
        dedupeKey: opts.dedupeKey,
        aggregateCount: opts.aggregateCount ?? incrementBy,
        data: opts.data ?? null,
        archived: opts.archived ?? false,
        webRoute: opts.webRoute ?? null,
        mobileRoute: opts.mobileRoute ?? null,
      })
      .returning();

    if (row) {
      emitToUser(opts.userId, row);
    }

    return { row, aggregated: false, reopened: false };
  });
}

export async function createNotificationsForAllUsers(opts: {
  title: string;
  body: string;
  imageUrl?: string;
  type?: NotificationType;
  data?: Record<string, string>;
  archived?: boolean;
  webRoute?: string;
  mobileRoute?: string;
}) {
  const type = opts.type ?? "system";
  const { user } = await import("../../db/schema/user");
  const users = await db.select({ id: user.id }).from(user);
  if (users.length === 0) return;

  const CHUNK = 500;
  for (let i = 0; i < users.length; i += CHUNK) {
    const rows = await db
      .insert(notification)
      .values(
        users.slice(i, i + CHUNK).map((u) => ({
          userId: u.id,
          title: opts.title,
          body: opts.body,
          imageUrl: opts.imageUrl ?? null,
          type,
          aggregateCount: 1,
          data: opts.data ?? null,
          archived: opts.archived ?? false,
          webRoute: opts.webRoute ?? null,
          mobileRoute: opts.mobileRoute ?? null,
        })),
      )
      .returning();

    for (const row of rows) {
      if (row.userId) {
        emitToUser(row.userId, row);
      }
    }
  }
}

export async function listNotificationsForUser(
  userId: string,
  query: ListNotificationsQuery,
) {
  const offset = (query.page - 1) * query.limit;

  // Ensure unreadOnly is properly handled as a boolean
  const unreadOnly = query.unreadOnly === true;

  const whereClause = and(
    eq(notification.userId, userId),
    unreadOnly ? eq(notification.isRead, false) : undefined,
    query.type ? eq(notification.type, query.type) : undefined,
    query.archived !== undefined
      ? eq(notification.archived, query.archived)
      : undefined,
  );

  const rows = await db
    .select()
    .from(notification)
    .where(whereClause)
    .orderBy(sql`${notification.updatedAt} desc`)
    .limit(query.limit)
    .offset(offset);

  const [{ value: total }] = await db
    .select({ value: count() })
    .from(notification)
    .where(whereClause);

  return { rows, total };
}

export async function markNotificationsRead(
  userId: string,
  notificationIds: string[],
) {
  if (notificationIds.length === 0) return;

  await db
    .update(notification)
    .set({ isRead: true, readAt: new Date() })
    .where(
      and(
        eq(notification.userId, userId),
        inArray(notification.id, notificationIds),
      ),
    );
}

export async function markAllNotificationsRead(
  userId: string,
  opts: { archived?: boolean; type?: string } = {},
) {
  const whereClause = and(
    eq(notification.userId, userId),
    opts.archived !== undefined
      ? eq(notification.archived, opts.archived)
      : undefined,
    opts.type ? eq(notification.type, opts.type) : undefined,
    eq(notification.isRead, false), // only unread
  );

  await db
    .update(notification)
    .set({ isRead: true, readAt: new Date() })
    .where(whereClause);
}

export async function countUnreadByTypeForUser(
  userId: string,
): Promise<Record<string, number>> {
  const rows = await db
    .select({
      type: notification.type,
      count: count(),
    })
    .from(notification)
    .where(and(eq(notification.userId, userId), eq(notification.isRead, false)))
    .groupBy(notification.type);

  const result: Record<string, number> = {};
  for (const row of rows) {
    result[row.type] = Number(row.count);
  }
  return result;
}
