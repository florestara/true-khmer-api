import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer } from "better-auth/plugins/bearer";
import { emailOTP } from "better-auth/plugins/email-otp";
import { jwt } from "better-auth/plugins/jwt";
import { db } from "../../../db/index";
import { authConfig } from "./config";
import {
  sendOtpByResend,
  sendPasswordResetByResend,
} from "./email/sender/resend";
import { jwtPluginConfig } from "./plugins/jwt";
import { findUserFirstNameByEmail } from "../auth.query";

function getSearchParamValue(
  searchParams: URLSearchParams,
  targetName: string,
): string | null {
  const normalizedTargetName = targetName.toLowerCase();

  for (const [name, value] of searchParams.entries()) {
    if (name.toLowerCase() === normalizedTargetName) {
      return value;
    }
  }

  return null;
}

export const auth = betterAuth({
  baseURL: authConfig.betterAuthUrl,
  trustedOrigins: authConfig.allowedCallbackOrigins,
  secret: authConfig.betterAuthSecret,
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  advanced: {
    database: {
      generateId: "uuid",
    },
  },
  user: {
    additionalFields: {
      firstName: {
        type: "string",
        required: true,
      },
      lastName: {
        type: "string",
        required: true,
      },
      gender: {
        type: "string",
        required: true,
      },
      occupation: {
        type: "string",
        required: true,
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    resetPasswordTokenExpiresIn: authConfig.passwordResetTtlSeconds,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url, token }) => {
      const callbackParams = new URL(url).searchParams;
      const providedCallbackUrl = getSearchParamValue(
        callbackParams,
        "callbackUrl",
      );
      const resetUrl = new URL(
        providedCallbackUrl ?? authConfig.appDomain,
        authConfig.appDomain,
      );

      resetUrl.searchParams.set("token", token);

      const displayName =
        (user as { firstName?: string | null }).firstName ??
        (await findUserFirstNameByEmail(user.email));

      await sendPasswordResetByResend(
        user.email,
        resetUrl.toString(),
        displayName,
      );
    },
  },
  emailVerification: {
    autoSignInAfterVerification: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  plugins: [
    bearer(),
    emailOTP({
      expiresIn: authConfig.otpTtlMinutes * 60,
      allowedAttempts: 3,
      sendVerificationOTP: async ({ email, otp, type }) => {
        if (type !== "email-verification") {
          throw new Error(`Unsupported OTP email type: ${type}`);
        }

        const displayName = await findUserFirstNameByEmail(email);
        await sendOtpByResend(email, otp, type, displayName);
      },
    }),
    jwt(jwtPluginConfig),
  ],
});
