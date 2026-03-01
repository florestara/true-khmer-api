import type { Context } from "hono";
import { getAuthUserId, type AuthPayload } from "../../../auth/types";
import { validateCreateCategoryInput, type CreateCategoryInput } from "./schema";
import { createCategory, findCategoryByName } from "./query";

export async function handleCreateCategory(c: Context) {
  const authPayload = c.get("auth") as AuthPayload | undefined;
  const userId = getAuthUserId(authPayload);
  if (!userId) {
    return c.json({ ok: false, error: "Unauthorized" }, 401);
  }

  const body = await c.req.json<unknown>().catch(() => undefined);
  const parsed = validateCreateCategoryInput(body);
  if (!parsed.ok) {
    return c.json(
      { ok: false, error: "Validation failed", issues: parsed.issues },
      400
    );
  }

  const data: CreateCategoryInput = {
    ...parsed.data,
    createdBy: userId,
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
    if (code === "23505") {
      return c.json({ ok: false, error: "Category already exists" }, 409);
    }
    console.error("Failed to create category", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}
