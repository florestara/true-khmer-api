import { auth } from "../lib/auth";
import {
  AuthLoginPayload,
  AuthRegisterPayload,
  AuthVerifyRegisterOtpPayload,
} from "./schema";

const AUTH_PREFIX = "/api/auth";

type JsonRecord = Record<string, unknown>;
type AuthErrorBody = {
  error: string;
  details?: unknown;
};

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
  const baseUrl = process.env.BETTER_AUTH_URL;
  if (!baseUrl) {
    throw new Error("Missing required environment variable: BETTER_AUTH_URL");
  }
  return baseUrl;
}

function getTrustedTokenIssuer() {
  const issuer = process.env.BETTER_AUTH_ISSUER?.trim();
  return issuer ? issuer : undefined;
}

async function parseResponseBody(
  response: Response
): Promise<JsonRecord | string | null> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      return (await response.json()) as JsonRecord;
    } catch {
      return null;
    }
  }

  const text = await response.text().catch(() => "");
  const trimmed = text.trim();
  return trimmed ? trimmed : null;
}

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

function normalizeAuthErrorBody(
  body: JsonRecord | string | null,
  fallbackMessage: string
): AuthErrorBody {
  if (typeof body === "string") {
    return { error: body };
  }

  if (body && typeof body === "object") {
    const error = body.error;
    if (typeof error === "string" && error.trim()) {
      return { error, details: body };
    }

    const message = body.message;
    if (typeof message === "string" && message.trim()) {
      return { error: message, details: body };
    }
  }

  return { error: fallbackMessage };
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

  const body = await parseResponseBody(response);
  const parsedBody = isJsonRecord(body) ? body : null;
  const user = parsedBody?.user as UserLike | undefined;
  const token = parsedBody?.token as string | null | undefined;

  if (!response.ok || !user) {
    const errorBody = normalizeAuthErrorBody(
      body,
      "Registration failed"
    );
    return {
      ok: false,
      status: response.status,
      body: errorBody,
    } as const;
  }

  return {
    ok: true,
    body: {
      token: token ?? null,
      user,
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

  const body = await parseResponseBody(response);
  const parsedBody = isJsonRecord(body) ? body : null;

  if (!response.ok) {
    const errorBody = normalizeAuthErrorBody(
      body,
      "Failed to send verification OTP"
    );
    return {
      ok: false,
      status: response.status,
      body: errorBody,
    } as const;
  }

  return {
    ok: true,
    body: parsedBody,
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

  const body = await parseResponseBody(response);
  const parsedBody = isJsonRecord(body) ? body : null;
  const status = parsedBody?.status;
  const token = parsedBody?.token;
  const user = parsedBody?.user;

  if (
    !response.ok ||
    status !== true ||
    typeof token !== "string" ||
    !token ||
    !isJsonRecord(user)
  ) {
    const errorBody = normalizeAuthErrorBody(
      body,
      "OTP verification failed"
    );
    return {
      ok: false,
      status: response.status,
      body: errorBody,
    } as const;
  }

  return {
    ok: true,
    body: {
      token,
      user: user as UserLike,
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

  const body = await parseResponseBody(response);
  const parsedBody = isJsonRecord(body) ? body : null;
  const token = parsedBody?.token;
  const user = parsedBody?.user;

  if (
    !response.ok ||
    typeof token !== "string" ||
    !token ||
    !isJsonRecord(user)
  ) {
    const errorBody = normalizeAuthErrorBody(
      body,
      "Login failed"
    );
    return {
      ok: false,
      status: response.status,
      body: errorBody,
    } as const;
  }

  return {
    ok: true,
    body: {
      token,
      user: user as UserLike,
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

  const body = await parseResponseBody(response);
  const parsedBody = isJsonRecord(body) ? body : null;
  const token = parsedBody?.token;

  if (!response.ok || typeof token !== "string" || !token) {
    const fallbackMessage = response.ok
      ? "Failed to issue access token"
      : "Token refresh failed";
    const errorBody = normalizeAuthErrorBody(
      body,
      fallbackMessage
    );
    const status = response.ok ? 502 : response.status;
    return {
      ok: false,
      status,
      body: errorBody,
    } as const;
  }

  return {
    ok: true,
    token,
  } as const;
}

export async function verifyJwtToken(token: string) {
  const issuer = getTrustedTokenIssuer();
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
