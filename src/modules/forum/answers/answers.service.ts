import type { Context, TypedResponse } from "hono";
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
  findAnswersByQuestionId,
  findQuestionById,
  setAnswerVote,
  softDeleteAnswer,
  updateAnswer,
} from "./answers.query";
import { POSTGRES_FOREIGN_KEY_VIOLATION } from "../../../db/constants";
import { getAuthUserId } from "../../../modules/auth/utils/get-auth";

export async function handleGetAnswers(c: Context, params: QuestionIdParams) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const question = await findQuestionById(params.questionId);
    if (!question || question.status === "DELETED") {
      return c.json({ ok: false, error: "Question not found" }, 404);
    }

    const answers = await findAnswersByQuestionId(
      params.questionId,
      authResult.userId,
    );
    return c.json({ ok: true, answers }, 200);
  } catch (err) {
    console.error("Failed to get answers", err);
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

    const newAnswer = await createAnswer(data, authResult.userId);
    return c.json({ ok: true, answer: newAnswer }, 201);
  } catch (err) {
    const code = (err as { code?: string } | null)?.code;
    if (code === POSTGRES_FOREIGN_KEY_VIOLATION) {
      return c.json({ ok: false, error: "Question not found" }, 404);
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

    if (existingAnswer.authorId === authResult.userId) {
      return c.json(
        { ok: false, error: "You cannot vote on your own answer" },
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
