import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import type { AppBindings } from "../../lib/types";
import { requireAccessTokenAllowIncompleteOnboarding } from "../../middlewares/auth.middleware";
import { authProtectedErrorResponseSchema } from "../auth/auth.schema";
import {
  handleCompleteOnboarding,
  handleGetCities,
  handleGetContributions,
  handleGetCountries,
  handleGetInterests,
  handleGetOnboardingOptions,
  handleGetOnboardingState,
  handleSaveContributionsStep,
  handleSaveInterestsStep,
  handleSaveProfileStep,
} from "./onboarding.service";
import {
  onboardingErrorResponseSchema,
  onboardingContributionsStepSchema,
  onboardingInterestsStepSchema,
  onboardingOkResponseSchema,
  onboardingProfileStepSchema,
} from "./onboarding.schema";

export const onboardingRouter = new OpenAPIHono<AppBindings>();

const optionsRoute = createRoute({
  method: "get",
  path: "/options",
  middleware: [requireAccessTokenAllowIncompleteOnboarding],
  tags: ["Onboarding"],
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: "Onboarding options",
      content: {
        "application/json": {
          schema: onboardingOkResponseSchema,
        },
      },
    },
  },
});

const interestsRoute = createRoute({
  method: "get",
  path: "/interests",
  middleware: [requireAccessTokenAllowIncompleteOnboarding],
  tags: ["Onboarding"],
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: "Available interests",
      content: {
        "application/json": {
          schema: onboardingOkResponseSchema,
        },
      },
    },
  },
});

const contributionsRoute = createRoute({
  method: "get",
  path: "/contributions",
  middleware: [requireAccessTokenAllowIncompleteOnboarding],
  tags: ["Onboarding"],
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: "Available contributions",
      content: {
        "application/json": {
          schema: onboardingOkResponseSchema,
        },
      },
    },
  },
});

const countriesRoute = createRoute({
  method: "get",
  path: "/locations/countries",
  tags: ["Onboarding"],
  middleware: [requireAccessTokenAllowIncompleteOnboarding],
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: "List of countries",
      content: {
        "application/json": {
          schema: onboardingOkResponseSchema,
        },
      },
    },
  },
});

const citiesRoute = createRoute({
  method: "get",
  path: "/locations/cities",
  tags: ["Onboarding"],
  middleware: [requireAccessTokenAllowIncompleteOnboarding],
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: "List of cities",
      content: {
        "application/json": {
          schema: onboardingOkResponseSchema,
        },
      },
    },
    400: {
      description: "countryId or countryName missing",
      content: {
        "application/json": {
          schema: onboardingErrorResponseSchema,
        },
      },
    },
  },
});

const stateRoute = createRoute({
  method: "get",
  path: "/state",
  tags: ["Onboarding"],
  middleware: [requireAccessTokenAllowIncompleteOnboarding],
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: "User onboarding state",
      content: {
        "application/json": {
          schema: onboardingOkResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: authProtectedErrorResponseSchema,
        },
      },
    },
    404: {
      description: "User not found",
      content: {
        "application/json": {
          schema: onboardingErrorResponseSchema,
        },
      },
    },
  },
});

const profileRoute = createRoute({
  method: "put",
  path: "/step-1-profile",
  tags: ["Onboarding"],
  middleware: [requireAccessTokenAllowIncompleteOnboarding],
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: { "application/json": { schema: onboardingProfileStepSchema } },
    },
  },
  responses: {
    200: {
      description: "Profile step saved",
      content: {
        "application/json": {
          schema: onboardingOkResponseSchema,
        },
      },
    },
    400: {
      description: "Validation failed",
      content: {
        "application/json": {
          schema: onboardingErrorResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: authProtectedErrorResponseSchema,
        },
      },
    },
    404: {
      description: "User not found",
      content: {
        "application/json": {
          schema: onboardingErrorResponseSchema,
        },
      },
    },
  },
});

const interestsStepRoute = createRoute({
  method: "put",
  path: "/step-2-interests",
  tags: ["Onboarding"],
  middleware: [requireAccessTokenAllowIncompleteOnboarding],
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": { schema: onboardingInterestsStepSchema },
      },
    },
  },
  responses: {
    200: {
      description: "Interests step saved",
      content: {
        "application/json": {
          schema: onboardingOkResponseSchema,
        },
      },
    },
    400: {
      description: "Validation failed",
      content: {
        "application/json": {
          schema: onboardingErrorResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: authProtectedErrorResponseSchema,
        },
      },
    },
    404: {
      description: "User not found",
      content: {
        "application/json": {
          schema: onboardingErrorResponseSchema,
        },
      },
    },
  },
});

const contributionsStepRoute = createRoute({
  method: "put",
  path: "/step-3-contributions",
  tags: ["Onboarding"],
  middleware: [requireAccessTokenAllowIncompleteOnboarding],
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": { schema: onboardingContributionsStepSchema },
      },
    },
  },
  responses: {
    200: {
      description: "Contributions step saved",
      content: {
        "application/json": {
          schema: onboardingOkResponseSchema,
        },
      },
    },
    400: {
      description: "Validation failed",
      content: {
        "application/json": {
          schema: onboardingErrorResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: authProtectedErrorResponseSchema,
        },
      },
    },
    404: {
      description: "User not found",
      content: {
        "application/json": {
          schema: onboardingErrorResponseSchema,
        },
      },
    },
  },
});

const completeRoute = createRoute({
  method: "put",
  path: "/step-4-complete",
  tags: ["Onboarding"],
  middleware: [requireAccessTokenAllowIncompleteOnboarding],
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: "Onboarding completed",
      content: {
        "application/json": {
          schema: onboardingOkResponseSchema,
        },
      },
    },
    400: {
      description: "Onboarding prerequisites not complete",
      content: {
        "application/json": {
          schema: onboardingErrorResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: authProtectedErrorResponseSchema,
        },
      },
    },
  },
});

onboardingRouter.openapi(optionsRoute, async (c) => {
  return (await handleGetOnboardingOptions(c)) as any;
});
onboardingRouter.openapi(interestsRoute, async (c) => {
  return (await handleGetInterests(c)) as any;
});
onboardingRouter.openapi(contributionsRoute, async (c) => {
  return (await handleGetContributions(c)) as any;
});
onboardingRouter.openapi(countriesRoute, async (c) => {
  return (await handleGetCountries(c)) as any;
});
onboardingRouter.openapi(citiesRoute, async (c) => {
  return (await handleGetCities(c)) as any;
});
onboardingRouter.openapi(stateRoute, async (c) => {
  return (await handleGetOnboardingState(c)) as any;
});
onboardingRouter.openapi(profileRoute, async (c) => {
  const payload = c.req.valid("json");
  return (await handleSaveProfileStep(c, payload)) as any;
});
onboardingRouter.openapi(interestsStepRoute, async (c) => {
  const payload = c.req.valid("json");
  return (await handleSaveInterestsStep(c, payload)) as any;
});
onboardingRouter.openapi(contributionsStepRoute, async (c) => {
  const payload = c.req.valid("json");
  return (await handleSaveContributionsStep(c, payload)) as any;
});
onboardingRouter.openapi(completeRoute, async (c) => {
  return (await handleCompleteOnboarding(c)) as any;
});
