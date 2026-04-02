import { z } from "zod";

export const authUserProfileSchema = z
  .object({
    id: z.string(),
    displayName: z.string().optional(),
    avatarKey: z.string().optional(),
    avatarUrl: z.string().optional(),
  })
  .openapi("AuthUserProfile");

export const authUserSchema = z
  .object({
    id: z.string(),
    email: z.string().email(),
    emailVerified: z.boolean().optional(),
    name: z.string().optional(),
    profile: authUserProfileSchema.optional(),
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

export const forgotPasswordResponseSchema = z
  .object({
    success: z.literal(true),
    message: z.string(),
  })
  .openapi("ForgotPasswordResponse");

export const resetPasswordResponseSchema = z
  .object({
    success: z.literal(true),
    message: z.string(),
  })
  .openapi("ResetPasswordResponse");

export const authSimpleErrorResponseSchema = z
  .object({
    error: z.string(),
  })
  .openapi("AuthSimpleErrorResponse");

export const refreshSuccessResponseSchema = z
  .object({
    accessToken: z.string(),
    refreshToken: z.string(),
  })
  .openapi("RefreshSuccessResponse");
