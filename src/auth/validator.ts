import { z } from "zod";
import type { ZodTypeAny } from "zod";
import {
  authLoginSchema,
  authRefreshSchema,
  authRegisterSchema,
  authVerifyRegisterOtpSchema,
} from "./schema";

type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string };

function parseWithSchema<TSchema extends ZodTypeAny>(
  schema: TSchema,
  input: unknown
): ValidationResult<z.infer<TSchema>> {
  if (typeof input !== "object" || input === null) {
    return { ok: false, message: "Invalid body" };
  }

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Validation failed",
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

export function validateLoginPayload(input: unknown) {
  return parseWithSchema(authLoginSchema, input);
}

export function validateRefreshPayload(input: unknown) {
  return parseWithSchema(authRefreshSchema, input);
}
