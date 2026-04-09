import { z } from "zod";

export const getReportingTypesResponseSchema = z
  .object({
    ok: z.boolean(),
    reportingTypes: z.array(
      z
        .object({
          id: z.string(),
          type: z.string(),
        })
        .openapi("ReportingTypeResponse"),
    ),
  })
  .openapi("GetReportingTypesResponse");
