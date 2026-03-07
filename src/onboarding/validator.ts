import {
  onboardingContributionsStepSchema,
  onboardingInterestsStepSchema,
  onboardingProfileStepSchema,
} from "./schema";
import { createJsonSchemaValidator } from "../utils/create-json-schema-validator";

export const onboardingProfileStepValidator = createJsonSchemaValidator(
  onboardingProfileStepSchema,
);

export const onboardingInterestsStepValidator = createJsonSchemaValidator(
  onboardingInterestsStepSchema,
);

export const onboardingContributionsStepValidator = createJsonSchemaValidator(
  onboardingContributionsStepSchema,
);
