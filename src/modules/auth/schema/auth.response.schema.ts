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
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    gender: z.enum(["male", "female", "other"]).optional(),
    occupation: z.string().nullable().optional(),
    phoneNumber: z.string().nullable().optional(),
    image: z.string().nullable().optional(),
    signupCompletedAt: z.union([z.string(), z.date()]).nullable().optional(),
    onboardingCompletedAt: z.union([z.string(), z.date()]).nullable().optional(),
    onboardingStep: z.number().int().optional(),
    profile: authUserProfileSchema.optional(),
  })
  .openapi("AuthUser");

export const authFlowSchema = z
  .object({
    isNewUser: z.boolean(),
    requiresSignupCompletion: z.boolean(),
    requiresOnboarding: z.boolean(),
    nextStep: z.enum(["COMPLETE_SIGNUP", "ONBOARDING", "APP"]),
  })
  .openapi("AuthFlow");

export const authTokenResponseSchema = z
  .object({
    accessToken: z.string(),
    refreshToken: z.string(),
    user: authUserSchema,
    authFlow: authFlowSchema.optional(),
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

export const completeSignUpResponseSchema = z
  .object({
    success: z.literal(true),
    message: z.string(),
    user: authUserSchema,
    authFlow: authFlowSchema.optional(),
  })
  .openapi("CompleteSignUpResponse");

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
