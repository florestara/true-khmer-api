import { z } from "@hono/zod-openapi";

export const recentActivitySchema = z
  .object({
    id: z.string(),
    userId: z.string(),
    type: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    targetType: z.string(),
    targetId: z.string(),
    referenceType: z.string(),
    referenceId: z.string(),
    data: z.record(z.string(), z.unknown()),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi("RecentActivity");

export const getRecentActivitiesResponseSchema = z
  .object({
    ok: z.literal(true),
    activities: z.array(recentActivitySchema),
  })
  .openapi("GetRecentActivitiesResponse");

export const recentActivityErrorResponseSchema = z
  .object({
    ok: z.literal(false),
    error: z.string(),
  })
  .openapi("RecentActivityErrorResponse");
