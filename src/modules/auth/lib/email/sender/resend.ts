import { authConfig } from "../../config";
import { buildOtpTemplate } from "../templates/otp";
import { buildPasswordResetTemplate } from "../templates/password-reset";
import type { OtpEmailType } from "../types";

const RESEND_TIMEOUT_MS = 5_000;
const MAX_PROVIDER_MESSAGE_LENGTH = 120;

const subjectByType: Record<OtpEmailType, string> = {
  "email-verification": `Verify your email - ${authConfig.appName}`,
};

function sanitizeProviderErrorBody(body: string) {
  const fallback = "<provider response redacted>";
  const trimmedBody = body.trim();

  if (!trimmedBody) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(trimmedBody) as {
      error_code?: unknown;
      message?: unknown;
      name?: unknown;
    };

    const code =
      typeof parsed.error_code === "string" ? parsed.error_code.trim() : "";
    const messageSource =
      typeof parsed.message === "string"
        ? parsed.message
        : typeof parsed.name === "string"
          ? parsed.name
          : "";
    const message = messageSource.trim().slice(0, MAX_PROVIDER_MESSAGE_LENGTH);

    if (code && message) {
      return `${code}: ${message}`;
    }

    if (code) {
      return code;
    }

    if (message) {
      return message;
    }
  } catch {
    // Ignore parse failures and avoid exposing raw provider responses.
  }

  return fallback;
}

async function sendEmailByResend(
  email: string,
  subject: string,
  html: string,
  errorLabel: string,
) {
  try {
    const response = await fetch(authConfig.resendApiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authConfig.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: authConfig.resendFrom,
        to: [email],
        subject,
        html,
      }),
      signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
    });

    if (!response.ok) {
      const body = await response.text();
      const providerSummary = sanitizeProviderErrorBody(body);
      throw new Error(
        `Failed to send ${errorLabel}: ${response.status} ${providerSummary}`,
      );
    }
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError")
    ) {
      throw new Error(
        `Failed to send ${errorLabel}: request timed out after ${RESEND_TIMEOUT_MS}ms`,
      );
    }

    throw error;
  }
}

export async function sendOtpByResend(
  email: string,
  otp: string,
  type: OtpEmailType,
  displayName?: string | null,
  otpTtlMinutes = authConfig.otpTtlMinutes,
) {
  const html = buildOtpTemplate(
    otp,
    otpTtlMinutes,
    displayName,
    authConfig.appName,
  );
  const subject = subjectByType[type];

  await sendEmailByResend(email, subject, html, "OTP email");
}

export async function sendPasswordResetByResend(
  email: string,
  resetUrl: string,
  displayName?: string | null,
  resetTtlMinutes = authConfig.passwordResetTtlMinutes,
) {
  const html = buildPasswordResetTemplate(
    resetUrl,
    resetTtlMinutes,
    displayName,
    authConfig.appName,
  );
  const subject = `Reset your password - ${authConfig.appName}`;

  await sendEmailByResend(email, subject, html, "password reset email");
}
