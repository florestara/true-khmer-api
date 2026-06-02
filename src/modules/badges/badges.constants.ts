export const BADGE_DEFINITIONS = [
  {
    slug: "profile-complete",
    name: "Profile Complete",
    description: "Add a profile photo, bio, location, and at least one skill.",
    category: "ONBOARDING",
  },
  {
    slug: "first-contribution",
    name: "First Contribution",
    description: "Complete the first meaningful contribution to the community.",
    category: "COLLABORATION",
  },
  {
    slug: "best-answer",
    name: "Best Answer",
    description: "Have 20 forum answers selected as Best Answer.",
    category: "KNOWLEDGE",
  },
  {
    slug: "team-player",
    name: "Team Player",
    description: "Complete 3 Launchpad projects as a participant.",
    category: "LAUNCHPAD",
  },
  {
    slug: "project-champion",
    name: "Project Champion",
    description: "Complete 10 Launchpad projects as a participant.",
    category: "LAUNCHPAD",
  },
  {
    slug: "new-volunteer",
    name: "New Volunteer",
    description: "Complete 10 volunteer opportunities.",
    category: "VOLUNTEER",
  },
  {
    slug: "dedicated-volunteer",
    name: "Dedicated Volunteer",
    description: "Complete 50 volunteer opportunities.",
    category: "VOLUNTEER",
  },
  {
    slug: "master-volunteer",
    name: "Master Volunteer",
    description: "Complete 100 volunteer opportunities.",
    category: "VOLUNTEER",
  },
  {
    slug: "builder",
    name: "Builder",
    description: "Successfully complete a Launchpad project as its proposer.",
    category: "LAUNCHPAD",
  },
] as const;

export type BadgeSlug = (typeof BADGE_DEFINITIONS)[number]["slug"];
