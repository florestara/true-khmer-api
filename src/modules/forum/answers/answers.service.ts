import type { Context } from "hono";
import type {
  AnswerIdParams,
  CreateAnswerInput,
  QuestionIdParams,
  UpdateAnswerInput,
  VoteAnswerInput,
} from "./answers.schema";
import {
  createAnswer,
  findAnswerById,
  findAnswersByAuthorId,
  findAnswersByQuestionId,
  findAnswersByQuestionIdPublic,
  findQuestionById,
  setAnswerVote,
  softDeleteAnswer,
  updateAnswer,
} from "./answers.query";
import { POSTGRES_FOREIGN_KEY_VIOLATION } from "../../../db/constants";
import { getAuthUserId } from "../../../modules/auth/utils/get-auth";

export async function handleGetAnswers(
  c: Context,
  params: QuestionIdParams,
  isPublic = false,
) {
  let userId: string | undefined;
  if (!isPublic) {
    const authResult = getAuthUserId(c);
    if (!authResult.ok) {
      return authResult.response;
    }
    userId = authResult.userId;
  }

  try {
    const question = await findQuestionById(params.questionId);
    if (!question || question.status === "DELETED") {
      return c.json({ ok: false, error: "Question not found" }, 404);
    }

    const answers = isPublic
      ? await findAnswersByQuestionIdPublic(params.questionId)
      : await findAnswersByQuestionId(params.questionId, userId as string);
    return c.json({ ok: true, answers }, 200);
  } catch (err) {
    console.error("Failed to get answers", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}

export async function handleGetMyAnswers(c: Context) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const answers = await findAnswersByAuthorId(authResult.userId);
    return c.json({ ok: true, answers }, 200);
  } catch (err) {
    console.error("Failed to get my answers", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}

export async function handleCreateAnswer(c: Context, data: CreateAnswerInput) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const question = await findQuestionById(data.questionId);
    if (!question) {
      return c.json({ ok: false, error: "Question not found" }, 404);
    }

    if (question.status !== "PUBLISHED") {
      return c.json(
        {
          ok: false,
          error: "Answers can only be posted to published questions",
        },
        409,
      );
    }

    if (data.replyTo) {
      const parentAnswer = await findAnswerById(data.replyTo);
      if (!parentAnswer) {
        return c.json({ ok: false, error: "Reply target not found" }, 404);
      }

      if (parentAnswer.questionId !== data.questionId) {
        return c.json(
          {
            ok: false,
            error: "Replies must belong to the same question",
          },
          409,
        );
      }

      if (parentAnswer.status !== "PUBLISHED") {
        return c.json(
          {
            ok: false,
            error: "Replies can only be posted to published answers",
          },
          409,
        );
      }

      if (parentAnswer.replyTo) {
        return c.json(
          {
            ok: false,
            error: "Replies to replies are not allowed",
          },
          409,
        );
      }
    }

    const newAnswer = await createAnswer(data, authResult.userId);
    return c.json({ ok: true, answer: newAnswer }, 201);
  } catch (err) {
    const code = (err as { code?: string } | null)?.code;
    if (code === POSTGRES_FOREIGN_KEY_VIOLATION) {
      return c.json(
        { ok: false, error: "Question not found" },
        404,
      );
    }
    console.error("Failed to create answer", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}

export async function handleEditAnswer(
  c: Context,
  params: AnswerIdParams,
  data: UpdateAnswerInput,
) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const existingAnswer = await findAnswerById(params.answerId);
    if (!existingAnswer) {
      return c.json({ ok: false, error: "Answer not found" }, 404);
    }

    if (existingAnswer.authorId !== authResult.userId) {
      return c.json(
        { ok: false, error: "You can only edit your own answer" },
        403,
      );
    }

    if (existingAnswer.status !== "PUBLISHED") {
      return c.json(
        { ok: false, error: "Only published answers can be edited" },
        409,
      );
    }

    const updatedAnswer = await updateAnswer(
      params.answerId,
      authResult.userId,
      data,
    );
    if (!updatedAnswer) {
      return c.json({ ok: false, error: "Answer not found" }, 404);
    }

    return c.json({ ok: true, answer: updatedAnswer }, 200);
  } catch (err) {
    console.error("Failed to edit answer", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}

export async function handleDeleteAnswer(c: Context, params: AnswerIdParams) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const existingAnswer = await findAnswerById(params.answerId);
    if (!existingAnswer) {
      return c.json({ ok: false, error: "Answer not found" }, 404);
    }

    if (existingAnswer.authorId !== authResult.userId) {
      return c.json(
        { ok: false, error: "You can only delete your own answer" },
        403,
      );
    }

    if (existingAnswer.status !== "PUBLISHED") {
      return c.json({ ok: false, error: "Answer is already deleted" }, 409);
    }

    const deletedAnswer = await softDeleteAnswer(
      params.answerId,
      authResult.userId,
    );
    if (!deletedAnswer) {
      return c.json({ ok: false, error: "Answer not found" }, 404);
    }

    return c.json({ ok: true }, 200);
  } catch (err) {
    console.error("Failed to delete answer", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}

export async function handleVoteAnswer(
  c: Context,
  params: AnswerIdParams,
  data: VoteAnswerInput,
) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const existingAnswer = await findAnswerById(params.answerId);
    if (!existingAnswer) {
      return c.json({ ok: false, error: "Answer not found" }, 404);
    }

    if (existingAnswer.status !== "PUBLISHED") {
      return c.json(
        { ok: false, error: "Only published answers can be voted on" },
        409,
      );
    }

    const votedAnswer = await setAnswerVote(
      params.answerId,
      authResult.userId,
      data.voteType,
    );
    if (!votedAnswer) {
      return c.json({ ok: false, error: "Answer not found" }, 404);
    }

    return c.json(
      {
        ok: true,
        answer: votedAnswer,
      },
      200,
    );
  } catch (err) {
    console.error("Failed to vote answer", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}
