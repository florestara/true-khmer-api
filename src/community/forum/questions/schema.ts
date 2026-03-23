import { z } from "zod";
import { FORUM_UUID_RE } from "../constants";

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; issues: string[] };

const MAX_TAGS_PER_QUESTION = 5;
const MAX_TAG_LENGTH = 30;
const MAX_BODY_LENGTH = 10000;
const MAX_QUESTIONS_PAGE_SIZE = 50;
const DEFAULT_QUESTIONS_PAGE_SIZE = 10;

function normalizeTagText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

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

export const getQuestionParamsSchema = z.object({
  questionId: z
    .string()
    .trim()
    .regex(FORUM_UUID_RE, "questionId must be a valid UUID"),
});

export type GetQuestionParams = z.infer<typeof getQuestionParamsSchema>;

const questionsPageCursorSchema = z.object({
  createdAt: z
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
    }),
  id: z.string().trim().regex(FORUM_UUID_RE, "cursor.id must be a valid UUID"),
});

export type QuestionsPageCursor = z.infer<typeof questionsPageCursorSchema>;

export function encodeQuestionsPageCursor(cursor: QuestionsPageCursor): string {
  const normalizedCreatedAt = normalizeQuestionsCursorTimestamp(
    cursor.createdAt,
  );
  if (!normalizedCreatedAt) {
    throw new Error(
      "Cannot encode question page cursor with invalid createdAt",
    );
  }

  return Buffer.from(
    JSON.stringify({
      createdAt: normalizedCreatedAt,
      id: cursor.id,
    }),
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
    limit: z.coerce
      .number()
      .int()
      .min(1, "limit must be between 1 and 50")
      .max(MAX_QUESTIONS_PAGE_SIZE, "limit must be between 1 and 50")
      .default(DEFAULT_QUESTIONS_PAGE_SIZE),
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
  .transform((value) => ({
    categoryId: value.categoryId,
    limit: value.limit,
    cursor: value.cursor,
  }));

export type GetQuestionsQuery = z.infer<typeof getQuestionsQuerySchema>;

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
  }));

export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;

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
