import type { Context } from "hono";
import { POSTGRES_UNIQUE_VIOLATION } from "../../../db/constants";
import { getAuthUserId } from "../../../modules/auth/utils/get-auth";
import {
  validateCreateCategoryInput,
  type CreateCategoryInput,
} from "./categories.schema";
import {
  createCategory,
  findCategoryByName,
  getCategories,
} from "./categories.query";
import { HonoContext } from "../../../lib/types";

export async function handleGetCategories(c: Context) {
  try {
    const categories = await getCategories();

    return c.json({ ok: true, categories }, 200);
  } catch (err) {
    console.error("Failed to get categories", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}

export async function handleCreateCategory(c: HonoContext) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) {
    return authResult.response;
  }

  const body = await c.req.json<unknown>().catch(() => undefined);
  const parsed = validateCreateCategoryInput(body);
  if (!parsed.ok) {
    return c.json(
      { ok: false, error: "Validation failed", issues: parsed.issues },
      400,
    );
  }

  const data: CreateCategoryInput = {
    ...parsed.data,
    createdBy: authResult.userId,
  };

  const existing = await findCategoryByName(data.name);
  if (existing) {
    return c.json({ ok: false, error: "Category name already exists" }, 409);
  }

  try {
    const newCategory = await createCategory(data);
    return c.json({ ok: true, category: newCategory }, 201);
  } catch (err) {
    const code = (err as { code?: string } | null)?.code;
    if (code === POSTGRES_UNIQUE_VIOLATION) {
      return c.json({ ok: false, error: "Category already exists" }, 409);
    }
    console.error("Failed to create category", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}
