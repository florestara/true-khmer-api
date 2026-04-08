import { eq } from "drizzle-orm";
import { db } from "../../../db";
import { forumReportingType } from "../../../db/schema";

type ForumReportingTypeRow = typeof forumReportingType.$inferSelect;
type ForumReportingType = Omit<
  ForumReportingTypeRow,
  "createdAt" | "updatedAt"
>;

type GetReportingTypesResult = {
  ok: boolean;
  reportingTypes?: ForumReportingType[];
};

type GetReportingTypeByIdResult = {
  ok: boolean;
  reportingType?: ForumReportingType | null;
};

function buildReportingTypeBaseQuery() {
  return db
    .select({ id: forumReportingType.id, type: forumReportingType.type })
    .from(forumReportingType);
}

export async function findReportingTypes(): Promise<GetReportingTypesResult> {
  const reportingTypes = await buildReportingTypeBaseQuery();

  return {
    ok: true,
    reportingTypes,
  };
}

export async function findReportingTypeById(
  id: string,
): Promise<GetReportingTypeByIdResult | null> {
  const reportingType = await buildReportingTypeBaseQuery()
    .where(eq(forumReportingType.id, id))
    .then((res) => res[0]);
  if (!reportingType) {
    return { ok: false, reportingType: null };
  }
  return { ok: true, reportingType };
}
