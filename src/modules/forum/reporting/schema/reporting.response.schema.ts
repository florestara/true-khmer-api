import { z } from "zod";

export const createReportingResponseSchema = z
  .object({
    ok: z.boolean(),
    reportingId: z.string().uuid(),
  })
  .openapi("CreateReportingResponse");
