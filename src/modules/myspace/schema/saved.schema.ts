import { z } from "zod";
import { FORUM_UUID_RE } from "../../forum/lib/constants";
import { questionResponseSchema } from "../../forum/questions/schema/questions.response.schema";
import { volunteerOpportunityListItemResponseSchema } from "../../volunteer/post-volunteer/schema/opportunities.response.schema";

const MAX_SAVED_ITEMS_PAGE_SIZE = 50;
const DEFAULT_SAVED_ITEMS_PAGE_SIZE = 20;

export const savedItemTypeSchema = z.enum(["project", "volunteer", "forum"]);
export const savedItemsFilterSchema = z
  .enum(["all", "project", "volunteer", "forum"])
  .default("all");

export type SavedItemType = z.infer<typeof savedItemTypeSchema>;

export type SavedItemsPageCursor = {
  savedAt: string;
  type: SavedItemType;
  id: string;
};

const savedItemsPageCursorSchema = z.object({
  savedAt: z.string().datetime({ offset: true }),
  type: savedItemTypeSchema,
  id: z.string().regex(FORUM_UUID_RE),
});

function normalizeSavedItemsCursorTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

export function encodeSavedItemsPageCursor(
  cursor: SavedItemsPageCursor,
): string {
  const savedAt = normalizeSavedItemsCursorTimestamp(cursor.savedAt);
  if (!savedAt) {
    throw new Error("Cannot encode saved items page cursor with invalid savedAt");
  }

  return Buffer.from(
    JSON.stringify({
      savedAt,
      type: cursor.type,
      id: cursor.id,
    }),
    "utf8",
  ).toString("base64url");
}

function decodeSavedItemsPageCursor(raw: string): SavedItemsPageCursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    const cursor = savedItemsPageCursorSchema.safeParse(parsed);
    return cursor.success ? cursor.data : null;
  } catch {
    return null;
  }
}

export const getSavedItemsQuerySchema = z
  .object({
    filter: savedItemsFilterSchema.openapi({
      description:
        "Saved item filter. Use all for projects, volunteer opportunities, and forum questions.",
    }),
    limit: z.coerce
      .number()
      .int()
      .min(1, "limit must be between 1 and 50")
      .max(MAX_SAVED_ITEMS_PAGE_SIZE, "limit must be between 1 and 50")
      .default(DEFAULT_SAVED_ITEMS_PAGE_SIZE),
    cursor: z.string().optional().openapi({
      description: "Opaque pagination cursor returned by a previous response.",
    }),
  })
  .superRefine((value, ctx) => {
    const cursor = value.cursor
      ? decodeSavedItemsPageCursor(value.cursor)
      : undefined;

    if (value.cursor && !cursor) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "cursor must be a valid pagination cursor",
        path: ["cursor"],
      });
      return;
    }

    if (cursor && value.filter !== "all" && cursor.type !== value.filter) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "cursor type must match filter",
        path: ["cursor"],
      });
    }
  })
  .transform((value) => ({
    filter: value.filter,
    limit: value.limit,
    cursor: value.cursor
      ? (decodeSavedItemsPageCursor(value.cursor) as SavedItemsPageCursor)
      : undefined,
  }))
  .openapi("GetSavedItemsQuery");

const savedProjectItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  deadline: z.string().datetime({ offset: true }).nullable(),
  status: z.enum(["DRAFT", "LIVE", "IN_PROGRESS", "COMPLETED", "CANCELED"]),
  logoKey: z.string().nullable(),
  coverKey: z.string().nullable(),
  documentKeys: z.array(z.string()),
  documentNames: z.array(z.string()),
  phoneNumber: z.string().nullable(),
  email: z.string().nullable(),
  telegramUsername: z.string().nullable(),
  createdBy: z.object({
    id: z.string(),
    name: z.string(),
    avatarKey: z.string().nullable(),
    launchpadCount: z.number(),
  }),
  createdAt: z.string().datetime({ offset: true }),
  category: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .optional(),
  city: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .optional(),
  totalRoles: z.number(),
  totalView: z.number(),
  isSaved: z.literal(true),
  savedAt: z.string().datetime({ offset: true }),
});

const savedPaginationSchema = z.object({
  limit: z.number(),
  hasMore: z.boolean(),
  nextCursor: z.string().nullable(),
  total: z.number().int().nonnegative(),
});

const savedCountsSchema = z.object({
  all: z.number().int().nonnegative(),
  project: z.number().int().nonnegative(),
  volunteer: z.number().int().nonnegative(),
  forum: z.number().int().nonnegative(),
});

export const getSavedItemsResponseSchema = z
  .object({
    ok: z.literal(true),
    items: z.array(
      z.discriminatedUnion("type", [
        z.object({
          type: z.literal("project"),
          savedAt: z.string().datetime({ offset: true }),
          item: savedProjectItemSchema,
        }),
        z.object({
          type: z.literal("volunteer"),
          savedAt: z.string().datetime({ offset: true }),
          item: volunteerOpportunityListItemResponseSchema,
        }),
        z.object({
          type: z.literal("forum"),
          savedAt: z.string().datetime({ offset: true }),
          item: questionResponseSchema,
        }),
      ]),
    ),
    pagination: savedPaginationSchema,
    counts: savedCountsSchema,
  })
  .openapi("GetSavedItemsResponse");

export const savedItemsErrorResponseSchema = z
  .object({
    ok: z.literal(false),
    error: z.string(),
  })
  .openapi("SavedItemsErrorResponse");

export type GetSavedItemsQuery = z.infer<typeof getSavedItemsQuerySchema>;
