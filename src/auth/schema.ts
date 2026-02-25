import { z } from "zod";

export const genderSchema = z.enum(["male", "female", "other"]);
export type Gender = z.infer<typeof genderSchema>;

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("A valid email is required");

export const authRegisterSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, "password must be at least 8 characters"),
  firstName: z.string().trim().min(1, "firstName is required"),
  lastName: z.string().trim().min(1, "lastName is required"),
  gender: z.string().trim().toLowerCase().pipe(genderSchema),
});
export type AuthRegisterPayload = z.infer<typeof authRegisterSchema>;

export const authVerifyRegisterOtpSchema = z.object({
  email: emailSchema,
  otp: z.string().trim().min(1, "otp is required"),
});
export type AuthVerifyRegisterOtpPayload = z.infer<
  typeof authVerifyRegisterOtpSchema
>;

export const authLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "password is required"),
});
export type AuthLoginPayload = z.infer<typeof authLoginSchema>;

export const authRefreshSchema = z.object({
  refreshToken: z.string().trim().min(1, "refreshToken is required"),
  email: emailSchema,
});
export type AuthRefreshPayload = z.infer<typeof authRefreshSchema>;
