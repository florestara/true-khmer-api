import { validator } from "hono/validator";
import {
  createQuestionSchema,
  getQuestionParamsSchema,
  getQuestionsQuerySchema,
} from "./schema";

export const createQuestionValidator = validator("json", (value, c) => {
  const parsed = createQuestionSchema.safeParse(value);

  if (!parsed.success) {
    return c.json(
      {
        ok: false,
        error: "Validation failed",
        issues: parsed.error.issues.map((issue) => issue.message),
      },
      400
    );
  }

  return parsed.data;
});

export const getQuestionParamsValidator = validator("param", (value, c) => {
  const parsed = getQuestionParamsSchema.safeParse(value);

  if (!parsed.success) {
    return c.json(
      {
        ok: false,
        error: "Validation failed",
        issues: parsed.error.issues.map((issue) => issue.message),
      },
      400
    );
  }

  return parsed.data;
});

export const getQuestionsQueryValidator = validator("query", (value, c) => {
  const parsed = getQuestionsQuerySchema.safeParse(value);

  if (!parsed.success) {
    return c.json(
      {
        ok: false,
        error: "Validation failed",
        issues: parsed.error.issues.map((issue) => issue.message),
      },
      400
    );
  }

  return parsed.data;
});
