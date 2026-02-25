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
import { findSessionOwnerByRefreshToken } from "./query";
import {
  validateLoginPayload,
  validateRefreshPayload,
  validateRegisterPayload,
  validateVerifyRegisterOtpPayload,
} from "./validator";

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

export async function handleRegister(c: Context) {
  const body = await parseJsonBody(c);
  if (!body.ok) {
    return body.response;
  }
  const payload = validateRegisterPayload(body.data);

  if (!payload.ok) {
    return c.json({ error: payload.message }, 400);
  }

  const registerResult = await signUpWithEmailPassword(payload.data);

  if (!registerResult.ok) {
    return c.json(
      registerResult.body ?? { error: "Registration failed" },
      toStatusCode(registerResult.status)
    );
  }

  const otpResult = await requestEmailVerificationOtp(payload.data.email);

  if (!otpResult.ok) {
    return c.json(
      otpResult.body ?? { error: "Failed to send verification OTP" },
      toStatusCode(otpResult.status)
    );
  }

  return c.json({
    success: true,
    message: "Registration successful. OTP sent to email.",
    user: registerResult.body.user,
  }, 201);
}

export async function handleVerifyRegisterOtp(c: Context) {
  const body = await parseJsonBody(c);
  if (!body.ok) {
    return body.response;
  }
  const payload = validateVerifyRegisterOtpPayload(body.data);

  if (!payload.ok) {
    return c.json({ error: payload.message }, 400);
  }

  const verifyResult = await verifyRegisterOtp(payload.data);

  if (!verifyResult.ok) {
    return c.json(
      verifyResult.body ?? { error: "OTP verification failed" },
      toStatusCode(verifyResult.status)
    );
  }

  const accessTokenResult = await getAccessTokenFromRefreshToken(verifyResult.body.token);

  if (!accessTokenResult.ok) {
    return c.json(
      accessTokenResult.body ?? { error: "Failed to issue access token" },
      toStatusCode(accessTokenResult.status)
    );
  }

  return c.json({
    accessToken: accessTokenResult.token,
    refreshToken: verifyResult.body.token,
    user: verifyResult.body.user,
  });
}

export async function handleLogin(c: Context) {
  const body = await parseJsonBody(c);
  if (!body.ok) {
    return body.response;
  }
  const payload = validateLoginPayload(body.data);

  if (!payload.ok) {
    return c.json({ error: payload.message }, 400);
  }

  const loginResult = await signInWithEmailPassword(payload.data);

  if (!loginResult.ok) {
    return c.json(
      loginResult.body ?? { error: "Login failed" },
      toStatusCode(loginResult.status)
    );
  }

  const accessTokenResult = await getAccessTokenFromRefreshToken(loginResult.body.token);

  if (!accessTokenResult.ok) {
    return c.json(
      accessTokenResult.body ?? { error: "Failed to issue access token" },
      toStatusCode(accessTokenResult.status)
    );
  }

  return c.json({
    accessToken: accessTokenResult.token,
    refreshToken: loginResult.body.token,
    user: loginResult.body.user,
  });
}

export async function handleRefresh(c: Context) {
  const body = await parseJsonBody(c);
  if (!body.ok) {
    return body.response;
  }
  const payload = validateRefreshPayload(body.data);

  if (!payload.ok) {
    return c.json({ error: payload.message }, 400);
  }

  const sessionOwner = await findSessionOwnerByRefreshToken(payload.data.refreshToken);

  if (!sessionOwner) {
    return c.json({ error: "Invalid refresh token" }, 401);
  }

  if (sessionOwner.email.toLowerCase() !== payload.data.email.toLowerCase()) {
    return c.json({ error: "Refresh token does not belong to this email" }, 403);
  }

  const accessTokenResult = await getAccessTokenFromRefreshToken(
    payload.data.refreshToken,
  );

  if (!accessTokenResult.ok) {
    return c.json(
      accessTokenResult.body ?? { error: "Token refresh failed" },
      toStatusCode(accessTokenResult.status)
    );
  }

  return c.json({
    accessToken: accessTokenResult.token,
    refreshToken: payload.data.refreshToken,
  });
}

export async function handleAuthPassthrough(c: Context) {
  const response = await auth.handler(c.req.raw);
  return response;
}
