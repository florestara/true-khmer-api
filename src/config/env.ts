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

const envSchema = z
  .object({
    APP_NAME: z.string().default("True Khmer"),
    APP_DOMAIN: z.preprocess(emptyStringToUndefined, z.string().url()),
    PORT: z.coerce.number().int().positive().default(3000),
    FORUM_MIN_TRENDING_TAG_COUNT: z.coerce
      .number()
      .int()
      .positive()
      .default(10),
    FORUM_MAX_TRENDING_TAG_AMOUNT: z.coerce
      .number()
      .int()
      .positive()
      .default(10),
    FORUM_TRENDING_WINDOW_HOURS: z.coerce.number().int().positive().default(48),
    DEFAULT_BASE_URL: z.preprocess(
      emptyStringToUndefined,
      z.string().url().optional(),
    ),
    DATABASE_URL: z.preprocess(
      emptyStringToUndefined,
      z.string().min(1, "DATABASE_URL is required"),
    ),
    VOLUNTEER_COUNTRY_NORMALIZED_NAME: z.preprocess(
      emptyStringToUndefined,
      z.string().trim().toLowerCase().min(1).default("cambodia"),
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
    FIREBASE_PROJECT_ID: z.preprocess(
      emptyStringToUndefined,
      z.string().min(1).optional(),
    ),
    FIREBASE_CLIENT_EMAIL: z.preprocess(
      emptyStringToUndefined,
      z.string().email().optional(),
    ),
    FIREBASE_PRIVATE_KEY: z.preprocess(
      emptyStringToUndefined,
      z.string().min(1).optional(),
    ),
  })
  .superRefine((data, ctx) => {
    const firebaseKeys = [
      "FIREBASE_PROJECT_ID",
      "FIREBASE_CLIENT_EMAIL",
      "FIREBASE_PRIVATE_KEY",
    ] as const;

    const present = firebaseKeys.filter(
      (key) => data[key] !== undefined && data[key] !== "",
    );
    const absent = firebaseKeys.filter(
      (key) => data[key] === undefined || data[key] === "",
    );

    if (present.length > 0 && absent.length > 0) {
      for (const key of absent) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: "Required with other Firebase credentials",
        });
      }
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
    .join("; ");

  throw new Error(`Invalid environment configuration: ${issues}`);
}

export const env = parsed.data;
