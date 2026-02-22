import type { Context } from "hono";
import { validateCreateCategoryInput } from "./schema";
import { createCategory, findCategoryById, findCategoryByParentAndName } from "./query";

export async function handleCreateCategory(c: Context) {
  const body = await c.req.json<unknown>().catch(() => undefined);
  const parsed = validateCreateCategoryInput(body);
  if (!parsed.ok) {
    return c.json(
      { ok: false, error: "Validation failed", issues: parsed.issues },
      400
    );
  }

  const data = parsed.data;

  if (data.parentId) {
    const parent = await findCategoryById(data.parentId);
    if (!parent) {
      return c.json({ ok: false, error: "Parent category not found" }, 404);
    }
    if (parent.status === "ARCHIVED") {
      return c.json({ ok: false, error: "Parent category is archived" }, 409);
    }
  }

  const existing = await findCategoryByParentAndName(data.parentId ?? null, data.name);
  if (existing) {
    return c.json({ ok: false, error: "Category name already exists" }, 409);
  }

  try {
    const newCategory = await createCategory(data);
    return c.json({ ok: true, category: newCategory }, 201);
  } catch (err) {
    const code = (err as { code?: string } | null)?.code;
    if (code === "23505") {
      return c.json({ ok: false, error: "Category already exists" }, 409);
    }
    console.error("Failed to create category", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}
