import { Context } from "hono";
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

export async function handleRegister(c: Context) {
  const payload = validateRegisterPayload(await c.req.json());

  if (!payload.ok) {
    return c.json({ error: payload.message }, 400);
  }

  const registerResult = await signUpWithEmailPassword(payload.data);

  if (!registerResult.ok) {
    return c.json(registerResult.body ?? { error: "Registration failed" }, registerResult.status as 400 | 401 | 403 | 404 | 500);
  }

  const otpResult = await requestEmailVerificationOtp(payload.data.email);

  if (!otpResult.ok) {
    return c.json(otpResult.body ?? { error: "Failed to send verification OTP" }, otpResult.status as 400 | 401 | 403 | 404 | 500);
  }

  return c.json({
    success: true,
    message: "Registration successful. OTP sent to email.",
    user: registerResult.body.user,
  }, 201);
}

export async function handleVerifyRegisterOtp(c: Context) {
  const payload = validateVerifyRegisterOtpPayload(await c.req.json());

  if (!payload.ok) {
    return c.json({ error: payload.message }, 400);
  }

  const verifyResult = await verifyRegisterOtp(payload.data);

  if (!verifyResult.ok) {
    return c.json(verifyResult.body ?? { error: "OTP verification failed" }, verifyResult.status as 400 | 401 | 403 | 404 | 500);
  }

  const accessTokenResult = await getAccessTokenFromRefreshToken(verifyResult.body.token);

  if (!accessTokenResult.ok) {
    return c.json(accessTokenResult.body ?? { error: "Failed to issue access token" }, accessTokenResult.status as 400 | 401 | 403 | 404 | 500);
  }

  return c.json({
    accessToken: accessTokenResult.token,
    refreshToken: verifyResult.body.token,
    user: verifyResult.body.user,
  });
}

export async function handleLogin(c: Context) {
  const payload = validateLoginPayload(await c.req.json());

  if (!payload.ok) {
    return c.json({ error: payload.message }, 400);
  }

  const loginResult = await signInWithEmailPassword(payload.data);

  if (!loginResult.ok) {
    return c.json(loginResult.body ?? { error: "Login failed" }, loginResult.status as 400 | 401 | 403 | 404 | 500);
  }

  const accessTokenResult = await getAccessTokenFromRefreshToken(loginResult.body.token);

  if (!accessTokenResult.ok) {
    return c.json(accessTokenResult.body ?? { error: "Failed to issue access token" }, accessTokenResult.status as 400 | 401 | 403 | 404 | 500);
  }

  return c.json({
    accessToken: accessTokenResult.token,
    refreshToken: loginResult.body.token,
    user: loginResult.body.user,
  });
}

export async function handleRefresh(c: Context) {
  const payload = validateRefreshPayload(await c.req.json());

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
    return c.json(accessTokenResult.body ?? { error: "Token refresh failed" }, accessTokenResult.status as 400 | 401 | 403 | 404 | 500);
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
