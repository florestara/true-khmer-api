export const ONBOARDING_PROFILE_STEP = 1;
export const ONBOARDING_INTERESTS_STEP = 2;
export const ONBOARDING_CONTRIBUTIONS_STEP = 3;
export const ONBOARDING_COMPLETE_STEP = 4;

export const CONTRIBUTION_KEY_OPTIONS = [
  "community_member",
  "find_volunteers",
  "launch_project",
  "organize_event",
] as const;

export type ContributionKey = (typeof CONTRIBUTION_KEY_OPTIONS)[number];
