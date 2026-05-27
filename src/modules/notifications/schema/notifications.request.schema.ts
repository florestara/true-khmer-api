import { z } from "zod";

export const fcmPlatformEnum = z.enum(["web", "android", "ios"]);
export type FcmTokenPlatform = z.infer<typeof fcmPlatformEnum>;

export const notificationTypeEnum = z.enum([
  "forum", // MessageCircle
  "profile_view", // User
  "new_message", // MessageSquare
  "achievement", // Trophy
  "event_reminder", // Clock
  "application", // Briefcase
  "launchpad_update", // Zap
  "points", // Star
  "system", // Bell
]);
export type NotificationType = z.infer<typeof notificationTypeEnum>;

export const NOTIFICATION_ICON_MAP: Record<NotificationType, string> = {
  forum: "MessageCircle",
  profile_view: "User",
  new_message: "MessageSquare",
  achievement: "Trophy",
  event_reminder: "Clock",
  application: "Briefcase",
  launchpad_update: "Zap",
  points: "Star",
  system: "Bell",
};

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
  type: notificationTypeEnum.default("system"),
  archived: z.boolean().optional(),
  webRoute: z.string().optional(),
  mobileRoute: z.string().optional(),
});
export type SendToUserPayload = z.infer<typeof sendToUserSchema>;

export const broadcastSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  data: z.record(z.string(), z.string()).optional(),
  imageUrl: z.string().optional(),
  type: notificationTypeEnum.default("system"),
  archived: z.boolean().optional(),
  webRoute: z.string().optional(),
  mobileRoute: z.string().optional(),
});
export type BroadcastPayload = z.infer<typeof broadcastSchema>;

export const listNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  unreadOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "false"),
  type: notificationTypeEnum.optional(),
  archived: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "false"),
});
export type ListNotificationsQuery = z.infer<
  typeof listNotificationsQuerySchema
>;

export const markReadSchema = z.object({
  notificationIds: z.array(z.string().uuid()).min(1),
});
export type MarkReadPayload = z.infer<typeof markReadSchema>;

export const markAllReadQuerySchema = z.object({
  archived: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "false"),
  type: notificationTypeEnum.optional(),
});
export type MarkAllReadQuery = z.infer<typeof markAllReadQuerySchema>;
