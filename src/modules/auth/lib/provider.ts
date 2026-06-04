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

function splitGoogleDisplayName(name?: string | null) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "Google",
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : "User",
  };
}

function buildSocialProviders() {
  if (!authConfig.googleClientId || !authConfig.googleClientSecret) {
    return undefined;
  }

  return {
    google: {
      clientId: authConfig.googleClientId,
      clientSecret: authConfig.googleClientSecret,
      mapProfileToUser: (profile: {
        given_name?: string | null;
        family_name?: string | null;
        name?: string | null;
      }) => {
        const fallbackName = splitGoogleDisplayName(profile.name);
        return {
          firstName: profile.given_name?.trim() || fallbackName.firstName,
          lastName: profile.family_name?.trim() || fallbackName.lastName,
          gender: "other",
        };
      },
    },
  };
}

export const auth = betterAuth({
  baseURL: authConfig.betterAuthUrl,
  trustedOrigins: authConfig.allowedResetPageOrigins,
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
        required: false,
      },
      phoneNumber: {
        type: "string",
        required: false,
      },
    },
  },
  socialProviders: buildSocialProviders(),
  account: {
    updateAccountOnSignIn: true,
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"],
      disableImplicitLinking: false,
      allowDifferentEmails: false,
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    resetPasswordTokenExpiresIn: authConfig.passwordResetTtlSeconds,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url, token }) => {
      // Better Auth accepts `redirectTo`, then forwards it here as `callbackURL`.
      const providedResetPageUrl = new URL(url).searchParams.get("callbackURL");
      const resetUrl = new URL(
        providedResetPageUrl ?? authConfig.appDomain,
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
