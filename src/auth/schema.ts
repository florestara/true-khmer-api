import { z } from "zod";
import { createCleanNameSchema } from "../utils/validation/name";
import { createStrongPasswordSchema } from "../utils/validation/password";

const genderSchema = z.enum(["male", "female", "other"]);

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "email is required")
  .email("email must be a valid email");

const passwordSchema = createStrongPasswordSchema();

export const authRegisterSchema = z.object({
  firstName: createCleanNameSchema({ label: "firstName", maxLength: 100 }),
  lastName: createCleanNameSchema({ label: "lastName", maxLength: 100 }),
  gender: genderSchema,
  occupation: z.string().trim().min(1, "occupation is required").max(120),
  email: emailSchema,
  password: passwordSchema,
});
export type AuthRegisterPayload = z.infer<typeof authRegisterSchema>;

export const authVerifyRegisterOtpSchema = z.object({
  email: emailSchema,
  otp: z.string().trim().length(6, "otp must be exactly 6 characters"),
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
