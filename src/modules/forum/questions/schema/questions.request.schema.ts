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
const questionSortBySchema = z.enum([
  "recent",
  "topRated",
  "unanswered",
  "myActivity",
]);
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

export const getQuestionParamsSchema = z.object({
  questionId: z
    .string()
    .trim()
    .regex(FORUM_UUID_RE, "questionId must be a valid UUID"),
}).openapi("GetQuestionParams");

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

const cursorActivityAtSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const normalized = normalizeQuestionsCursorTimestamp(value);
    if (!normalized) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "cursor.activityAt must be a valid ISO datetime",
      });
      return z.NEVER;
    }

    return normalized;
  });

function buildChronologicalQuestionsPageCursorSchema<
  TSortBy extends "recent" | "unanswered",
>(
  sortBy: TSortBy,
) {
  return z.object({
    sortBy: z.literal(sortBy),
    createdAt: cursorCreatedAtSchema,
    id: z
      .string()
      .trim()
      .regex(FORUM_UUID_RE, "cursor.id must be a valid UUID"),
  });
}

const recentQuestionsPageCursorSchema =
  buildChronologicalQuestionsPageCursorSchema("recent");
const unansweredQuestionsPageCursorSchema =
  buildChronologicalQuestionsPageCursorSchema("unanswered");

const myActivityQuestionsPageCursorSchema = z.object({
  sortBy: z.literal("myActivity"),
  activityAt: cursorActivityAtSchema,
  id: z.string().trim().regex(FORUM_UUID_RE, "cursor.id must be a valid UUID"),
});

const topRatedQuestionsPageCursorSchema = z.object({
  sortBy: z.literal("topRated"),
  score: z.number().int(),
  createdAt: cursorCreatedAtSchema,
  id: z.string().trim().regex(FORUM_UUID_RE, "cursor.id must be a valid UUID"),
});

const questionsPageCursorSchema = z.discriminatedUnion("sortBy", [
  recentQuestionsPageCursorSchema,
  unansweredQuestionsPageCursorSchema,
  myActivityQuestionsPageCursorSchema,
  topRatedQuestionsPageCursorSchema,
]);

export type QuestionsPageCursor = z.infer<typeof questionsPageCursorSchema>;

export function encodeQuestionsPageCursor(cursor: QuestionsPageCursor): string {
  const rawTimestamp =
    cursor.sortBy === "myActivity" ? cursor.activityAt : cursor.createdAt;
  const normalizedTimestamp = normalizeQuestionsCursorTimestamp(rawTimestamp);
  if (!normalizedTimestamp) {
    throw new Error(
      `Cannot encode question page cursor with invalid ${
        cursor.sortBy === "myActivity" ? "activityAt" : "createdAt"
      }`,
    );
  }

  return Buffer.from(
    JSON.stringify(
      cursor.sortBy === "topRated"
        ? {
            sortBy: cursor.sortBy,
            score: cursor.score,
            createdAt: normalizedTimestamp,
            id: cursor.id,
          }
        : cursor.sortBy === "myActivity"
        ? {
            sortBy: cursor.sortBy,
            activityAt: normalizedTimestamp,
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
    limit: z.coerce
      .number()
      .int()
      .min(1, "limit must be between 1 and 50")
      .max(MAX_QUESTIONS_PAGE_SIZE, "limit must be between 1 and 50")
      .default(DEFAULT_QUESTIONS_PAGE_SIZE),
    sortBy: z
      .string()
      .trim()
      .optional()
      .transform((value) => value ?? "recent")
      .pipe(questionSortBySchema),
    cursor: z
      .string()
      .optional()
      .transform((value, ctx) => {
        if (value === undefined) {
          return undefined;
        }

        const cursor = decodeQuestionsPageCursor(value);
        if (!cursor) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "cursor must be a valid pagination cursor",
          });
          return z.NEVER;
        }

        return cursor;
      }),
  })
  .superRefine((value, ctx) => {
    if (value.cursor && value.cursor.sortBy !== value.sortBy) {
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
    limit: value.limit,
    sortBy: value.sortBy,
    cursor: value.cursor,
  }))
  .openapi("GetQuestionsQuery");

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
