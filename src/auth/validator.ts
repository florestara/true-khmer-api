import { z } from "zod";
import type { ZodTypeAny } from "zod";
import {
  authLoginSchema,
  authResendRegisterOtpSchema,
  authRefreshSchema,
  authRegisterSchema,
  authVerifyRegisterOtpSchema,
} from "./schema";

export type FieldErrors = Record<string, string>;
export type ValidationFailure = {
  ok: false;
  message: string;
  fieldErrors?: FieldErrors;
};
export type ValidationSuccess<T> = { ok: true; data: T };
export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

function parseWithSchema<TSchema extends ZodTypeAny>(
  schema: TSchema,
  input: unknown
): ValidationResult<z.infer<TSchema>> {
  if (typeof input !== "object" || input === null) {
    return { ok: false, message: "Invalid body" };
  }

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};

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

    const firstField = Object.keys(fieldErrors).sort((a, b) =>
      a.localeCompare(b)
    )[0];

    return {
      ok: false,
      message: firstField ? fieldErrors[firstField] : "Validation failed",
      fieldErrors,
    };
  }

  return { ok: true, data: parsed.data };
}

export function validateRegisterPayload(input: unknown) {
  return parseWithSchema(authRegisterSchema, input);
}

export function validateVerifyRegisterOtpPayload(input: unknown) {
  return parseWithSchema(authVerifyRegisterOtpSchema, input);
}

export function validateResendRegisterOtpPayload(input: unknown) {
  return parseWithSchema(authResendRegisterOtpSchema, input);
}

export function validateLoginPayload(input: unknown) {
  return parseWithSchema(authLoginSchema, input);
}

export function validateRefreshPayload(input: unknown) {
  return parseWithSchema(authRefreshSchema, input);
}
