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
