import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer } from "better-auth/plugins/bearer";
import { emailOTP } from "better-auth/plugins/email-otp";
import { jwt } from "better-auth/plugins/jwt";
import { db } from "../db";

const betterAuthUrl = process.env.BETTER_AUTH_URL;
const resendApiKey = process.env.RESEND_API_KEY;
const resendFrom = process.env.RESEND_FROM_EMAIL;

async function sendOtpByResend(email: string, otp: string, type: "sign-in" | "email-verification" | "forget-password") {
  if (!resendApiKey || !resendFrom) {
    throw new Error("RESEND_API_KEY or RESEND_FROM_EMAIL is missing");
  }

  const subjectByType: Record<typeof type, string> = {
    "sign-in": "Your login code",
    "email-verification": "Verify your email",
    "forget-password": "Your password reset code",
  };

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5;">
      <h2>${subjectByType[type]}</h2>
      <p>Your OTP code is:</p>
      <p style="font-size: 24px; font-weight: bold; letter-spacing: 2px;">${otp}</p>
      <p>This code expires in 5 minutes.</p>
    </div>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: resendFrom,
      to: [email],
      subject: subjectByType[type],
      html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to send OTP email: ${response.status} ${body}`);
  }
}

export const auth = betterAuth({
  baseURL: betterAuthUrl,
  secret: process.env.BETTER_AUTH_SECRET,
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
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
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
      expiresIn: 60 * 5,
      allowedAttempts: 3,
      sendVerificationOTP: async ({ email, otp, type }) => {
        await sendOtpByResend(email, otp, type);
      },
    }),
    jwt({
      jwt: {
        expirationTime: "15m",
        definePayload: async ({ user, session }) => ({
          role: user.role,
          emailVerified: user.emailVerified,
          sid: session.id,
        }),
        getSubject: async ({ user }) => user.id,
      },
    }),
  ],
});
