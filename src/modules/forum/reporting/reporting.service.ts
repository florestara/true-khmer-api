import { Context } from "hono";
import { CreateReportingInput } from "./reporting.schema";
import { findAnswerById, findQuestionById } from "../answers/answers.query";
import { findReportingTypeById } from "../reportingType/reportingType.query";
import { createReporting } from "./reporting.query";
import { getAuthUserId } from "../../auth/utils/get-auth";

export async function handleCreateReporting(
  c: Context,
  data: CreateReportingInput,
) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    if (data.questionId) {
      const question = await findQuestionById(data.questionId);
      if (!question || question?.status === "DELETED")
        return c.json({ ok: false, error: "Question not found" }, 404);
    }
    if (data.answerId) {
      const answer = await findAnswerById(data.answerId);
      if (!answer || answer?.status === "DELETED")
        return c.json({ ok: false, error: "Answer not found" }, 404);
    }

    const type = await findReportingTypeById(data.typeId);
    if (!type || !type.ok) {
      return c.json({ ok: false, error: "Reporting type not found" }, 404);
    }

    const createResult = await createReporting(data, authResult.userId);
    if (!createResult.ok) {
      return c.json({ ok: false, error: createResult.error }, 400);
    }

    return c.json({ ok: true, reportingId: createResult.reportingId });
  } catch (err) {
    console.error("Failed to create reporting", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}
