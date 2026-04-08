import { z } from "zod";
import { FORUM_UUID_RE } from "../../lib/constants";

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; issues: string[] };

const MAX_BODY_LENGTH = 10000;

export const createReportingSchema = z
  .object({
    questionId: z
      .string()
      .trim()
      .transform((val) => (val === "" ? undefined : val))
      .pipe(
        z
          .string()
          .regex(FORUM_UUID_RE, "questionId must be a valid UUID")
          .optional(),
      ),
    answerId: z
      .string()
      .trim()
      .transform((val) => (val === "" ? undefined : val))
      .pipe(
        z
          .string()
          .regex(FORUM_UUID_RE, "answerId must be a valid UUID")
          .optional(),
      ),
    typeId: z
      .string()
      .trim()
      .regex(FORUM_UUID_RE, "typeId is required and must be a valid UUID"),
    description: z
      .string()
      .max(
        MAX_BODY_LENGTH,
        `body must be not more than ${MAX_BODY_LENGTH} characters`,
      )
      .optional(),
  })
  .superRefine((data, ctx) => {
    const hasQuestion = !!data.questionId;
    const hasAnswer = !!data.answerId;

    if (!hasQuestion && !hasAnswer) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Either questionId or answerId must be provided",
      });
    }

    if (hasQuestion && hasAnswer) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Only one of questionId or answerId can be provided, not both",
      });
    }
  })
  .transform((data) => ({
    questionId: data.questionId,
    answerId: data.answerId,
    typeId: data.typeId,
    description: data.description,
  }))
  .openapi("CreateReportingRequest");

export type CreateReportingInput = z.infer<typeof createReportingSchema>;

export function validateCreateReportingInput(
  input: unknown,
): ValidationResult<CreateReportingInput> {
  if (typeof input !== "object" || input === null) {
    return { ok: false, issues: ["Body must be a JSON object"] };
  }

  const parsed = createReportingSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => issue.message),
    };
  }

  return { ok: true, data: parsed.data };
}
