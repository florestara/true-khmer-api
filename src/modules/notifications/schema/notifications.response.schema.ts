import { z } from "zod";

export const notificationItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  body: z.string(),
  imageUrl: z.string().nullable().optional(),
  icon: z.string(),
  type: z.string(),
  eventType: z.string().nullable().optional(),
  dedupeKey: z.string().nullable().optional(),
  aggregateCount: z.number().int().positive().optional(),
  data: z.record(z.string(), z.string()).nullable(),
  isRead: z.boolean(),
  readAt: z.string().datetime().nullable(),
  archived: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
  webRoute: z.string().nullable().optional(),
  mobileRoute: z.string().nullable().optional(),
});

export const listNotificationsResponseSchema = z.object({
  ok: z.literal(true),
  notifications: z.array(notificationItemSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  unreadCounts: z.record(z.string(), z.number()),
});

export const tokenResponseSchema = z.object({
  ok: z.boolean(),
  message: z.string(),
  platform: z.enum(["web", "android", "ios"]).optional().default("web"),
});

export const sendResponseSchema = z.object({
  ok: z.boolean(),
  successCount: z.number(),
  failureCount: z.number(),
});

export const errorResponseSchema = z.object({
  ok: z.literal(false),
  error: z.string(),
});
