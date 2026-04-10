import { z } from "zod";

export const onboardingOkResponseSchema = z
  .object({
    ok: z.literal(true),
  })
  .loose()
  .openapi("OnboardingOkResponse");

export const onboardingErrorResponseSchema = z
  .object({
    ok: z.literal(false),
    error: z.string(),
  })
  .loose()
  .openapi("OnboardingErrorResponse");
