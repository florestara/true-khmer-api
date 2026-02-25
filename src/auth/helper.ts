import { auth } from "../lib/auth";
import {
  AuthLoginPayload,
  AuthRegisterPayload,
  AuthVerifyRegisterOtpPayload,
} from "./schema";

const AUTH_PREFIX = "/api/auth";
const DEFAULT_BASE_URL = "http://localhost:3000";

type JsonRecord = Record<string, unknown>;

type UserLike = {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string;
  image?: string | null;
  firstName?: string;
  lastName?: string;
  gender?: string;
  createdAt: string;
  updatedAt: string;
};

export function getAuthBaseUrl() {
  return process.env.BETTER_AUTH_URL ?? DEFAULT_BASE_URL;
}

function readTokenIssuer(token: string) {
  const parts = token.split(".");
  if (parts.length !== 3) return undefined;

  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf-8"),
    ) as { iss?: string };
    return typeof payload.iss === "string" ? payload.iss : undefined;
  } catch {
    return undefined;
  }
}

async function parseJsonResponse<T>(response: Response): Promise<T | null> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return null;
  }
  return response.json() as Promise<T>;
}

export async function callAuth(path: string, init?: RequestInit) {
  const request = new Request(`${getAuthBaseUrl()}${AUTH_PREFIX}${path}`, init);
  return auth.handler(request);
}

export async function signUpWithEmailPassword(payload: AuthRegisterPayload) {
  const response = await callAuth("/sign-up/email", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      name: `${payload.firstName} ${payload.lastName}`.trim(),
      email: payload.email,
      password: payload.password,
      firstName: payload.firstName,
      lastName: payload.lastName,
      gender: payload.gender,
    }),
  });

  const body = await parseJsonResponse<{ token?: string | null; user?: UserLike }>(response);

  if (!response.ok || !body?.user) {
    return {
      ok: false,
      status: response.status,
      body,
    } as const;
  }

  return {
    ok: true,
    body: {
      token: body.token ?? null,
      user: body.user,
    },
  } as const;
}

export async function requestEmailVerificationOtp(email: string) {
  const response = await callAuth("/email-otp/send-verification-otp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email,
      type: "email-verification",
    }),
  });

  const body = await parseJsonResponse<{ success?: boolean }>(response);

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      body,
    } as const;
  }

  return {
    ok: true,
    body,
  } as const;
}

export async function verifyRegisterOtp(payload: AuthVerifyRegisterOtpPayload) {
  const response = await callAuth("/email-otp/verify-email", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email: payload.email,
      otp: payload.otp,
    }),
  });

  const body = await parseJsonResponse<{
    status?: boolean;
    token?: string | null;
    user?: UserLike;
  }>(response);

  if (!response.ok || !body?.status || !body.user || !body.token) {
    return {
      ok: false,
      status: response.status,
      body,
    } as const;
  }

  return {
    ok: true,
    body: {
      token: body.token,
      user: body.user,
    },
  } as const;
}

export async function signInWithEmailPassword(payload: AuthLoginPayload) {
  const response = await callAuth("/sign-in/email", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email: payload.email,
      password: payload.password,
      rememberMe: true,
    }),
  });

  const body = await parseJsonResponse<{ token?: string; user?: UserLike }>(response);

  if (!response.ok || !body?.token || !body.user) {
    return {
      ok: false,
      status: response.status,
      body,
    } as const;
  }

  return {
    ok: true,
    body: {
      token: body.token,
      user: body.user,
    },
  } as const;
}

export async function getAccessTokenFromRefreshToken(refreshToken: string) {
  const response = await callAuth("/token", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${refreshToken}`,
    },
  });

  const body = await parseJsonResponse<{ token?: string }>(response);

  if (!response.ok || !body?.token) {
    return {
      ok: false,
      status: response.status,
      body,
    } as const;
  }

  return {
    ok: true,
    token: body.token,
  } as const;
}

export async function verifyJwtToken(token: string) {
  const issuer = readTokenIssuer(token);
  const result = await auth.api
    .verifyJWT({
      body: {
        token,
        ...(issuer ? { issuer } : {}),
      },
    })
    .catch(() => null);

  if (!result?.payload) {
    return {
      ok: false,
      status: 401,
      body: null as JsonRecord | null,
    } as const;
  }

  return {
    ok: true,
    payload: result.payload as JsonRecord,
  } as const;
}
