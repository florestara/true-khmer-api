import { and, eq } from "drizzle-orm";
import { db } from "../../../db";
import { forumReporting } from "../../../db/schema";
import { CreateReportingInput } from "./reporting.schema";

type CreateReportingResult = {
  ok: boolean;
  reportingId?: string;
  error?: string;
};

export async function createReporting(
  data: CreateReportingInput,
  userId: string,
): Promise<CreateReportingResult> {
  return await db.transaction(async (tx) => {
    if (data.questionId || data.answerId) {
      const conditions = [eq(forumReporting.createdBy, userId)];

      if (data.questionId) {
        conditions.push(eq(forumReporting.questionId, data.questionId));
      }
      if (data.answerId) {
        conditions.push(eq(forumReporting.answerId, data.answerId));
      }

      const [existing] = await tx
        .select({ id: forumReporting.id })
        .from(forumReporting)
        .where(and(...conditions))
        .limit(1);

      if (existing) {
        const target = data.answerId ? "answer" : "question";
        return { ok: false, error: `This ${target} has already been reported` };
      }
    }

    const fieldToInsert: CreateReportingInput & {
      createdBy: string | undefined;
    } = {
      typeId: data.typeId,
      createdBy: userId,
      questionId: data.questionId,
      answerId: data.answerId,
      description: data.description,
    };

    const [created] = await tx
      .insert(forumReporting)
      .values(fieldToInsert)
      .returning();

    if (!created) {
      return { ok: false, error: "Failed to create reporting" };
    }
    return { ok: true, reportingId: created.id };
  });
}
