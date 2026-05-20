import { z } from "zod";

export const fcmPlatformEnum = z.enum(["web", "android", "ios"]);
export type FcmTokenPlatform = z.infer<typeof fcmPlatformEnum>;

export const registerTokenSchema = z.object({
  token: z.string().min(1, "FCM token is required"),
  platform: fcmPlatformEnum.default("web"),
});
export type RegisterTokenPayload = z.infer<typeof registerTokenSchema>;

export const unregisterTokenSchema = z.object({
  token: z.string().min(1, "FCM token is required"),
});
export type UnregisterTokenPayload = z.infer<typeof unregisterTokenSchema>;

export const sendToUserSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
  title: z.string().min(1),
  body: z.string().min(1),
  data: z.record(z.string(), z.string()).optional(),
  imageUrl: z.string().optional(),
});
export type SendToUserPayload = z.infer<typeof sendToUserSchema>;

export const broadcastSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  data: z.record(z.string(), z.string()).optional(),
  imageUrl: z.string().optional(),
});
export type BroadcastPayload = z.infer<typeof broadcastSchema>;

export const listNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  unreadOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});
export type ListNotificationsQuery = z.infer<
  typeof listNotificationsQuerySchema
>;

export const notificationItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  body: z.string(),
  imageUrl: z.string().nullable().optional(),
  data: z.record(z.string(), z.string()).nullable(),
  isRead: z.boolean(),
  readAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export const listNotificationsResponseSchema = z.object({
  ok: z.literal(true),
  notifications: z.array(notificationItemSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
});

export const markReadSchema = z.object({
  notificationIds: z.array(z.string().uuid()).min(1),
});
export type MarkReadPayload = z.infer<typeof markReadSchema>;

export const tokenResponseSchema = z.object({
  ok: z.boolean(),
  message: z.string(),
  platform: fcmPlatformEnum.default("web"),
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
