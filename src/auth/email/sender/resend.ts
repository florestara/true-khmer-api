import { authConfig } from "../../config";
import { buildOtpTemplate } from "../templates/otp";
import type { OtpEmailType } from "../types";

const subjectByType: Record<OtpEmailType, string> = {
  "email-verification": `Verify your email - ${authConfig.appName}`,
};

export async function sendOtpByResend(
  email: string,
  otp: string,
  type: OtpEmailType,
  displayName?: string | null,
  otpTtlMinutes = authConfig.otpTtlMinutes,
) {
  const html = buildOtpTemplate(otp, otpTtlMinutes, displayName);
  const subject = subjectByType[type];

  const response = await fetch("https://api.resend.com/emails", {
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
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to send OTP email: ${response.status} ${body}`);
  }
}
