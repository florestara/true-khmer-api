import {
  AuthLoginPayload,
  AuthRefreshPayload,
  AuthRegisterPayload,
  AuthVerifyRegisterOtpPayload,
  Gender,
} from "./schema";

const GENDERS: Gender[] = ["male", "female", "other"];

function isValidEmail(email: string) {
  return /^\S+@\S+\.\S+$/.test(email);
}

export function validateRegisterPayload(input: unknown):
  | { ok: true; data: AuthRegisterPayload }
  | { ok: false; message: string } {
  if (typeof input !== "object" || input === null) {
    return { ok: false, message: "Invalid body" };
  }

  const body = input as Partial<AuthRegisterPayload>;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
  const gender = typeof body.gender === "string" ? body.gender.trim().toLowerCase() : "";

  if (!email || !isValidEmail(email)) {
    return { ok: false, message: "A valid email is required" };
  }

  if (!password || password.length < 8) {
    return { ok: false, message: "password must be at least 8 characters" };
  }

  if (!firstName) {
    return { ok: false, message: "firstName is required" };
  }

  if (!lastName) {
    return { ok: false, message: "lastName is required" };
  }

  if (!GENDERS.includes(gender as Gender)) {
    return { ok: false, message: "gender must be one of: male, female, other" };
  }

  return {
    ok: true,
    data: {
      email,
      password,
      firstName,
      lastName,
      gender: gender as Gender,
    },
  };
}

export function validateVerifyRegisterOtpPayload(input: unknown):
  | { ok: true; data: AuthVerifyRegisterOtpPayload }
  | { ok: false; message: string } {
  if (typeof input !== "object" || input === null) {
    return { ok: false, message: "Invalid body" };
  }

  const body = input as Partial<AuthVerifyRegisterOtpPayload>;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const otp = typeof body.otp === "string" ? body.otp.trim() : "";

  if (!email || !isValidEmail(email)) {
    return { ok: false, message: "A valid email is required" };
  }

  if (!otp) {
    return { ok: false, message: "otp is required" };
  }

  return {
    ok: true,
    data: {
      email,
      otp,
    },
  };
}

export function validateLoginPayload(input: unknown):
  | { ok: true; data: AuthLoginPayload }
  | { ok: false; message: string } {
  if (typeof input !== "object" || input === null) {
    return { ok: false, message: "Invalid body" };
  }

  const body = input as Partial<AuthLoginPayload>;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !isValidEmail(email)) {
    return { ok: false, message: "A valid email is required" };
  }

  if (!password) {
    return { ok: false, message: "password is required" };
  }

  return {
    ok: true,
    data: {
      email,
      password,
    },
  };
}

export function validateRefreshPayload(input: unknown):
  | { ok: true; data: AuthRefreshPayload }
  | { ok: false; message: string } {
  if (typeof input !== "object" || input === null) {
    return { ok: false, message: "Invalid body" };
  }

  const body = input as Partial<AuthRefreshPayload>;
  const refreshToken =
    typeof body.refreshToken === "string" ? body.refreshToken.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!refreshToken) {
    return { ok: false, message: "refreshToken is required" };
  }

  if (!email || !isValidEmail(email)) {
    return { ok: false, message: "A valid email is required" };
  }

  return {
    ok: true,
    data: {
      refreshToken,
      email,
    },
  };
}
