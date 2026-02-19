export type ForumCategoryStatus = "ACTIVE" | "ARCHIVED" | "HIDDEN";

export type CreateCategoryInput = {
  parentId?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  displayOrder?: number;
  status?: ForumCategoryStatus;
  createdBy: string;
  type?: "CATEGORY" | "SUBCATEGORY";
};

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; issues: string[] };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toStatus(value: unknown): ForumCategoryStatus | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toUpperCase();
  if (normalized === "ACTIVE" || normalized === "ARCHIVED" || normalized === "HIDDEN") {
    return normalized;
  }
  return undefined;
}

export function validateCreateCategoryInput(
  input: unknown
): ValidationResult<CreateCategoryInput> {
  if (!isObject(input)) {
    return { ok: false, issues: ["Body must be a JSON object"] };
  }

  const issues: string[] = [];
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const slug = typeof input.slug === "string" ? input.slug.trim() : "";
  const createdBy = typeof input.createdBy === "string" ? input.createdBy.trim() : "";

  if (!name || name.length > 120) {
    issues.push("name is required and must be 1..120 characters");
  }

  if (!slug || slug.length > 255) {
    issues.push("slug is required and must be 1..255 characters");
  }

  if (!createdBy || !UUID_RE.test(createdBy)) {
    issues.push("createdBy is required and must be a valid UUID");
  }

  const parentId =
    input.parentId === undefined || input.parentId === null
      ? null
      : typeof input.parentId === "string" && UUID_RE.test(input.parentId)
        ? input.parentId
        : undefined;
  if (input.parentId !== undefined && parentId === undefined) {
    issues.push("parentId must be a valid UUID or null");
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

  const icon =
    input.icon === undefined || input.icon === null
      ? null
      : typeof input.icon === "string" && input.icon.trim().length <= 255
        ? input.icon.trim()
        : undefined;
  if (input.icon !== undefined && icon === undefined) {
    issues.push("icon must be <= 255 characters");
  }

  const color =
    input.color === undefined || input.color === null
      ? null
      : typeof input.color === "string" && input.color.trim().length <= 30
        ? input.color.trim()
        : undefined;
  if (input.color !== undefined && color === undefined) {
    issues.push("color must be <= 30 characters");
  }

  const rawDisplayOrder =
    input.displayOrder !== undefined ? input.displayOrder : input.sortOrder;
  const displayOrder =
    rawDisplayOrder === undefined
      ? undefined
      : typeof rawDisplayOrder === "number" &&
          Number.isInteger(rawDisplayOrder) &&
          rawDisplayOrder >= 0
        ? rawDisplayOrder
        : undefined;
  if (rawDisplayOrder !== undefined && displayOrder === undefined) {
    issues.push("displayOrder/sortOrder must be a non-negative integer");
  }

  const status =
    input.status === undefined ? undefined : toStatus(input.status);
  if (input.status !== undefined && status === undefined) {
    issues.push("status must be one of ACTIVE, ARCHIVED, HIDDEN");
  }

  const type =
    input.type === undefined
      ? undefined
      : input.type === "CATEGORY" || input.type === "SUBCATEGORY"
        ? input.type
        : undefined;
  if (input.type !== undefined && type === undefined) {
    issues.push("type must be one of CATEGORY, SUBCATEGORY");
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    data: {
      parentId,
      name,
      slug,
      description,
      icon,
      color,
      displayOrder,
      status,
      createdBy,
      type,
    },
  };
}
