import { z } from "zod";

export const genderSchema = z.enum(["male", "female", "other"]);
export type Gender = z.infer<typeof genderSchema>;

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "email is required")
  .email("email must be a valid email");

const passwordSchema = z
  .string()
  .regex(/^\S+$/, "password must not contain whitespace")
  .min(8, "password must be at least 8 characters")
  .regex(/[a-z]/, "password must contain at least one lowercase letter")
  .regex(/[A-Z]/, "password must contain at least one uppercase letter")
  .regex(/[^A-Za-z0-9\s]/, "password must contain at least one special character");

export const authRegisterSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: z.string().trim().min(1, "firstName is required"),
  lastName: z.string().trim().min(1, "lastName is required"),
  gender: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "gender is required")
    .pipe(genderSchema),
});
export type AuthRegisterPayload = z.infer<typeof authRegisterSchema>;

export const authVerifyRegisterOtpSchema = z.object({
  email: emailSchema,
  otp: z.string().trim().min(1, "otp is required"),
});
export type AuthVerifyRegisterOtpPayload = z.infer<
  typeof authVerifyRegisterOtpSchema
>;

export const authResendRegisterOtpSchema = z.object({
  email: emailSchema,
});
export type AuthResendRegisterOtpPayload = z.infer<
  typeof authResendRegisterOtpSchema
>;

export const authLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "password is required"),
});
export type AuthLoginPayload = z.infer<typeof authLoginSchema>;

export const authRefreshSchema = z.object({
  refreshToken: z.string().trim().min(1, "refreshToken is required"),
});
export type AuthRefreshPayload = z.infer<typeof authRefreshSchema>;
