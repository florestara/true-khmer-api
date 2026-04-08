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
  userId?: string,
): Promise<CreateReportingResult> {
  return await db.transaction(async (tx) => {
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
