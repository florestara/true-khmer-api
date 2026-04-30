import { z } from "zod";
import { createCleanNameSchema } from "../../../utils/validation/name";
import { createStrongPasswordSchema } from "../../../utils/validation/password";

const genderSchema = z.enum(["male", "female", "other"]);

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "email is required")
  .email("email must be a valid email");

const passwordSchema = createStrongPasswordSchema();

const phoneNumberSchema = z
  .string()
  .trim()
  .refine(
    (value) => /^(?=.*\d)[0-9+()\-. ]{7,20}$/.test(value),
    "phoneNumber must be 7..20 characters, contain at least one digit, and use only digits, spaces, or + ( ) - .",
  );

export const authRegisterSchema = z
  .object({
    firstName: createCleanNameSchema({ label: "firstName", maxLength: 100 }),
    lastName: createCleanNameSchema({ label: "lastName", maxLength: 100 }),
    gender: genderSchema,
    occupation: z.string().trim().min(1, "occupation is required").max(120),
    phoneNumber: phoneNumberSchema,
    email: emailSchema,
    password: passwordSchema,
  })
  .openapi("AuthRegisterRequest");

export type AuthRegisterPayload = z.infer<typeof authRegisterSchema>;

export const authVerifyRegisterOtpSchema = z
  .object({
    email: emailSchema,
    otp: z.string().trim().length(6, "otp must be exactly 6 characters"),
  })
  .openapi("AuthVerifyRegisterOtpRequest");

export type AuthVerifyRegisterOtpPayload = z.infer<
  typeof authVerifyRegisterOtpSchema
>;

export const authResendRegisterOtpSchema = z
  .object({
    email: emailSchema,
  })
  .openapi("AuthResendRegisterOtpRequest");

export type AuthResendRegisterOtpPayload = z.infer<
  typeof authResendRegisterOtpSchema
>;

export const authLoginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1, "password is required"),
  })
  .openapi("AuthLoginRequest");

export type AuthLoginPayload = z.infer<typeof authLoginSchema>;

export const authForgotPasswordSchema = z
  .object({
    email: emailSchema,
    resetPageUrl: z
      .string()
      .trim()
      .min(1, "resetPageUrl is required"),
  })
  .openapi("AuthForgotPasswordRequest");

export type AuthForgotPasswordPayload = z.infer<
  typeof authForgotPasswordSchema
>;

export const authResetPasswordSchema = z
  .object({
    token: z.string().trim().min(1, "token is required"),
    newPassword: passwordSchema,
  })
  .openapi("AuthResetPasswordRequest");

export type AuthResetPasswordPayload = z.infer<typeof authResetPasswordSchema>;

export const authRefreshSchema = z
  .object({
    refreshToken: z.string().trim().min(1, "refreshToken is required"),
  })
  .openapi("AuthRefreshRequest");

export type AuthRefreshPayload = z.infer<typeof authRefreshSchema>;
