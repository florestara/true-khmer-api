import { z } from "zod";

export const NAME_REGEX = new RegExp(
  "^[\\p{L}\\p{M}]+(?:[\\s'-][\\p{L}\\p{M}]+)*$",
  "u",
);
// ASCII control chars: 0x00-0x1F and DEL 0x7F.
const CONTROL_CHARS_RE = /[\x00-\x1F\x7F]/;

export type CleanNameOptions = {
  label?: string;
  minLength?: number;
  maxLength?: number;
};

function createCleanNameBaseSchema({
  label = "Name",
  minLength = 2,
  maxLength = 50,
}: CleanNameOptions = {}) {
  return z
    .string()
    .min(minLength, `${label} must be at least ${minLength} characters`)
    .max(maxLength, `${label} must not exceed ${maxLength} characters`)
    .regex(
      NAME_REGEX,
      `${label} can only contain letters, spaces, hyphens, and apostrophes.`,
    )
    .refine(
      (value) => value === value.trim(),
      `${label} cannot have leading or trailing spaces`,
    )
    .refine(
      (value) => !CONTROL_CHARS_RE.test(value),
      `${label} cannot contain control characters`,
    );
}

export function createCleanNameSchema(options: CleanNameOptions = {}) {
  return createCleanNameBaseSchema(options);
}

export function validateCleanName(
  name: string,
  ctx: z.RefinementCtx,
  options: CleanNameOptions = {},
) {
  const result = createCleanNameBaseSchema(options).safeParse(name);
  if (!result.success) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: result.error.issues[0]?.message ?? "Invalid name format",
    });
  }
}
