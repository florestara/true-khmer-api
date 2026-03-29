import { POSTGRES_UNIQUE_VIOLATION } from "../../../db/constants";
import {
  createVolunteerCategory,
  getVolunteerCategories,
} from "./post-volunteer.query";
import type { CreateVolunteerCategoryInput } from "./post-volunteer.schema";

const VOLUNTEER_CATEGORY_SLUG_UNIQUE_INDEX =
  "volunteer_category_slug_unique_idx";
const VOLUNTEER_CATEGORY_NAME_UNIQUE_INDEX =
  "volunteer_category_name_unique_idx";

export type GetVolunteerCategoriesResult =
  | {
      ok: true;
      categories: Awaited<ReturnType<typeof getVolunteerCategories>>;
    }
  | {
      ok: false;
      status: 500;
      error: "Internal server error";
    };

export type CreateVolunteerCategoryResult =
  | {
      ok: true;
      status: 201;
      category: Awaited<ReturnType<typeof createVolunteerCategory>>;
    }
  | {
      ok: false;
      status: 409 | 500;
      error:
        | "Category name already exists"
        | "Category slug already exists"
        | "Category already exists"
        | "Internal server error";
    };

export async function handleGetVolunteerCategories(): Promise<GetVolunteerCategoriesResult> {
  try {
    const categories = await getVolunteerCategories();
    return { ok: true, categories };
  } catch (err) {
    console.error("Failed to get volunteer categories", err);
    return { ok: false, status: 500, error: "Internal server error" };
  }
}

export async function handleCreateVolunteerCategory(
  data: CreateVolunteerCategoryInput,
) : Promise<CreateVolunteerCategoryResult> {
  try {
    const category = await createVolunteerCategory({
      ...data,
      createdBy: data.createdBy,
    });

    return { ok: true, status: 201, category };
  } catch (err) {
    const error = err as { code?: string; constraint?: string } | null;

    if (error?.code === POSTGRES_UNIQUE_VIOLATION) {
      if (error.constraint === VOLUNTEER_CATEGORY_NAME_UNIQUE_INDEX) {
        return { ok: false, status: 409, error: "Category name already exists" };
      }

      if (error.constraint === VOLUNTEER_CATEGORY_SLUG_UNIQUE_INDEX) {
        return { ok: false, status: 409, error: "Category slug already exists" };
      }

      return { ok: false, status: 409, error: "Category already exists" };
    }

    console.error("Failed to create volunteer category", err);
    return { ok: false, status: 500, error: "Internal server error" };
  }
}
