import type { Context } from "hono";
import { z } from "zod";
import type { ZodTypeAny } from "zod";
import { validator } from "hono/validator";
import {
  answerIdParamsSchema,
  createAnswerSchema,
  questionIdParamsSchema,
  updateAnswerSchema,
  voteAnswerSchema,
} from "./schema";

type FieldErrors = Record<string, string>;
type ValidationFailure = {
  ok: false;
  message: string;
  fieldErrors?: FieldErrors;
};
type ValidationSuccess<T> = { ok: true; data: T };
type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

function parseWithSchema<TSchema extends ZodTypeAny>(
  schema: TSchema,
  input: unknown,
): ValidationResult<z.infer<TSchema>> {
  if (typeof input !== "object" || input === null) {
    return { ok: false, message: "Invalid input" };
  }

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: FieldErrors = {};

    for (const issue of parsed.error.issues) {
      const path =
        issue.path.length > 0
          ? issue.path.map((segment) => String(segment)).join(".")
          : "body";
      const isMissingField =
        issue.code === "invalid_type" &&
        "received" in issue &&
        issue.received === "undefined" &&
        issue.path.length > 0;
      const message = isMissingField ? `${path} is required` : issue.message;

      if (!fieldErrors[path]) {
        fieldErrors[path] = message;
      }
    }

    const firstField = Object.keys(fieldErrors).sort((a, b) => a.localeCompare(b))[0];

    return {
      ok: false,
      message: firstField ? fieldErrors[firstField] : "Validation failed",
      fieldErrors,
    };
  }

  return { ok: true, data: parsed.data };
}

function buildValidationErrorResponse(c: Context, payload: ValidationFailure) {
  return c.json(
    {
      ok: false,
      error: "Validation failed",
      message: payload.message,
      ...(payload.fieldErrors ? { fieldErrors: payload.fieldErrors } : {}),
    },
    400,
  );
}

function validateWithSchema<TSchema extends ZodTypeAny>(schema: TSchema) {
  return (value: unknown, c: Context) => {
    const parsed = parseWithSchema(schema, value);
    if (!parsed.ok) {
      return buildValidationErrorResponse(c, parsed);
    }

    return parsed.data;
  };
}

export const createAnswerValidator = validator("json", validateWithSchema(createAnswerSchema));

export const updateAnswerValidator = validator("json", validateWithSchema(updateAnswerSchema));

export const voteAnswerValidator = validator("json", validateWithSchema(voteAnswerSchema));

export const answerIdParamsValidator = validator(
  "param",
  validateWithSchema(answerIdParamsSchema),
);

export const questionIdParamsValidator = validator(
  "param",
  validateWithSchema(questionIdParamsSchema),
);
