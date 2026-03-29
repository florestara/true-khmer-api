import { z } from "zod";

export const authUserSchema = z
  .object({
    id: z.string(),
    email: z.string().email(),
    emailVerified: z.boolean().optional(),
    name: z.string().optional(),
  })
  .openapi("AuthUser");

export const authTokenResponseSchema = z
  .object({
    accessToken: z.string(),
    refreshToken: z.string(),
    user: authUserSchema,
  })
  .openapi("AuthTokenResponse");

export const registerSuccessResponseSchema = z
  .object({
    success: z.literal(true),
    message: z.string(),
    otpSent: z.boolean(),
    user: authUserSchema,
  })
  .openapi("RegisterSuccessResponse");

export const resendRegisterOtpResponseSchema = z
  .object({
    success: z.boolean(),
    message: z.string(),
  })
  .openapi("ResendRegisterOtpResponse");

export const authSimpleErrorResponseSchema = z
  .object({
    error: z.string(),
  })
  .openapi("AuthSimpleErrorResponse");

export const authProtectedErrorResponseSchema = z
  .object({
    ok: z.literal(false),
    error: z.string(),
    code: z.string().optional(),
  })
  .openapi("AuthProtectedErrorResponse");

export type AuthProtectedErrorResponseBody = z.infer<
  typeof authProtectedErrorResponseSchema
>;

export const refreshSuccessResponseSchema = z
  .object({
    accessToken: z.string(),
    refreshToken: z.string(),
  })
  .openapi("RefreshSuccessResponse");
