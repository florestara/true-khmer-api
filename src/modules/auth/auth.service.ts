import { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import {
  getAccessTokenFromRefreshToken,
  requestPasswordReset,
  resetPassword,
  requestEmailVerificationOtp,
  signInWithEmailPassword,
  signUpWithEmailPassword,
  verifyRegisterOtp,
} from "./lib/helper";
import {
  findUserByEmail,
  revokeEmailVerificationOtp,
} from "./auth.query";
import { authConfig } from "./lib/config";
import {
  type ValidationFailure,
  type ValidationResult,
  validateForgotPasswordPayload,
  validateLoginPayload,
  validateRefreshPayload,
  validateRegisterPayload,
  validateResetPasswordPayload,
  validateResendRegisterOtpPayload,
  validateVerifyRegisterOtpPayload,
} from "./auth.validator";

const genericForgotPasswordResponse = {
  success: true as const,
  message:
    "If this email exists in our system, check your email for the reset link.",
};

function toStatusCode(
  status: unknown,
  fallback: ContentfulStatusCode = 500,
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
    400,
  );
}

async function parseAndValidate<T>(
  c: Context,
  validate: (input: unknown) => ValidationResult<T>,
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
  fallbackMessage: string,
) {
  return c.json(
    (body as Record<string, unknown> | null | undefined) ?? {
      error: fallbackMessage,
    },
    toStatusCode(status),
  );
}

function getAuthErrorCode(body: unknown): string | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const directCode = (body as Record<string, unknown>).code;
  if (typeof directCode === "string" && directCode.trim()) {
    return directCode.trim();
  }

  const details = (body as Record<string, unknown>).details;
  if (!details || typeof details !== "object") {
    return null;
  }

  const detailsCode = (details as Record<string, unknown>).code;
  if (typeof detailsCode === "string" && detailsCode.trim()) {
    return detailsCode.trim();
  }

  return null;
}

function getAuthErrorMessage(body: unknown, fallbackMessage: string): string {
  if (!body || typeof body !== "object") {
    return fallbackMessage;
  }

  const error = (body as Record<string, unknown>).error;
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  const message = (body as Record<string, unknown>).message;
  if (typeof message === "string" && message.trim()) {
    return message.trim();
  }

  return fallbackMessage;
}

function normalizeCallbackUrl(rawCallbackUrl: string) {
  let callbackUrl: URL;

  try {
    callbackUrl = new URL(rawCallbackUrl, authConfig.appDomain);
  } catch {
    return { ok: false as const, message: "callbackUrl must be a valid URL" };
  }

  const allowedOrigins = new Set<string>(authConfig.allowedCallbackOrigins);

  if (!allowedOrigins.has(callbackUrl.origin)) {
    return {
      ok: false as const,
      message: "callbackUrl must use APP_DOMAIN or a local development origin",
    };
  }

  return { ok: true as const, url: callbackUrl };
}

async function buildAuthTokenResponse(
  c: Context,
  refreshToken: string,
  user: unknown,
) {
  const accessTokenResult = await getAccessTokenFromRefreshToken(refreshToken);

  if (!accessTokenResult.ok) {
    return authProviderError(
      c,
      accessTokenResult.status,
      accessTokenResult.body,
      "Failed to issue access token",
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

  const existingUser = await findUserByEmail(parsed.data.email);
  if (existingUser) {
    return authProviderError(
      c,
      409,
      { error: "Email already exists" },
      "Registration failed",
    );
  }

  const registerResult = await signUpWithEmailPassword(parsed.data);

  if (!registerResult.ok) {
    return authProviderError(
      c,
      registerResult.status,
      registerResult.body,
      "Registration failed",
    );
  }

  const otpResult = await requestEmailVerificationOtp(parsed.data.email);

  if (!otpResult.ok) {
    return c.json(
      {
        success: true,
        message:
          "Registration successful, but we could not send the OTP due to a temporary issue. Please request a new OTP to verify your email address.",
        otpSent: false,
        user: registerResult.body.user,
      },
      201,
    );
  }

  return c.json(
    {
      success: true,
      message: "Registration successful. OTP code sent to email.",
      otpSent: true,
      user: registerResult.body.user,
    },
    201,
  );
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
      "OTP code check failed",
    );
  }

  return buildAuthTokenResponse(
    c,
    verifyResult.body.token,
    verifyResult.body.user,
  );
}

export async function handleResendRegisterOtp(c: Context) {
  const parsed = await parseAndValidate(c, validateResendRegisterOtpPayload);
  if (!parsed.ok) {
    return parsed.response;
  }

  // For security and privacy, we return the same generic success response regardless of whether the email exists or not.
  // This prevents potential attackers from enumerating valid email addresses in our system.
  const genericResponse = {
    success: true,
    message:
      "If this email is eligible, we sent an OTP code. Please check your inbox.",
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
    const errorCode = getAuthErrorCode(loginResult.body);

    if (errorCode === "EMAIL_NOT_VERIFIED") {
      let otpSent = false;
      const foundUser = await findUserByEmail(parsed.data.email);

      if (foundUser && !foundUser.emailVerified) {
        try {
          await revokeEmailVerificationOtp(parsed.data.email);
        } catch (error) {
          console.error(
            "Failed to revoke previous email verification OTP:",
            error,
          );
        }

        const otpResult = await requestEmailVerificationOtp(parsed.data.email);
        otpSent = otpResult.ok;
      }

      return c.json(
        {
          error: "Email not verified",
          code: "EMAIL_NOT_VERIFIED",
          otpSent,
          message: otpSent
            ? "OTP sent. Please use it to verify your email."
            : "Email not verified. Please request a new OTP.",
        },
        403,
      );
    }

    return authProviderError(
      c,
      loginResult.status,
      loginResult.body,
      "Login failed",
    );
  }

  return buildAuthTokenResponse(
    c,
    loginResult.body.token,
    loginResult.body.user,
  );
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
      "Token refresh failed",
    );
  }

  return c.json({
    accessToken: accessTokenResult.token,
    refreshToken: parsed.data.refreshToken,
  });
}

export async function handleForgotPassword(c: Context) {
  const parsed = await parseAndValidate(c, validateForgotPasswordPayload);
  if (!parsed.ok) {
    return c.json({ error: parsed.response._data.error }, 400);
  }

  const callbackUrl = normalizeCallbackUrl(parsed.data.callbackUrl);
  if (!callbackUrl.ok) {
    return c.json({ error: callbackUrl.message }, 400);
  }

  const passwordResetResult = await requestPasswordReset({
    email: parsed.data.email,
    callbackUrl: callbackUrl.url.toString(),
  });

  if (!passwordResetResult.ok) {
    const foundUser = await findUserByEmail(parsed.data.email);
    if (!foundUser) {
      return c.json(genericForgotPasswordResponse, 200);
    }

    return c.json(
      {
        error: getAuthErrorMessage(
          passwordResetResult.body,
          "Failed to request password reset",
        ),
      },
      400,
    );
  }

  return c.json(genericForgotPasswordResponse, 200);
}

export async function handleResetPassword(c: Context) {
  const parsed = await parseAndValidate(c, validateResetPasswordPayload);
  if (!parsed.ok) {
    return c.json({ error: parsed.response._data.error }, 400);
  }

  const resetResult = await resetPassword(parsed.data);

  if (!resetResult.ok) {
    return c.json(
      {
        error: getAuthErrorMessage(
          resetResult.body,
          "Failed to reset password",
        ),
      },
      400,
    );
  }

  return c.json(
    {
      success: true,
      message: "Password reset successful.",
    },
    200,
  );
}
