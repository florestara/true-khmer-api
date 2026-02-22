import { validator } from "hono/validator";
import { validateCreateCategoryInput } from "./schema";

export const createCategoryValidator = validator("json", (value, c) => {
  const parsed = validateCreateCategoryInput(value);
  if (!parsed.ok) {
    return c.json(
      { ok: false, error: "Validation failed", issues: parsed.issues },
      400
    );
  }
  return parsed.data;
});
