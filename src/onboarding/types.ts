export type OnboardingStep = 0 | 1 | 2 | 3 | 4;

export type OnboardingStateDto = {
  user: {
    id: string;
    email: string;
    role: string;
    onboardingStep: number;
    onboardingCompletedAt: Date | null;
  };
  profile: {
    id: string;
    userId: string;
    displayName: string | null;
    avatarKey: string | null;
    avatarUrl: string | null;
    bio: string | null;
    countryId: string | null;
    cityId: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  selectedInterestIds: string[];
  selectedContributionIds: string[];
  progress: {
    totalPoints: number;
    tier: {
      id: string;
      slug: string;
      name: string;
      rankOrder: number;
      minPoints: number;
    } | null;
  };
};

export type OnboardingOptionsDto = {
  interests: Array<{
    id: string;
    slug: string;
    label: string;
    icon: string;
  }>;
  contributions: Array<{
    id: string;
    slug: string;
    name: string;
    iconKey: string;
    description: string | null;
  }>;
  tiers: Array<{
    id: string;
    slug: string;
    name: string;
    rankOrder: number;
    minPoints: number;
    description: string | null;
  }>;
};

export type InterestOptionDto = {
  id: string;
  slug: string;
  label: string;
  icon: string;
};

export type ContributionOptionDto = {
  id: string;
  slug: string;
  name: string;
  iconKey: string;
  description: string | null;
};

export type CountryListItemDto = {
  id: string;
  name: string;
  iso2: string | null;
};

export type CityListItemDto = {
  id: string;
  countryId: string;
  name: string;
};
