import { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { auth } from "../lib/auth";
import {
  getAccessTokenFromRefreshToken,
  requestEmailVerificationOtp,
  signInWithEmailPassword,
  signUpWithEmailPassword,
  verifyRegisterOtp,
} from "./helper";
import {
  findUserByEmail,
  revokeEmailVerificationOtp,
} from "./query";
import {
  validateLoginPayload,
  validateResendRegisterOtpPayload,
  validateRefreshPayload,
  validateRegisterPayload,
  validateVerifyRegisterOtpPayload,
} from "./validator";

type FieldErrors = Record<string, string>;
type ValidationFailure = { ok: false; message: string; fieldErrors?: FieldErrors };
type ValidationSuccess<T> = { ok: true; data: T };
type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

function toStatusCode(
  status: unknown,
  fallback: ContentfulStatusCode = 500
): ContentfulStatusCode {
  if (
    typeof status === "number" &&
    Number.isInteger(status) &&
    status >= 400 &&
    status <= 599
  ) {
    return status as ContentfulStatusCode;
  }
  return fallback;
}

async function parseJsonBody(c: Context) {
  try {
    return { ok: true as const, data: await c.req.json() };
  } catch {
    return {
      ok: false as const,
      response: c.json({ error: "Invalid JSON body" }, 400),
    };
  }
}

function validationErrorResponse(c: Context, payload: ValidationFailure) {
  return c.json(
    {
      error: "Validation failed",
      message: payload.message,
      ...(payload.fieldErrors ? { fieldErrors: payload.fieldErrors } : {}),
    },
    400
  );
}

async function parseAndValidate<T>(
  c: Context,
  validate: (input: unknown) => ValidationResult<T>
) {
  const body = await parseJsonBody(c);
  if (!body.ok) {
    return { ok: false as const, response: body.response };
  }

  const payload = validate(body.data);
  if (!payload.ok) {
    return {
      ok: false as const,
      response: validationErrorResponse(c, payload),
    };
  }

  return { ok: true as const, data: payload.data };
}

function authProviderError(
  c: Context,
  status: unknown,
  body: unknown,
  fallbackMessage: string
) {
  return c.json(
    (body as Record<string, unknown> | null | undefined) ?? { error: fallbackMessage },
    toStatusCode(status)
  );
}

async function buildAuthTokenResponse(
  c: Context,
  refreshToken: string,
  user: unknown
) {
  const accessTokenResult = await getAccessTokenFromRefreshToken(refreshToken);

  if (!accessTokenResult.ok) {
    return authProviderError(
      c,
      accessTokenResult.status,
      accessTokenResult.body,
      "Failed to issue access token"
    );
  }

  return c.json({
    accessToken: accessTokenResult.token,
    refreshToken,
    user,
  });
}

export async function handleRegister(c: Context) {
  const parsed = await parseAndValidate(c, validateRegisterPayload);
  if (!parsed.ok) {
    return parsed.response;
  }

  const registerResult = await signUpWithEmailPassword(parsed.data);

  if (!registerResult.ok) {
    return authProviderError(
      c,
      registerResult.status,
      registerResult.body,
      "Registration failed"
    );
  }

  const otpResult = await requestEmailVerificationOtp(parsed.data.email);

  if (!otpResult.ok) {
    return c.json(
      {
        success: true,
        message:
          "Registration successful, but we could not send the OTP yet. Please use resend OTP.",
        otpSent: false,
        user: registerResult.body.user,
      },
      201
    );
  }

  return c.json({
    success: true,
    message: "Registration successful. OTP sent to email.",
    otpSent: true,
    user: registerResult.body.user,
  }, 201);
}

export async function handleVerifyRegisterOtp(c: Context) {
  const parsed = await parseAndValidate(c, validateVerifyRegisterOtpPayload);
  if (!parsed.ok) {
    return parsed.response;
  }

  const verifyResult = await verifyRegisterOtp(parsed.data);

  if (!verifyResult.ok) {
    return authProviderError(
      c,
      verifyResult.status,
      verifyResult.body,
      "OTP verification failed"
    );
  }

  return buildAuthTokenResponse(
    c,
    verifyResult.body.token,
    verifyResult.body.user
  );
}

export async function handleResendRegisterOtp(c: Context) {
  const parsed = await parseAndValidate(c, validateResendRegisterOtpPayload);
  if (!parsed.ok) {
    return parsed.response;
  }

  const genericResponse = {
    success: true,
    message:
      "If this email is eligible, we sent a verification code. Please check your inbox.",
  };

  const foundUser = await findUserByEmail(parsed.data.email);

  if (!foundUser || foundUser.emailVerified) {
    return c.json(genericResponse, 200);
  }

  try {
    await revokeEmailVerificationOtp(parsed.data.email);
  } catch (error) {
    console.error("Failed to revoke previous email verification OTP:", error);
  }

  const otpResult = await requestEmailVerificationOtp(parsed.data.email);

  if (!otpResult.ok) {
    return c.json(genericResponse, 200);
  }

  return c.json(genericResponse, 200);
}

export async function handleLogin(c: Context) {
  const parsed = await parseAndValidate(c, validateLoginPayload);
  if (!parsed.ok) {
    return parsed.response;
  }

  const loginResult = await signInWithEmailPassword(parsed.data);

  if (!loginResult.ok) {
    return authProviderError(
      c,
      loginResult.status,
      loginResult.body,
      "Login failed"
    );
  }

  return buildAuthTokenResponse(c, loginResult.body.token, loginResult.body.user);
}

export async function handleRefresh(c: Context) {
  const parsed = await parseAndValidate(c, validateRefreshPayload);
  if (!parsed.ok) {
    return parsed.response;
  }

  const accessTokenResult = await getAccessTokenFromRefreshToken(
    parsed.data.refreshToken,
  );

  if (!accessTokenResult.ok) {
    return authProviderError(
      c,
      accessTokenResult.status,
      accessTokenResult.body,
      "Token refresh failed"
    );
  }

  return c.json({
    accessToken: accessTokenResult.token,
    refreshToken: parsed.data.refreshToken,
  });
}

export async function handleAuthPassthrough(c: Context) {
  const response = await auth.handler(c.req.raw);
  return response;
}
