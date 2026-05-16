import { z } from "zod";

export const getMyApplicationsQuerySchema = z
  .object({
    type: z.enum(["all", "volunteer", "projects"]).default("all"),
    filter: z
      .enum(["all", "pending", "approved", "active", "completed", "archived"])
      .default("all"),
  })
  .openapi("GetMyApplicationsQuery");

export const myApplicationSourceParamSchema = z
  .enum(["volunteer", "projects"])
  .openapi("MyApplicationSourceParam");

export const myApplicationStatusActionSchema = z
  .enum(["confirm", "decline", "withdraw"])
  .openapi("MyApplicationStatusAction");

export const myApplicationArchiveActionSchema = z
  .enum(["archive", "unarchive"])
  .openapi("MyApplicationArchiveAction");

export const changeMyApplicationStatusParamSchema = z
  .object({
    sourceType: myApplicationSourceParamSchema,
    applicationId: z.string().uuid(),
    statusAction: myApplicationStatusActionSchema,
  })
  .openapi("ChangeMyApplicationStatusParam");

export const changeMyApplicationArchiveParamSchema = z
  .object({
    sourceType: myApplicationSourceParamSchema,
    applicationId: z.string().uuid(),
    archiveAction: myApplicationArchiveActionSchema,
  })
  .openapi("ChangeMyApplicationArchiveParam");

export const getMyApplicationDetailParamSchema = z
  .object({
    sourceType: myApplicationSourceParamSchema,
    applicationId: z.string().uuid(),
  })
  .openapi("GetMyApplicationDetailParam");

export type GetMyApplicationsQuery = z.infer<
  typeof getMyApplicationsQuerySchema
>;
export type GetMyApplicationDetailParam = z.infer<
  typeof getMyApplicationDetailParamSchema
>;
export type ChangeMyApplicationStatusParam = z.infer<
  typeof changeMyApplicationStatusParamSchema
>;
export type ChangeMyApplicationArchiveParam = z.infer<
  typeof changeMyApplicationArchiveParamSchema
>;
