import { z } from "zod";

export const savedLaunchpadListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  deadline: z.date().nullable(),
  logoKey: z.string().nullable(),
  coverKey: z.string().nullable(),
  documentKeys: z.array(z.string()),
  documentNames: z.array(z.string()),
  phoneNumber: z.string().nullable(),
  email: z.string().nullable(),
  telegramUsername: z.string().nullable(),
  createdBy: z.object({
    id: z.string(),
    name: z.string(),
    avatarKey: z.string().nullable(),
    launchpadCount: z.number(),
  }),
  createdAt: z.date(),
  category: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .optional(),
  city: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .optional(),
  totalRoles: z.number(),
  totalView: z.number(),
  isSaved: z.literal(true),
  savedAt: z.date(),
});

export const getSavedLaunchpadsResponseSchema = z
  .object({
    ok: z.literal(true),
    launchpads: z.array(savedLaunchpadListItemSchema),
    nextCursor: z.string().nullable(),
  })
  .openapi("GetSavedLaunchpadsResponse");

export const saveLaunchpadResponseSchema = z
  .object({
    ok: z.literal(true),
  })
  .openapi("SaveLaunchpadResponse");