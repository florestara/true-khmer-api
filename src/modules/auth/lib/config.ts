import { env } from "../../../config/env";

function requireEnv(name: string) {
  const value = env[name as keyof typeof env];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return String(value);
}

function optionalEnv(name: string, fallback: string) {
  const value = env[name as keyof typeof env];
  if (typeof value !== "string") {
    return fallback;
  }
  return value || fallback;
}

function toOrigin(url: string) {
  return new URL(url).origin;
}

const PASSWORD_RESET_TTL_MINUTES = 15;
const appDomain = requireEnv("APP_DOMAIN");
const allowedResetPageOrigins = Array.from(
  new Set([
    toOrigin(appDomain),
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://true-khmer.com",
  ]),
);

export const authConfig = {
  appName: optionalEnv("APP_NAME", "True Khmer"),
  appDomain,
  allowedResetPageOrigins,
  otpTtlMinutes: 5,
  passwordResetTtlMinutes: PASSWORD_RESET_TTL_MINUTES,
  passwordResetTtlSeconds: PASSWORD_RESET_TTL_MINUTES * 60,
  jwtExpiration: optionalEnv("JWT_EXPIRATION", "15m"),
  betterAuthUrl: requireEnv("BETTER_AUTH_URL"),
  betterAuthSecret: requireEnv("BETTER_AUTH_SECRET"),
  googleClientId: env.GOOGLE_CLIENT_ID?.trim(),
  googleClientSecret: env.GOOGLE_CLIENT_SECRET?.trim(),
  resendApiKey: requireEnv("RESEND_API_KEY"),
  resendFrom: requireEnv("RESEND_FROM_EMAIL"),
  resendApiUrl: requireEnv("RESEND_API_URL"),
};
