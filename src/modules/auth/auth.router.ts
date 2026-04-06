import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import type { AppBindings } from "../../lib/types";
import {
  handleForgotPassword,
  handleLogin,
  handleRefresh,
  handleRegister,
  handleResetPassword,
  handleResendRegisterOtp,
  handleVerifyRegisterOtp,
} from "./auth.service";
import {
  authSimpleErrorResponseSchema,
  authTokenResponseSchema,
  refreshSuccessResponseSchema,
  registerSuccessResponseSchema,
  resendRegisterOtpResponseSchema,
  forgotPasswordResponseSchema,
  resetPasswordResponseSchema,
  authRegisterSchema,
  authVerifyRegisterOtpSchema,
  authResendRegisterOtpSchema,
  authLoginSchema,
  authForgotPasswordSchema,
  authResetPasswordSchema,
  authRefreshSchema,
} from "./auth.schema";

export const authRouter = new OpenAPIHono<AppBindings>();

const registerRoute = createRoute({
  method: "post",
  path: "/register",
  tags: ["Auth"],
  request: {
    body: {
      content: { "application/json": { schema: authRegisterSchema } },
    },
  },
  responses: {
    201: {
      description: "User registered successfully",
      content: {
        "application/json": {
          schema: registerSuccessResponseSchema,
        },
      },
    },
    400: { description: "Validation failed" },
  },
});

const verifyOtpRoute = createRoute({
  method: "post",
  path: "/register/verify-otp",
  tags: ["Auth"],
  request: {
    body: {
      content: { "application/json": { schema: authVerifyRegisterOtpSchema } },
    },
  },
  responses: {
    200: {
      description: "OTP verified successfully",
      content: {
        "application/json": {
          schema: authTokenResponseSchema,
        },
      },
    },
    400: { description: "Invalid OTP" },
  },
});

const resendOtpRoute = createRoute({
  method: "post",
  path: "/register/resend-otp",
  tags: ["Auth"],
  request: {
    body: {
      content: { "application/json": { schema: authResendRegisterOtpSchema } },
    },
  },
  responses: {
    200: {
      description: "OTP resent successfully",
      content: {
        "application/json": {
          schema: resendRegisterOtpResponseSchema,
        },
      },
    },
    400: {
      description: "Invalid email",
      content: {
        "application/json": {
          schema: authSimpleErrorResponseSchema,
        },
      },
    },
  },
});

const loginRoute = createRoute({
  method: "post",
  path: "/login",
  tags: ["Auth"],
  request: {
    body: {
      content: { "application/json": { schema: authLoginSchema } },
    },
  },
  responses: {
    200: {
      description: "Login successful",
      content: {
        "application/json": {
          schema: authTokenResponseSchema,
        },
      },
    },
    401: { description: "Invalid credentials" },
  },
});

const refreshRoute = createRoute({
  method: "post",
  path: "/refresh",
  tags: ["Auth"],
  request: {
    body: {
      content: { "application/json": { schema: authRefreshSchema } },
    },
  },
  responses: {
    200: {
      description: "Token refreshed successfully",
      content: {
        "application/json": {
          schema: refreshSuccessResponseSchema,
        },
      },
    },
    401: { description: "Invalid refresh token" },
  },
});

const forgotPasswordRoute = createRoute({
  method: "post",
  path: "/forgot-password",
  tags: ["Auth"],
  request: {
    body: {
      content: { "application/json": { schema: authForgotPasswordSchema } },
    },
  },
  responses: {
    200: {
      description: "Password reset request accepted",
      content: {
        "application/json": {
          schema: forgotPasswordResponseSchema,
        },
      },
    },
    400: {
      description: "Validation failed",
      content: {
        "application/json": {
          schema: authSimpleErrorResponseSchema,
        },
      },
    },
  },
});

const resetPasswordRoute = createRoute({
  method: "post",
  path: "/reset-password",
  tags: ["Auth"],
  request: {
    body: {
      content: { "application/json": { schema: authResetPasswordSchema } },
    },
  },
  responses: {
    200: {
      description: "Password reset completed successfully",
      content: {
        "application/json": {
          schema: resetPasswordResponseSchema,
        },
      },
    },
    400: {
      description: "Validation failed or token is invalid",
      content: {
        "application/json": {
          schema: authSimpleErrorResponseSchema,
        },
      },
    },
  },
});

authRouter.openapi(registerRoute, handleRegister);
authRouter.openapi(verifyOtpRoute, handleVerifyRegisterOtp);
authRouter.openapi(resendOtpRoute, handleResendRegisterOtp);
authRouter.openapi(loginRoute, handleLogin);
authRouter.openapi(refreshRoute, handleRefresh);
authRouter.openapi(forgotPasswordRoute, handleForgotPassword);
authRouter.openapi(resetPasswordRoute, handleResetPassword);
