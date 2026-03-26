import "dotenv/config";
import { z } from "zod";

const plainEmailSchema = z.string().email();
const resendFromHeaderSchema = z
  .string()
  .regex(/^[^<>\r\n]+<\s*[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+\s*>$/, "Invalid email");

const emptyStringToUndefined = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
};

const envSchema = z.object({
  APP_NAME: z.string().default("True Khmer"),
  APP_DOMAIN: z.preprocess(
    emptyStringToUndefined,
    z.string().url().optional(),
  ),
  PORT: z.coerce.number().int().positive().default(3000),
  DEFAULT_BASE_URL: z.preprocess(
    emptyStringToUndefined,
    z.string().url().optional(),
  ),
  DATABASE_URL: z.preprocess(
    emptyStringToUndefined,
    z.string().min(1, "DATABASE_URL is required"),
  ),
  JWT_EXPIRATION: z.string().default("15m"),
  BETTER_AUTH_URL: z.preprocess(
    emptyStringToUndefined,
    z.string().url().optional(),
  ),
  BETTER_AUTH_SECRET: z.preprocess(
    emptyStringToUndefined,
    z.string().min(1).optional(),
  ),
  RESEND_API_KEY: z.preprocess(
    emptyStringToUndefined,
    z.string().min(1).optional(),
  ),
  RESEND_FROM_EMAIL: z.preprocess(
    emptyStringToUndefined,
    z
      .string()
      .trim()
      .refine(
        (value) =>
          plainEmailSchema.safeParse(value).success ||
          resendFromHeaderSchema.safeParse(value).success,
        "Invalid email",
      )
      .optional(),
  ),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
    .join("; ");

  throw new Error(`Invalid environment configuration: ${issues}`);
}

export const env = parsed.data;
