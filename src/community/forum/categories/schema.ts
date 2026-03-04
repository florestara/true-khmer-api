export type ForumCategoryStatus = "ACTIVE" | "ARCHIVED" | "HIDDEN";

export type CreateCategoryBodyInput = {
  name: string;
  slug: string;
  description?: string | null;
};

export type CreateCategoryInput = CreateCategoryBodyInput & {
  createdBy: string;
};

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; issues: string[] };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function validateCreateCategoryInput(
  input: unknown
): ValidationResult<CreateCategoryBodyInput> {
  if (!isObject(input)) {
    return { ok: false, issues: ["Body must be a JSON object"] };
  }

  const issues: string[] = [];
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const slug = typeof input.slug === "string" ? input.slug.trim() : "";

  if (!name || name.length > 120) {
    issues.push("name is required and must be 1..120 characters");
  }

  if (!slug || slug.length > 255) {
    issues.push("slug is required and must be 1..255 characters");
  }

  const description =
    input.description === undefined || input.description === null
      ? null
      : typeof input.description === "string" && input.description.trim().length <= 1000
        ? input.description.trim()
        : undefined;
  if (input.description !== undefined && description === undefined) {
    issues.push("description must be <= 1000 characters");
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    data: {
      name,
      slug,
      description,
    },
  };
}
