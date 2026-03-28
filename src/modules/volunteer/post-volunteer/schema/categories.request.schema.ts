import { z } from "zod";

export type VolunteerCategoryStatus = "ACTIVE" | "ARCHIVED" | "HIDDEN";

const VOLUNTEER_CATEGORY_ICON_KEY_RE = /^[A-Za-z][A-Za-z0-9-]*$/;
const VOLUNTEER_CATEGORY_ICON_KEY_MAX_LENGTH = 100;

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeSlug(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

const volunteerCategoryStatusSchema = z.enum(["ACTIVE", "ARCHIVED", "HIDDEN"]);

export const createVolunteerCategorySchema = z
  .object({
    name: z
      .string()
      .transform((value) => normalizeName(value))
      .pipe(
        z
          .string()
          .min(1, "name is required and must be 1..120 characters")
          .max(120, "name is required and must be 1..120 characters"),
      ),
    slug: z
      .string()
      .transform((value) => normalizeSlug(value))
      .pipe(
        z
          .string()
          .min(1, "slug is required and must be 1..255 characters")
          .max(255, "slug is required and must be 1..255 characters")
          .regex(
            /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
            "slug can only contain lowercase letters, numbers, and hyphens",
          ),
      ),
    description: z
      .string()
      .nullish()
      .transform((value) => {
        if (value === undefined || value === null) {
          return null;
        }

        const normalized = value.trim();
        return normalized.length > 0 ? normalized : null;
      })
      .refine(
        (value) => value === null || value.length <= 1000,
        "description must be <= 1000 characters",
      ),
    iconKey: z
      .string()
      .nullish()
      .transform((value) => {
        if (value === undefined || value === null) {
          return null;
        }

        const normalized = value.trim();
        return normalized.length > 0 ? normalized : null;
      })
      .refine(
        (value) =>
          value === null ||
          (VOLUNTEER_CATEGORY_ICON_KEY_RE.test(value) &&
            value.length <= VOLUNTEER_CATEGORY_ICON_KEY_MAX_LENGTH),
        "iconKey must start with a letter, be <= 100 characters, and contain only letters, numbers, or hyphens",
      ),
    status: volunteerCategoryStatusSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.status && value.status !== "ACTIVE") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "status can only be ACTIVE when creating a category",
        path: ["status"],
      });
    }
  })
  .transform((value) => ({
    name: value.name,
    slug: value.slug,
    description: value.description,
    iconKey: value.iconKey,
    status: value.status,
  }))
  .openapi("CreateVolunteerCategoryRequest");

export type CreateVolunteerCategoryBodyInput = z.infer<
  typeof createVolunteerCategorySchema
>;

export type CreateVolunteerCategoryInput = CreateVolunteerCategoryBodyInput & {
  createdBy: string;
};
