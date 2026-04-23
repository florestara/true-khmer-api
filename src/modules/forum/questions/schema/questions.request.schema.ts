import { z } from "zod";
import { FORUM_UUID_RE } from "../../lib/constants";

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; issues: string[] };

const MAX_TAGS_PER_QUESTION = 5;
const MAX_TAG_LENGTH = 30;
const MAX_BODY_LENGTH = 10000;
const MAX_QUESTIONS_PAGE_SIZE = 50;
const DEFAULT_QUESTIONS_PAGE_SIZE = 10;
const questionSortBySchema = z
  .enum([
    "mostRelevant",
    "newest",
    "oldest",
    "mostVoted",
    "mostAnswered",
  ])
  .openapi({
    description:
      "Question ordering. Allowed values: mostRelevant, newest, oldest, mostVoted, mostAnswered.",
    example: "newest",
  });
export type QuestionSortBy = z.infer<typeof questionSortBySchema>;

function normalizeTagText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

const questionTitleSchema = z
  .string()
  .trim()
  .min(1, "title is required and must be 1..300 characters")
  .max(300, "title is required and must be 1..300 characters");

const questionBodySchema = z
  .string()
  .trim()
  .min(1, "body is required and must be 1..10000 characters")
  .max(
    MAX_BODY_LENGTH,
    `body is required and must be 1..${MAX_BODY_LENGTH} characters`,
  );

const forumQuestionStatusSchema = z.enum(["PUBLISHED", "CLOSED", "DELETED"]);
export type ForumQuestionStatus = z.infer<typeof forumQuestionStatusSchema>;

const normalizedStatusSchema = z
  .string()
  .trim()
  .toUpperCase()
  .pipe(forumQuestionStatusSchema);

const rawTagsSchema = z
  .union([z.array(z.string()), z.string().trim()])
  .optional()
  .transform((value) => {
    if (value === undefined) {
      return [] as string[];
    }
    return typeof value === "string" ? value.split(",") : value;
  });

const tagsSchema = rawTagsSchema
  .transform((tags) => tags.map((tag) => normalizeTagText(tag)))
  .superRefine((tags, ctx) => {
    for (const tag of tags) {
      if (!tag) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "tag cannot be empty",
        });
      }

      if (tag.length > MAX_TAG_LENGTH) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `tag must be <= ${MAX_TAG_LENGTH} characters`,
        });
      }
    }
  })
  .transform((tags) =>
    Array.from(new Map(tags.map((tag) => [tag.toLowerCase(), tag])).values()),
  )
  .refine((tags) => tags.length <= MAX_TAGS_PER_QUESTION, {
    message: `a question can have at most ${MAX_TAGS_PER_QUESTION} tags`,
  });

const editTagsSchema = z
  .union([z.array(z.string()), z.string().trim()])
  .optional()
  .transform((value) => {
    if (value === undefined) {
      return undefined;
    }
    return typeof value === "string" ? value.split(",") : value;
  })
  .transform((tags) => {
    if (tags === undefined) {
      return undefined;
    }
    return tags.map((tag) => normalizeTagText(tag));
  })
  .superRefine((tags, ctx) => {
    if (tags === undefined) {
      return;
    }

    for (const tag of tags) {
      if (!tag) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "tag cannot be empty",
        });
      }

      if (tag.length > MAX_TAG_LENGTH) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `tag must be <= ${MAX_TAG_LENGTH} characters`,
        });
      }
    }
  })
  .transform((tags) => {
    if (tags === undefined) {
      return undefined;
    }

    return Array.from(
      new Map(tags.map((tag) => [tag.toLowerCase(), tag])).values(),
    );
  })
  .superRefine((tags, ctx) => {
    if (tags === undefined) {
      return;
    }

    if (tags.length > MAX_TAGS_PER_QUESTION) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `a question can have at most ${MAX_TAGS_PER_QUESTION} tags`,
      });
    }
  });

export const getQuestionParamsSchema = z
  .object({
    questionId: z
      .string()
      .trim()
      .regex(FORUM_UUID_RE, "questionId must be a valid UUID"),
  })
  .openapi("GetQuestionParams");

export type QuestionIdParams = z.infer<typeof getQuestionParamsSchema>;
export type GetQuestionParams = QuestionIdParams;

const cursorCreatedAtSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const normalized = normalizeQuestionsCursorTimestamp(value);
    if (!normalized) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "cursor.createdAt must be a valid ISO datetime",
      });
      return z.NEVER;
    }

    return normalized;
  });

function buildChronologicalQuestionsPageCursorSchema<
  TSortBy extends "newest" | "oldest",
>(sortBy: TSortBy) {
  return z.object({
    sortBy: z.literal(sortBy),
    createdAt: cursorCreatedAtSchema,
    id: z
      .string()
      .trim()
      .regex(FORUM_UUID_RE, "cursor.id must be a valid UUID"),
  });
}

const newestQuestionsPageCursorSchema =
  buildChronologicalQuestionsPageCursorSchema("newest");
const oldestQuestionsPageCursorSchema =
  buildChronologicalQuestionsPageCursorSchema("oldest");

const cursorLastActivityAtSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const normalized = normalizeQuestionsCursorTimestamp(value);
    if (!normalized) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "cursor.lastActivityAt must be a valid ISO datetime",
      });
      return z.NEVER;
    }

    return normalized;
  });

const trendingQuestionsPageCursorSchema = z.object({
  sortBy: z.literal("trending"),
  trendingScore: z.number(),
  engagementScore: z.number().int().nonnegative(),
  rankingTimestamp: cursorCreatedAtSchema,
  lastActivityAt: cursorLastActivityAtSchema,
  createdAt: cursorCreatedAtSchema,
  id: z.string().trim().regex(FORUM_UUID_RE, "cursor.id must be a valid UUID"),
});

const mostVotedQuestionsPageCursorSchema = z.object({
  sortBy: z.literal("mostVoted"),
  voteCount: z.number().int().nonnegative(),
  createdAt: cursorCreatedAtSchema,
  id: z.string().trim().regex(FORUM_UUID_RE, "cursor.id must be a valid UUID"),
});

const mostRelevantQuestionsPageCursorSchema = z.object({
  sortBy: z.literal("mostRelevant"),
  score: z.number().int(),
  answerCount: z.number().int().nonnegative(),
  createdAt: cursorCreatedAtSchema,
  id: z.string().trim().regex(FORUM_UUID_RE, "cursor.id must be a valid UUID"),
});

const mostAnsweredQuestionsPageCursorSchema = z.object({
  sortBy: z.literal("mostAnswered"),
  answerCount: z.number().int().nonnegative(),
  createdAt: cursorCreatedAtSchema,
  id: z.string().trim().regex(FORUM_UUID_RE, "cursor.id must be a valid UUID"),
});

const questionsPageCursorSchema = z.discriminatedUnion("sortBy", [
  trendingQuestionsPageCursorSchema,
  newestQuestionsPageCursorSchema,
  oldestQuestionsPageCursorSchema,
  mostRelevantQuestionsPageCursorSchema,
  mostVotedQuestionsPageCursorSchema,
  mostAnsweredQuestionsPageCursorSchema,
]);

export type QuestionsPageCursor = z.infer<typeof questionsPageCursorSchema>;

export function encodeQuestionsPageCursor(cursor: QuestionsPageCursor): string {
  const normalizedTimestamp = normalizeQuestionsCursorTimestamp(cursor.createdAt);
  if (!normalizedTimestamp) {
    throw new Error("Cannot encode question page cursor with invalid createdAt");
  }

  const normalizedLastActivityAt =
    cursor.sortBy === "trending"
      ? normalizeQuestionsCursorTimestamp(cursor.lastActivityAt)
      : null;
  const normalizedRankingTimestamp =
    cursor.sortBy === "trending"
      ? normalizeQuestionsCursorTimestamp(cursor.rankingTimestamp)
      : null;

  if (cursor.sortBy === "trending" && !normalizedLastActivityAt) {
    throw new Error(
      "Cannot encode question page cursor with invalid lastActivityAt",
    );
  }

  if (cursor.sortBy === "trending" && !normalizedRankingTimestamp) {
    throw new Error(
      "Cannot encode question page cursor with invalid rankingTimestamp",
    );
  }

  return Buffer.from(
    JSON.stringify(
      cursor.sortBy === "trending"
        ? {
            sortBy: cursor.sortBy,
            trendingScore: cursor.trendingScore,
            engagementScore: cursor.engagementScore,
            rankingTimestamp: normalizedRankingTimestamp,
            lastActivityAt: normalizedLastActivityAt,
            createdAt: normalizedTimestamp,
            id: cursor.id,
          }
        : cursor.sortBy === "mostRelevant"
          ? {
              sortBy: cursor.sortBy,
              score: cursor.score,
              answerCount: cursor.answerCount,
              createdAt: normalizedTimestamp,
              id: cursor.id,
            }
        : cursor.sortBy === "mostVoted"
          ? {
              sortBy: cursor.sortBy,
              voteCount: cursor.voteCount,
              createdAt: normalizedTimestamp,
              id: cursor.id,
            }
          : cursor.sortBy === "mostAnswered"
            ? {
                sortBy: cursor.sortBy,
                answerCount: cursor.answerCount,
                createdAt: normalizedTimestamp,
                id: cursor.id,
              }
            : {
                sortBy: cursor.sortBy,
                createdAt: normalizedTimestamp,
                id: cursor.id,
              },
    ),
    "utf8",
  ).toString("base64url");
}

function parseOptionalBooleanQueryParam(
  value: unknown,
): boolean | undefined | typeof z.NEVER {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalizedValue = value.trim().toLowerCase();
    if (normalizedValue === "true") {
      return true;
    }

    if (normalizedValue === "false") {
      return false;
    }
  }

  return z.NEVER;
}

const isUnansweredQuerySchema = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((value, ctx) => {
    const parsedValue = parseOptionalBooleanQueryParam(value);
    if (parsedValue !== z.NEVER) {
      return parsedValue ?? false;
    }

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "isUnanswered must be true or false",
    });

    return z.NEVER;
  })
  .openapi({
    description:
      "Filter questions without answers. Use true to return only unanswered questions.",
    example: true,
  });

const isTrendingQuerySchema = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((value, ctx) => {
    const parsedValue = parseOptionalBooleanQueryParam(value);
    if (parsedValue !== z.NEVER) {
      return parsedValue ?? false;
    }

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "isTrending must be true or false",
    });

    return z.NEVER;
  })
  .openapi({
    description:
      "Filter and rank questions by recent engagement trend score. When true, trending ranking takes precedence over sortBy.",
    example: true,
  });

function resolveQuestionsCursorSortKey(
  sortBy: QuestionSortBy,
  isTrending: boolean,
): QuestionsPageCursor["sortBy"] {
  return isTrending ? "trending" : sortBy;
}

export const getQuestionsQuerySchema = z
  .object({
    categoryId: z
      .string()
      .trim()
      .regex(FORUM_UUID_RE, "categoryId must be a valid UUID")
      .optional(),
    tagId: z
      .string()
      .trim()
      .regex(FORUM_UUID_RE, "tagId must be a valid UUID")
      .optional(),
    search: z
      .string()
      .trim()
      .max(300, "search must be <= 300 characters")
      .optional(),
    isUnanswered: isUnansweredQuerySchema,
    isTrending: isTrendingQuerySchema,
    limit: z.coerce
      .number()
      .int()
      .min(1, "limit must be between 1 and 50")
      .max(MAX_QUESTIONS_PAGE_SIZE, "limit must be between 1 and 50")
      .default(DEFAULT_QUESTIONS_PAGE_SIZE),
    sortBy: questionSortBySchema.default("newest"),
    cursor: z
      .string()
      .optional()
      .openapi({
        description:
          "Opaque pagination cursor returned by a previous questions list response.",
      }),
  })
  .superRefine((value, ctx) => {
    const decodedCursor = value.cursor
      ? decodeQuestionsPageCursor(value.cursor)
      : undefined;

    if (value.cursor && !decodedCursor) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "cursor must be a valid pagination cursor",
        path: ["cursor"],
      });
      return;
    }

    const expectedCursorSortKey = resolveQuestionsCursorSortKey(
      value.sortBy,
      value.isTrending,
    );

    if (decodedCursor && decodedCursor.sortBy !== expectedCursorSortKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "cursor sort does not match sortBy",
        path: ["cursor"],
      });
    }
  })
  .transform((value) => ({
    categoryId: value.categoryId,
    tagId: value.tagId,
    search: value.search,
    isUnanswered: value.isUnanswered,
    isTrending: value.isTrending,
    limit: value.limit,
    sortBy: value.sortBy,
    cursor: value.cursor
      ? (decodeQuestionsPageCursor(value.cursor) as QuestionsPageCursor)
      : undefined,
  }))
  .openapi("GetQuestionsQuery");

function decodeQuestionsPageCursor(raw: string): QuestionsPageCursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    const cursor = questionsPageCursorSchema.safeParse(parsed);
    return cursor.success ? cursor.data : null;
  } catch {
    return null;
  }
}

function normalizeQuestionsCursorTimestamp(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed
    .replace(" ", "T")
    .replace(/\.(\d{3})\d+(?=[+-Z])/, ".$1")
    .replace(/([+-]\d{2})$/, "$1:00");
  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

export type GetQuestionsQuery = z.infer<typeof getQuestionsQuerySchema>;

export const getTrendingTagsQuerySchema = z
  .object({
    categoryId: z
      .string()
      .trim()
      .regex(FORUM_UUID_RE, "categoryId must be a valid UUID")
      .optional(),
  })
  .transform((value) => ({
    categoryId: value.categoryId,
  }))
  .openapi("GetTrendingTagsQuery");

export type GetTrendingTagsQuery = z.infer<typeof getTrendingTagsQuerySchema>;

export const createQuestionSchema = z
  .object({
    categoryId: z
      .string()
      .trim()
      .regex(FORUM_UUID_RE, "categoryId is required and must be a valid UUID"),
    title: z
      .string()
      .trim()
      .min(1, "title is required and must be 1..300 characters")
      .max(300, "title is required and must be 1..300 characters"),
    body: z
      .string()
      .trim()
      .min(1, "body is required and must be 1..10000 characters")
      .max(
        MAX_BODY_LENGTH,
        `body is required and must be 1..${MAX_BODY_LENGTH} characters`,
      ),
    tags: tagsSchema,
    status: normalizedStatusSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.status && value.status !== "PUBLISHED") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "status can only be PUBLISHED when creating a question",
        path: ["status"],
      });
    }
  })
  .transform((value) => ({
    categoryId: value.categoryId,
    title: value.title,
    body: value.body,
    tags: value.tags,
    status: value.status,
  }))
  .openapi("CreateQuestionRequest");

export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;

export const editQuestionSchema = z
  .object({
    categoryId: z
      .string()
      .trim()
      .regex(FORUM_UUID_RE, "categoryId must be a valid UUID")
      .optional(),
    title: questionTitleSchema.optional(),
    body: questionBodySchema.optional(),
    tags: editTagsSchema,
    status: normalizedStatusSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.status && !["PUBLISHED", "CLOSED"].includes(value.status)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "status can only be PUBLISHED or CLOSED when editing a question",
        path: ["status"],
      });
    }
  })
  .transform((value) => ({
    categoryId: value.categoryId,
    title: value.title,
    body: value.body,
    tags: value.tags,
    status: value.status,
  }))
  .openapi("EditQuestionRequest");

export type EditQuestionInput = z.infer<typeof editQuestionSchema>;

const voteIntentSchema = z
  .enum(["UPVOTE", "DOWNVOTE", "NONE"])
  .openapi("VoteIntent");

export type VoteIntent = z.infer<typeof voteIntentSchema>;
export type QuestionVoteType = Exclude<VoteIntent, "NONE">;

const normalizedVoteIntentSchema = z
  .string()
  .trim()
  .toUpperCase()
  .pipe(voteIntentSchema);

export const voteQuestionSchema = z
  .object({
    voteType: normalizedVoteIntentSchema,
  })
  .transform((value) => ({
    voteType: value.voteType,
  }))
  .openapi("VoteQuestionRequest");

export type VoteQuestionInput = z.infer<typeof voteQuestionSchema>;

export function validateCreateQuestionInput(
  input: unknown,
): ValidationResult<CreateQuestionInput> {
  if (typeof input !== "object" || input === null) {
    return { ok: false, issues: ["Body must be a JSON object"] };
  }

  const parsed = createQuestionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => issue.message),
    };
  }

  return { ok: true, data: parsed.data };
}
