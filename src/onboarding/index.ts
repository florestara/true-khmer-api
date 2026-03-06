import { Hono } from "hono";
import { requireAccessTokenAllowIncompleteOnboarding } from "../auth/middleware";
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
} from "./handler";
import {
  onboardingContributionsStepValidator,
  onboardingInterestsStepValidator,
  onboardingProfileStepValidator,
} from "./validator";

const onboardingRoute = new Hono();

onboardingRoute.use("*", requireAccessTokenAllowIncompleteOnboarding);
onboardingRoute.get("/options", handleGetOnboardingOptions);
onboardingRoute.get("/interests", handleGetInterests);
onboardingRoute.get("/contributions", handleGetContributions);
onboardingRoute.get("/locations/countries", handleGetCountries);
onboardingRoute.get("/locations/cities", handleGetCities);
onboardingRoute.get("/state", handleGetOnboardingState);
onboardingRoute.put(
  "/step-1-profile",
  onboardingProfileStepValidator,
  async (c) => {
    const payload = c.req.valid("json");
    return handleSaveProfileStep(c, payload);
  },
);
onboardingRoute.put(
  "/step-2-interests",
  onboardingInterestsStepValidator,
  async (c) => {
    const payload = c.req.valid("json");
    return handleSaveInterestsStep(c, payload);
  },
);
onboardingRoute.put(
  "/step-3-contributions",
  onboardingContributionsStepValidator,
  async (c) => {
    const payload = c.req.valid("json");
    return handleSaveContributionsStep(c, payload);
  },
);
onboardingRoute.put("/step-4-complete", handleCompleteOnboarding);

export default onboardingRoute;
