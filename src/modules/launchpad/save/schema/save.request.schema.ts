import { z } from "zod";
import { FORUM_UUID_RE } from "../../../forum/lib/constants";

const MAX_LAUNCHPADS_PAGE_SIZE = 50;
const DEFAULT_LAUNCHPADS_PAGE_SIZE = 20;

export type SavedLaunchpadsPageCursor = {
  savedAt: string;
  launchpadId: string;
};

const normalizeSavedLaunchpadsCursorTimestamp = (value: string) => {
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
};

const savedLaunchpadsPageCursorSchema = z.object({
  savedAt: z.string().min(1),
  launchpadId: z.string().regex(FORUM_UUID_RE),
});

export function encodeSavedLaunchpadsPageCursor(
  cursor: SavedLaunchpadsPageCursor,
): string {
  const savedAt = normalizeSavedLaunchpadsCursorTimestamp(cursor.savedAt);
  if (!savedAt) {
    throw new Error(
      "Cannot encode saved launchpads page cursor with invalid savedAt",
    );
  }

  return Buffer.from(
    JSON.stringify({
      savedAt,
      launchpadId: cursor.launchpadId,
    }),
    "utf8",
  ).toString("base64url");
}

function decodeSavedLaunchpadsPageCursor(
  raw: string,
): SavedLaunchpadsPageCursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    const cursor = savedLaunchpadsPageCursorSchema.safeParse(parsed);
    return cursor.success ? cursor.data : null;
  } catch {
    return null;
  }
}

export const getSavedLaunchpadsQuerySchema = z
  .object({
    limit: z.coerce
      .number()
      .int()
      .min(1, "limit must be between 1 and 50")
      .max(MAX_LAUNCHPADS_PAGE_SIZE, "limit must be between 1 and 50")
      .default(DEFAULT_LAUNCHPADS_PAGE_SIZE),
    cursor: z.string().optional().transform((value, ctx) => {
      if (value === undefined) {
        return undefined;
      }

      const cursor = decodeSavedLaunchpadsPageCursor(value);
      if (!cursor) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "cursor must be a valid pagination cursor",
        });
        return z.NEVER;
      }

      return cursor;
    }),
  })
  .transform((value) => ({
    limit: value.limit,
    cursor: value.cursor,
  }))
  .openapi("GetSavedLaunchpadsQuery");

export const getLaunchpadParamsSchema = z
  .object({
    launchpadId: z
      .string()
      .trim()
      .regex(FORUM_UUID_RE, "launchpadId is required and must be a valid UUID"),
  })
  .openapi("GetLaunchpadParams");

export type GetSavedLaunchpadsQuery = z.infer<
  typeof getSavedLaunchpadsQuerySchema
>;

export type GetLaunchpadParams = z.infer<typeof getLaunchpadParamsSchema>;