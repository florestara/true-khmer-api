import { findQuestionsPostedByUserId } from "../forum/questions/questions.query";
import { getQuestionsQuerySchema } from "../forum/questions/questions.schema";
import { findLaunchpadsPostedByUserId } from "../launchpad/launchpad.query";
import { getLaunchpadQueryListSchema } from "../launchpad/schema/launchpad.request.schema";
import { getVolunteerOpportunitiesPostedByUserId } from "../volunteer/post-volunteer/post-volunteer.query";
import { getVolunteerOpportunitiesQuerySchema } from "../volunteer/post-volunteer/post-volunteer.schema";
import type { GetMyPostedQuery } from "./profile.schema";

export class MyPostedQueryError extends Error {
  constructor() {
    super("cursor must be valid for the selected sourceType");
    this.name = "MyPostedQueryError";
  }
}

export async function getPostedItemsByUserId(
  userId: string,
  viewerId: string | undefined,
  query: GetMyPostedQuery,
) {
  if (query.sourceType === "forum") {
    const parsedQuery = getQuestionsQuerySchema.safeParse({
      limit: query.limit,
      cursor: query.cursor,
      sortBy: "newest",
    });
    if (!parsedQuery.success) {
      throw new MyPostedQueryError();
    }

    return {
      sourceType: query.sourceType,
      ...(await findQuestionsPostedByUserId(
        userId,
        parsedQuery.data,
        viewerId,
      )),
    };
  }

  if (query.sourceType === "volunteer") {
    const parsedQuery = getVolunteerOpportunitiesQuerySchema.safeParse({
      limit: query.limit,
      cursor: query.cursor,
    });
    if (!parsedQuery.success) {
      throw new MyPostedQueryError();
    }

    return {
      sourceType: query.sourceType,
      ...(await getVolunteerOpportunitiesPostedByUserId(
        userId,
        parsedQuery.data,
        viewerId,
      )),
    };
  }

  const parsedQuery = getLaunchpadQueryListSchema.safeParse({
    limit: query.limit,
    cursor: query.cursor,
    sortBy: "newest",
  });
  if (!parsedQuery.success) {
    throw new MyPostedQueryError();
  }

  return {
    sourceType: query.sourceType,
    ...(await findLaunchpadsPostedByUserId(
      userId,
      parsedQuery.data,
      viewerId,
    )),
  };
}
