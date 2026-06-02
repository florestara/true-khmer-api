import { z } from "zod";
import { questionResponseSchema } from "../../forum/questions/schema/questions.response.schema";
import {
  volunteerOpportunitiesPaginationResponseSchema,
  volunteerOpportunityListItemResponseSchema,
} from "../../volunteer/post-volunteer/schema/opportunities.response.schema";
import { launchpadListItemSchema } from "../../launchpad/schema/launchpad.response.schema";

const cursorPaginationSchema = z.object({
  limit: z.number(),
  hasMore: z.boolean(),
  nextCursor: z.string().nullable(),
  total: z.number().int().nonnegative(),
});

export const getMyPostedResponseSchema = z
  .discriminatedUnion("sourceType", [
    z.object({
      ok: z.literal(true),
      sourceType: z.literal("forum"),
      questions: z.array(questionResponseSchema),
      pagination: cursorPaginationSchema,
    }),
    z.object({
      ok: z.literal(true),
      sourceType: z.literal("volunteer"),
      opportunities: z.array(volunteerOpportunityListItemResponseSchema),
      pagination: volunteerOpportunitiesPaginationResponseSchema,
    }),
    z.object({
      ok: z.literal(true),
      sourceType: z.literal("project"),
      launchpads: z.array(launchpadListItemSchema),
      nextCursor: z.string().nullable(),
    }),
  ])
  .openapi("GetMyPostedResponse");

export const myPostedErrorResponseSchema = z
  .object({
    ok: z.literal(false),
    error: z.string(),
  })
  .openapi("MyPostedErrorResponse");
