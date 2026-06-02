import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../db/index";
import {
  badge,
  city,
  country,
  skill,
  tier,
  user,
  userProfile,
  userProgress,
  userSkill,
  userSocialLink,
  userBadge,
} from "../../db/schema";
import type { UpdateProfilePayload } from "./profile.schema";
import { evaluateProfileCompleteBadge } from "../badges/badges.service";
import { countQuestionsPostedByUserId } from "../forum/questions/questions.query";
import { countLaunchpadsPostedByUserId } from "../launchpad/launchpad.query";
import { countVolunteerOpportunitiesPostedByUserId } from "../volunteer/post-volunteer/post-volunteer.query";

type NormalizedSkill = {
  name: string;
  normalizedName: string;
};

const SOCIAL_LINK_PLATFORMS = [
  "website",
  "linkedin",
  "twitter",
  "facebook",
] as const;

function normalizeSkillName(value: string): NormalizedSkill {
  const name = value.trim().replace(/\s+/g, " ");
  return {
    name,
    normalizedName: name.toLowerCase(),
  };
}

function computeDisplayName(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`.trim();
}

async function replaceUserSkills(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  userId: string,
  skills: string[],
) {
  const normalizedSkills = Array.from(
    new Map(
      skills.map((item) => {
        const normalized = normalizeSkillName(item);
        return [normalized.normalizedName, normalized];
      }),
    ).values(),
  );

  await tx.delete(userSkill).where(eq(userSkill.userId, userId));

  if (normalizedSkills.length === 0) {
    return;
  }

  await tx
    .insert(skill)
    .values(normalizedSkills)
    .onConflictDoNothing({ target: skill.normalizedName });

  const skillRows = await tx
    .select({ id: skill.id })
    .from(skill)
    .where(
      inArray(
        skill.normalizedName,
        normalizedSkills.map((item) => item.normalizedName),
      ),
    );

  if (skillRows.length === 0) {
    return;
  }

  await tx
    .insert(userSkill)
    .values(
      skillRows.map((row) => ({
        userId,
        skillId: row.id,
      })),
    )
    .onConflictDoNothing({
      target: [userSkill.userId, userSkill.skillId],
    });
}

async function updateUserSocialLinks(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  userId: string,
  socialLinks: NonNullable<UpdateProfilePayload["socialLinks"]>,
) {
  for (const platform of SOCIAL_LINK_PLATFORMS) {
    if (!(platform in socialLinks)) {
      continue;
    }

    const url = socialLinks[platform];
    if (!url) {
      await tx
        .delete(userSocialLink)
        .where(
          and(
            eq(userSocialLink.userId, userId),
            eq(userSocialLink.platform, platform),
          ),
        );
      continue;
    }

    await tx
      .insert(userSocialLink)
      .values({
        userId,
        platform,
        url,
      })
      .onConflictDoUpdate({
        target: [userSocialLink.userId, userSocialLink.platform],
        set: {
          url,
          updatedAt: new Date(),
        },
      });
  }
}

export async function getProfile(userId: string) {
  const [userRow] = await db
    .select({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      gender: user.gender,
      dateOfBirth: user.dateOfBirth,
      occupation: user.occupation,
      phoneNumber: user.phoneNumber,
      telegramUsername: user.telegramUsername,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (!userRow) {
    return null;
  }

  const [profileRows, skillRows, socialRows, progressRows, badgeRows] = await Promise.all([
    db
      .select({
        displayName: userProfile.displayName,
        avatarKey: userProfile.avatarKey,
        avatarUrl: userProfile.avatarUrl,
        bio: userProfile.bio,
        countryId: country.id,
        countryName: country.name,
        countryIso2: country.iso2,
        cityId: city.id,
        cityName: city.name,
        profileVisibility: userProfile.profileVisibility,
        contactVisibility: userProfile.contactVisibility,
        socialLinksVisibility: userProfile.socialLinksVisibility,
        contributionVisibility: userProfile.contributionVisibility,
      })
      .from(userProfile)
      .leftJoin(country, eq(userProfile.countryId, country.id))
      .leftJoin(city, eq(userProfile.cityId, city.id))
      .where(eq(userProfile.userId, userId))
      .limit(1),
    db
      .select({
        id: skill.id,
        name: skill.name,
      })
      .from(userSkill)
      .innerJoin(skill, eq(userSkill.skillId, skill.id))
      .where(eq(userSkill.userId, userId))
      .orderBy(skill.name),
    db
      .select({
        platform: userSocialLink.platform,
        url: userSocialLink.url,
      })
      .from(userSocialLink)
      .where(eq(userSocialLink.userId, userId)),
    db
      .select({
        totalPoints: userProgress.totalPoints,
        rank:
          sql<number>`1 + (select count(*)::int from ${userProgress} up where up.total_points > ${userProgress.totalPoints})`,
        tierId: tier.id,
        tierSlug: tier.slug,
        tierName: tier.name,
        tierRankOrder: tier.rankOrder,
        tierMinPoints: tier.minPoints,
      })
      .from(userProgress)
      .leftJoin(tier, eq(userProgress.currentTierId, tier.id))
      .where(eq(userProgress.userId, userId))
      .orderBy(desc(userProgress.totalPoints))
      .limit(1),
    db
      .select({
        slug: badge.slug,
        name: badge.name,
        description: badge.description,
        category: badge.category,
        awardedAt: userBadge.awardedAt,
      })
      .from(userBadge)
      .innerJoin(badge, eq(badge.id, userBadge.badgeId))
      .where(eq(userBadge.userId, userId))
      .orderBy(desc(userBadge.awardedAt), badge.name),
  ]);

  const profileRow = profileRows[0];
  const progressRow = progressRows[0];
  const socialLinks = {
    website: null as string | null,
    linkedin: null as string | null,
    twitter: null as string | null,
    facebook: null as string | null,
  };

  for (const row of socialRows) {
    socialLinks[row.platform] = row.url;
  }

  return {
    user: {
      ...userRow,
      displayName:
        profileRow?.displayName ?? computeDisplayName(userRow.firstName, userRow.lastName),
    },
    profile: {
      avatarKey: profileRow?.avatarKey ?? null,
      avatarUrl: profileRow?.avatarUrl ?? null,
      bio: profileRow?.bio ?? null,
      country: profileRow?.countryId
        ? {
            id: profileRow.countryId,
            name: profileRow.countryName!,
            iso2: profileRow.countryIso2,
          }
        : null,
      city: profileRow?.cityId
        ? {
            id: profileRow.cityId,
            name: profileRow.cityName!,
          }
        : null,
      visibility: {
        profile: profileRow?.profileVisibility ?? "public",
        contact: profileRow?.contactVisibility ?? "members",
        socialLinks: profileRow?.socialLinksVisibility ?? "members",
        contributions: profileRow?.contributionVisibility ?? "public",
      },
    },
    skills: skillRows,
    socialLinks,
    progress: {
      totalPoints: progressRow?.totalPoints ?? 0,
      rank: progressRow?.rank ?? null,
      tier:
        progressRow?.tierId &&
        progressRow.tierSlug &&
        progressRow.tierName &&
        progressRow.tierRankOrder !== null &&
        progressRow.tierMinPoints !== null
          ? {
              id: progressRow.tierId,
              slug: progressRow.tierSlug,
              name: progressRow.tierName,
              rankOrder: progressRow.tierRankOrder,
              minPoints: progressRow.tierMinPoints,
            }
          : null,
    },
    badges: badgeRows,
  };
}

export async function getPublicProfile(userId: string) {
  const profile = await getProfile(userId);
  if (!profile) {
    return null;
  }

  const postedCounts = await Promise.all([
    countQuestionsPostedByUserId(userId),
    countVolunteerOpportunitiesPostedByUserId(userId),
    countLaunchpadsPostedByUserId(userId),
  ]);

  return {
    profile: {
      user: {
        id: profile.user.id,
        firstName: profile.user.firstName,
        lastName: profile.user.lastName,
        displayName: profile.user.displayName,
        occupation: profile.user.occupation,
        email: profile.user.email,
        phoneNumber: profile.user.phoneNumber,
        telegramUsername: profile.user.telegramUsername,
      },
      profile: {
        avatarKey: profile.profile.avatarKey,
        avatarUrl: profile.profile.avatarUrl,
        bio: profile.profile.bio,
        country: profile.profile.country,
        city: profile.profile.city,
      },
      skills: profile.skills,
      socialLinks: profile.socialLinks,
      tier: profile.progress.tier,
      postedCounts: {
        forum: postedCounts[0],
        volunteer: postedCounts[1],
        project: postedCounts[2],
      },
    },
  };
}

export async function profileUserExists(userId: string) {
  const [profile] = await db
    .select({
      userId: user.id,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  return Boolean(profile);
}

export async function updateProfile(
  userId: string,
  payload: UpdateProfilePayload & {
    avatarUrl?: string | null;
    countryId?: string;
    cityId?: string;
  },
) {
  const updated = await db.transaction(async (tx) => {
    const [existingUser] = await tx
      .select({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!existingUser) {
      return false;
    }

    const userUpdate: Partial<typeof user.$inferInsert> = {};

    if (payload.firstName !== undefined) userUpdate.firstName = payload.firstName;
    if (payload.lastName !== undefined) userUpdate.lastName = payload.lastName;
    if (payload.gender !== undefined) userUpdate.gender = payload.gender;
    if (payload.dateOfBirth !== undefined) userUpdate.dateOfBirth = payload.dateOfBirth;
    if (payload.occupation !== undefined) userUpdate.occupation = payload.occupation ?? "";
    if (payload.phoneNumber !== undefined) userUpdate.phoneNumber = payload.phoneNumber;
    if (payload.telegramUsername !== undefined) {
      userUpdate.telegramUsername = payload.telegramUsername;
    }

    if (Object.keys(userUpdate).length > 0) {
      if (userUpdate.firstName !== undefined || userUpdate.lastName !== undefined) {
        userUpdate.name = computeDisplayName(
          userUpdate.firstName ?? existingUser.firstName,
          userUpdate.lastName ?? existingUser.lastName,
        );
      }

      await tx.update(user).set(userUpdate).where(eq(user.id, userId));
    }

    const profileUpdate: Partial<typeof userProfile.$inferInsert> = {};
    const shouldSyncDisplayName =
      payload.firstName !== undefined || payload.lastName !== undefined;

    if (shouldSyncDisplayName) {
      profileUpdate.displayName = computeDisplayName(
        userUpdate.firstName ?? existingUser.firstName,
        userUpdate.lastName ?? existingUser.lastName,
      );
    }

    if (payload.avatarKey !== undefined) {
      profileUpdate.avatarKey = payload.avatarKey;
      profileUpdate.avatarUrl = payload.avatarUrl ?? null;
    }
    if (payload.bio !== undefined) profileUpdate.bio = payload.bio;
    if (payload.countryId !== undefined) profileUpdate.countryId = payload.countryId;
    if (payload.cityId !== undefined) profileUpdate.cityId = payload.cityId;
    if (payload.visibility?.profile !== undefined) {
      profileUpdate.profileVisibility = payload.visibility.profile;
    }
    if (payload.visibility?.contact !== undefined) {
      profileUpdate.contactVisibility = payload.visibility.contact;
    }
    if (payload.visibility?.socialLinks !== undefined) {
      profileUpdate.socialLinksVisibility = payload.visibility.socialLinks;
    }
    if (payload.visibility?.contributions !== undefined) {
      profileUpdate.contributionVisibility = payload.visibility.contributions;
    }

    if (Object.keys(profileUpdate).length > 0) {
      await tx
        .insert(userProfile)
        .values({
          userId,
          ...profileUpdate,
        })
        .onConflictDoUpdate({
          target: userProfile.userId,
          set: {
            ...profileUpdate,
            updatedAt: new Date(),
          },
        });
    }

    if (payload.skills !== undefined) {
      await replaceUserSkills(tx, userId, payload.skills);
    }

    if (payload.socialLinks !== undefined) {
      await updateUserSocialLinks(tx, userId, payload.socialLinks);
    }

    return true;
  });

  if (!updated) {
    return null;
  }

  await evaluateProfileCompleteBadge(userId).catch((err) =>
    console.error("Failed to evaluate profile complete badge", err),
  );

  return getProfile(userId);
}
