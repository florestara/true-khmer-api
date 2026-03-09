import { z } from "zod";

export const PASSWORD_NO_WHITESPACE_RE = /^\S+$/;
export const PASSWORD_LOWERCASE_RE = /[a-z]/;
export const PASSWORD_UPPERCASE_RE = /[A-Z]/;
export const PASSWORD_SPECIAL_RE = /[^A-Za-z0-9\s]/;

type StrongPasswordOptions = {
  label?: string;
  minLength?: number;
};

function createStrongPasswordBaseSchema({
  label = "password",
  minLength = 8,
}: StrongPasswordOptions = {}) {
  return z
    .string()
    .regex(PASSWORD_NO_WHITESPACE_RE, `${label} must not contain whitespace`)
    .min(minLength, `${label} must be at least ${minLength} characters`)
    .regex(
      PASSWORD_LOWERCASE_RE,
      `${label} must contain at least one lowercase letter`,
    )
    .regex(
      PASSWORD_UPPERCASE_RE,
      `${label} must contain at least one uppercase letter`,
    )
    .regex(
      PASSWORD_SPECIAL_RE,
      `${label} must contain at least one special character`,
    );
}

export function createStrongPasswordSchema(
  options: StrongPasswordOptions = {},
) {
  return createStrongPasswordBaseSchema(options);
}

export function validateStrongPassword(
  password: string,
  ctx: z.RefinementCtx,
  options: StrongPasswordOptions = {},
) {
  const result = createStrongPasswordBaseSchema(options).safeParse(password);
  if (!result.success) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: result.error.issues[0]?.message ?? "Invalid password format",
    });
  }
}
