import { validator } from "hono/validator";
import type { ZodTypeAny } from "zod";

export const createJsonSchemaValidator = <TSchema extends ZodTypeAny>(schema: TSchema) =>
  validator("json", (value, c) => {
    const parsed = schema.safeParse(value);

    if (!parsed.success) {
      return c.json(
        {
          ok: false,
          error: "Validation failed",
          issues: parsed.error.issues.map((issue) => issue.message),
        },
        400,
      );
    }

    return parsed.data;
  });
