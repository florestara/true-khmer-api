import { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import {
  getAccessTokenFromRefreshToken,
  requestPasswordReset,
  resetPassword,
  requestEmailVerificationOtp,
  signInWithGoogleIdToken,
  signInWithEmailPassword,
  signUpWithEmailPassword,
  verifyRegisterOtp,
} from "./lib/helper";
import {
  completeUserSignUp,
  findAuthFlowUserById,
  findUserByEmail,
  markUserSignUpCompleted,
  revokeEmailVerificationOtp,
} from "./auth.query";
import type { AuthContext } from "./lib/types";
import { authConfig } from "./lib/config";
import { ONBOARDING_COMPLETE_STEP } from "../onboarding/constants";
import {
  type ValidationFailure,
  type ValidationResult,
  validateCompleteSignUpPayload,
  validateForgotPasswordPayload,
  validateGooglePayload,
  validateLoginPayload,
  validateRefreshPayload,
  validateRegisterPayload,
  validateResetPasswordPayload,
  validateResendRegisterOtpPayload,
  validateVerifyRegisterOtpPayload,
} from "./auth.validator";

type AuthNextStep = "COMPLETE_SIGNUP" | "ONBOARDING" | "APP";
type AuthFlowUser = {
  id: string;
  signupCompletedAt?: Date | string | null;
  onboardingCompletedAt?: Date | string | null;
  onboardingStep?: number | null;
};
type AuthFlow = {
  isNewUser: boolean;
  requiresSignupCompletion: boolean;
  requiresOnboarding: boolean;
  nextStep: AuthNextStep;
};

const genericForgotPasswordResponse = {
  success: true as const,
  message:
    "If this email exists in our system, check your email for the reset link.",
};

function toStatusCode(
  status: unknown,
  fallback: ContentfulStatusCode = 500,
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

function validationErrorResponse(c: Context, payload: ValidationFailure) {
  return c.json(
    {
      error: "Validation failed",
      message: payload.message,
      ...(payload.fieldErrors ? { fieldErrors: payload.fieldErrors } : {}),
    },
    400,
  );
}

async function parseAndValidate<T>(
  c: Context,
  validate: (input: unknown) => ValidationResult<T>,
) {
  const body = await parseJsonBody(c);
  if (!body.ok) {
    return { ok: false as const, response: body.response };
  }

  const payload = validate(body.data);
  if (!payload.ok) {
    return {
      ok: false as const,
      response: validationErrorResponse(c, payload),
    };
  }

  return { ok: true as const, data: payload.data };
}

function authProviderError(
  c: Context,
  status: unknown,
  body: unknown,
  fallbackMessage: string,
) {
  return c.json(
    (body as Record<string, unknown> | null | undefined) ?? {
      error: fallbackMessage,
    },
    toStatusCode(status),
  );
}

function getAuthErrorCode(body: unknown): string | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const directCode = (body as Record<string, unknown>).code;
  if (typeof directCode === "string" && directCode.trim()) {
    return directCode.trim();
  }

  const details = (body as Record<string, unknown>).details;
  if (!details || typeof details !== "object") {
    return null;
  }

  const detailsCode = (details as Record<string, unknown>).code;
  if (typeof detailsCode === "string" && detailsCode.trim()) {
    return detailsCode.trim();
  }

  return null;
}

function getAuthErrorMessage(body: unknown, fallbackMessage: string): string {
  if (!body || typeof body !== "object") {
    return fallbackMessage;
  }

  const error = (body as Record<string, unknown>).error;
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  const message = (body as Record<string, unknown>).message;
  if (typeof message === "string" && message.trim()) {
    return message.trim();
  }

  return fallbackMessage;
}

function normalizeResetPageUrl(rawResetPageUrl: string) {
  let resetPageUrl: URL;

  try {
    resetPageUrl = new URL(rawResetPageUrl, authConfig.appDomain);
  } catch {
    return { ok: false as const, message: "resetPageUrl must be a valid URL" };
  }

  const allowedOrigins = new Set<string>(authConfig.allowedResetPageOrigins);

  if (!allowedOrigins.has(resetPageUrl.origin)) {
    return {
      ok: false as const,
      message: "resetPageUrl must use an allowed frontend origin",
    };
  }

  return { ok: true as const, url: resetPageUrl };
}

function decodeGoogleIdTokenEmail(idToken: string) {
  const parsed = decodeGoogleIdTokenPayload(idToken);
  const email = parsed?.email;
  return typeof email === "string" && email.trim()
    ? email.trim().toLowerCase()
    : null;
}

function decodeGoogleIdTokenPayload(idToken: string) {
  const [, payload] = idToken.split(".");
  if (!payload) {
    return null;
  }

  try {
    const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decodedPayload = Buffer.from(normalizedPayload, "base64").toString(
      "utf8",
    );
    return JSON.parse(decodedPayload) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function logGoogleIdTokenProfile(idToken: string) {
  const payload = decodeGoogleIdTokenPayload(idToken);
  if (!payload) {
    console.info("Google auth profile: unable to decode ID token payload");
    return;
  }

  console.info("Google auth profile", {
    subject: payload.sub,
    email: payload.email,
    emailVerified: payload.email_verified,
    name: payload.name,
    givenName: payload.given_name,
    familyName: payload.family_name,
    picture: payload.picture,
    locale: payload.locale,
    hostedDomain: payload.hd,
  });
}

function resolveAuthFlow(user: AuthFlowUser, isNewUser: boolean): AuthFlow {
  const requiresSignupCompletion = !user.signupCompletedAt;
  const requiresOnboarding =
    !user.onboardingCompletedAt ||
    (user.onboardingStep ?? 0) < ONBOARDING_COMPLETE_STEP;

  let nextStep: AuthNextStep = "APP";
  if (requiresSignupCompletion) {
    nextStep = "COMPLETE_SIGNUP";
  } else if (requiresOnboarding) {
    nextStep = "ONBOARDING";
  }

  return {
    isNewUser,
    requiresSignupCompletion,
    requiresOnboarding,
    nextStep,
  };
}

function getUserIdFromAuthUser(user: unknown) {
  if (!user || typeof user !== "object") {
    return null;
  }

  const id = (user as Record<string, unknown>).id;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

async function withAuthFlowUser(
  user: unknown,
  isNewUser: boolean,
): Promise<{ user: unknown; authFlow?: AuthFlow }> {
  const userId = getUserIdFromAuthUser(user);
  if (!userId) {
    return { user };
  }

  const authFlowUser = await findAuthFlowUserById(userId);
  if (!authFlowUser) {
    return { user };
  }

  return {
    user:
      user && typeof user === "object"
        ? {
            ...(user as Record<string, unknown>),
            signupCompletedAt: authFlowUser.signupCompletedAt,
            onboardingCompletedAt: authFlowUser.onboardingCompletedAt,
            onboardingStep: authFlowUser.onboardingStep,
          }
        : authFlowUser,
    authFlow: resolveAuthFlow(authFlowUser, isNewUser),
  };
}

async function buildAuthTokenResponse(
  c: Context,
  refreshToken: string,
  user: unknown,
  options?: { isNewUser?: boolean },
) {
  const accessTokenResult = await getAccessTokenFromRefreshToken(refreshToken);

  if (!accessTokenResult.ok) {
    return authProviderError(
      c,
      accessTokenResult.status,
      accessTokenResult.body,
      "Failed to issue access token",
    );
  }

  const enrichedAuth = await withAuthFlowUser(user, options?.isNewUser ?? false);

  return c.json({
    accessToken: accessTokenResult.token,
    refreshToken,
    user: enrichedAuth.user,
    ...(enrichedAuth.authFlow ? { authFlow: enrichedAuth.authFlow } : {}),
  });
}

export async function handleRegister(c: Context) {
  const parsed = await parseAndValidate(c, validateRegisterPayload);
  if (!parsed.ok) {
    return parsed.response;
  }

  const existingUser = await findUserByEmail(parsed.data.email);
  if (existingUser) {
    return authProviderError(
      c,
      409,
      { error: "Email already exists" },
      "Registration failed",
    );
  }

  const registerResult = await signUpWithEmailPassword(parsed.data);

  if (!registerResult.ok) {
    return authProviderError(
      c,
      registerResult.status,
      registerResult.body,
      "Registration failed",
    );
  }

  const registeredUserId = getUserIdFromAuthUser(registerResult.body.user);
  const completedUser = registeredUserId
    ? await markUserSignUpCompleted(registeredUserId)
    : null;
  const responseUser = completedUser
    ? {
        ...(registerResult.body.user as Record<string, unknown>),
        signupCompletedAt: completedUser.signupCompletedAt,
        onboardingCompletedAt: completedUser.onboardingCompletedAt,
        onboardingStep: completedUser.onboardingStep,
      }
    : registerResult.body.user;

  const otpResult = await requestEmailVerificationOtp(parsed.data.email);

  if (!otpResult.ok) {
    return c.json(
      {
        success: true,
        message:
          "Registration successful, but we could not send the OTP due to a temporary issue. Please request a new OTP to verify your email address.",
        otpSent: false,
        user: responseUser,
      },
      201,
    );
  }

  return c.json(
    {
      success: true,
      message: "Registration successful. OTP code sent to email.",
      otpSent: true,
      user: responseUser,
    },
    201,
  );
}

export async function handleCompleteSignUp(c: Context) {
  const auth = c.get("auth") as AuthContext | undefined;
  if (!auth) {
    return c.json({ ok: false, error: "Missing bearer token" }, 401);
  }

  const parsed = await parseAndValidate(c, validateCompleteSignUpPayload);
  if (!parsed.ok) {
    return parsed.response;
  }

  const updatedUser = await completeUserSignUp(auth.userId, parsed.data);
  if (!updatedUser) {
    return c.json({ error: "User not found" }, 404);
  }

  const authFlow = resolveAuthFlow(updatedUser, false);

  return c.json({
    success: true as const,
    message: "Sign up details completed successfully.",
    user: updatedUser,
    authFlow,
  });
}

export async function handleGoogle(c: Context) {
  const parsed = await parseAndValidate(c, validateGooglePayload);
  if (!parsed.ok) {
    return parsed.response;
  }

  logGoogleIdTokenProfile(parsed.data.idToken);

  const googleEmail = decodeGoogleIdTokenEmail(parsed.data.idToken);
  const existingUser = googleEmail ? await findUserByEmail(googleEmail) : null;
  const googleResult = await signInWithGoogleIdToken(parsed.data);

  if (!googleResult.ok) {
    return authProviderError(
      c,
      googleResult.status,
      googleResult.body,
      "Google authentication failed",
    );
  }

  const userEmail =
    googleResult.body.user &&
    typeof googleResult.body.user === "object" &&
    typeof (googleResult.body.user as Record<string, unknown>).email ===
      "string"
      ? ((googleResult.body.user as Record<string, unknown>).email as string)
          .trim()
          .toLowerCase()
      : null;
  const isNewUser =
    Boolean(userEmail) &&
    (!existingUser || existingUser.email.toLowerCase() !== userEmail);

  return buildAuthTokenResponse(
    c,
    googleResult.body.token,
    googleResult.body.user,
    { isNewUser },
  );
}

export async function handleVerifyRegisterOtp(c: Context) {
  const parsed = await parseAndValidate(c, validateVerifyRegisterOtpPayload);
  if (!parsed.ok) {
    return parsed.response;
  }

  const verifyResult = await verifyRegisterOtp(parsed.data);

  if (!verifyResult.ok) {
    return authProviderError(
      c,
      verifyResult.status,
      verifyResult.body,
      "OTP code check failed",
    );
  }

  return buildAuthTokenResponse(
    c,
    verifyResult.body.token,
    verifyResult.body.user,
  );
}

export async function handleResendRegisterOtp(c: Context) {
  const parsed = await parseAndValidate(c, validateResendRegisterOtpPayload);
  if (!parsed.ok) {
    return parsed.response;
  }

  // For security and privacy, we return the same generic success response regardless of whether the email exists or not.
  // This prevents potential attackers from enumerating valid email addresses in our system.
  const genericResponse = {
    success: true,
    message:
      "If this email is eligible, we sent an OTP code. Please check your inbox.",
  };

  const foundUser = await findUserByEmail(parsed.data.email);

  if (!foundUser || foundUser.emailVerified) {
    return c.json(genericResponse, 200);
  }

  try {
    await revokeEmailVerificationOtp(parsed.data.email);
  } catch (error) {
    console.error("Failed to revoke previous email verification OTP:", error);
  }

  const otpResult = await requestEmailVerificationOtp(parsed.data.email);

  if (!otpResult.ok) {
    return c.json(genericResponse, 200);
  }

  return c.json(genericResponse, 200);
}

export async function handleLogin(c: Context) {
  const parsed = await parseAndValidate(c, validateLoginPayload);
  if (!parsed.ok) {
    return parsed.response;
  }

  const loginResult = await signInWithEmailPassword(parsed.data);

  if (!loginResult.ok) {
    const errorCode = getAuthErrorCode(loginResult.body);

    if (errorCode === "EMAIL_NOT_VERIFIED") {
      let otpSent = false;
      const foundUser = await findUserByEmail(parsed.data.email);

      if (foundUser && !foundUser.emailVerified) {
        try {
          await revokeEmailVerificationOtp(parsed.data.email);
        } catch (error) {
          console.error(
            "Failed to revoke previous email verification OTP:",
            error,
          );
        }

        const otpResult = await requestEmailVerificationOtp(parsed.data.email);
        otpSent = otpResult.ok;
      }

      return c.json(
        {
          error: "Email not verified",
          code: "EMAIL_NOT_VERIFIED",
          otpSent,
          message: otpSent
            ? "OTP sent. Please use it to verify your email."
            : "Email not verified. Please request a new OTP.",
        },
        403,
      );
    }

    return authProviderError(
      c,
      loginResult.status,
      loginResult.body,
      "Login failed",
    );
  }

  return buildAuthTokenResponse(
    c,
    loginResult.body.token,
    loginResult.body.user,
  );
}

export async function handleRefresh(c: Context) {
  const parsed = await parseAndValidate(c, validateRefreshPayload);
  if (!parsed.ok) {
    return parsed.response;
  }

  const accessTokenResult = await getAccessTokenFromRefreshToken(
    parsed.data.refreshToken,
  );

  if (!accessTokenResult.ok) {
    return authProviderError(
      c,
      accessTokenResult.status,
      accessTokenResult.body,
      "Token refresh failed",
    );
  }

  return c.json({
    accessToken: accessTokenResult.token,
    refreshToken: parsed.data.refreshToken,
  });
}

export async function handleForgotPassword(c: Context) {
  const parsed = await parseAndValidate(c, validateForgotPasswordPayload);
  if (!parsed.ok) {
    return parsed.response;
  }

  const resetPageUrl = normalizeResetPageUrl(parsed.data.resetPageUrl);
  if (!resetPageUrl.ok) {
    return c.json({ error: resetPageUrl.message }, 400);
  }

  const passwordResetResult = await requestPasswordReset({
    email: parsed.data.email,
    resetPageUrl: resetPageUrl.url.toString(),
  });

  if (!passwordResetResult.ok) {
    console.error("Password reset request failed", {
      error: getAuthErrorMessage(
        passwordResetResult.body,
        "Failed to request password reset",
      ),
      code: getAuthErrorCode(passwordResetResult.body),
      status: passwordResetResult.status,
    });
    return c.json(genericForgotPasswordResponse, 200);
  }

  return c.json(genericForgotPasswordResponse, 200);
}

export async function handleResetPassword(c: Context) {
  const parsed = await parseAndValidate(c, validateResetPasswordPayload);
  if (!parsed.ok) {
    return parsed.response;
  }

  const resetResult = await resetPassword(parsed.data);

  if (!resetResult.ok) {
    return c.json(
      {
        error: getAuthErrorMessage(
          resetResult.body,
          "Failed to reset password",
        ),
      },
      400,
    );
  }

  return c.json(
    {
      success: true,
      message: "Password reset successful.",
    },
    200,
  );
}
