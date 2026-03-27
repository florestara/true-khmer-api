import type { Context } from "hono";
import {
  type CreateQuestionInput,
  type EditQuestionInput,
  type GetQuestionsQuery,

  type QuestionIdParams,
  type VoteQuestionInput,
} from "./questions.schema";
import {
  createQuestion,
  findQuestionById,
  findQuestionRowById,
  findQuestions,
  setQuestionVote,
  softDeleteQuestion,
  updateQuestion,
} from "./questions.query";
import { getAuthUserId } from "../../auth/utils/get-auth";
import { findCategoryById } from "../categories/categories.query";
import { POSTGRES_FOREIGN_KEY_VIOLATION } from "../lib/constants";

export async function handleGetQuestions(c: Context, query: GetQuestionsQuery) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    if (query.categoryId) {
      const category = await findCategoryById(query.categoryId);
      if (!category) {
        return c.json({ ok: false, error: "Category not found" }, 404);
      }
    }

    const result = await findQuestions(query, authResult.userId);
    return c.json(
      {
        ok: true,
        ...result,
      },
      200,
    );
  } catch (err) {
    console.error("Failed to get questions", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}

export async function handleGetQuestion(c: Context, params: QuestionIdParams) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const question = await findQuestionById(
      params.questionId,
      authResult.userId,
    );
    if (!question) {
      return c.json({ ok: false, error: "Question not found" }, 404);
    }
    return c.json({ ok: true, question }, 200);
  } catch (err) {
    console.error("Failed to get question", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}

export async function handleCreateQuestion(
  c: Context,
  data: CreateQuestionInput,
) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const category = await findCategoryById(data.categoryId);
    if (!category) {
      return c.json({ ok: false, error: "Category not found" }, 404);
    }

    if (category.status !== "ACTIVE") {
      return c.json(
        {
          ok: false,
          error: "Questions can only be posted to active categories",
        },
        409,
      );
    }

    const newQuestion = await createQuestion(data, authResult.userId);
    return c.json({ ok: true, question: newQuestion }, 201);
  } catch (err) {
    const code = (err as { code?: string } | null)?.code;
    if (code === POSTGRES_FOREIGN_KEY_VIOLATION) {
      return c.json({ ok: false, error: "Category not found" }, 404);
    }
    console.error("Failed to create question", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}

export async function handleEditQuestion(
  c: Context,
  params: QuestionIdParams,
  data: EditQuestionInput,
) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const existingQuestion = await findQuestionRowById(params.questionId);
    if (!existingQuestion) {
      return c.json({ ok: false, error: "Question not found" }, 404);
    }

    if (existingQuestion.authorId !== authResult.userId) {
      return c.json(
        { ok: false, error: "You can only edit your own question" },
        403,
      );
    }

    if (existingQuestion.status === "DELETED") {
      return c.json(
        { ok: false, error: "Cannot edit a deleted question" },
        409,
      );
    }

    if (data.categoryId) {
      const category = await findCategoryById(data.categoryId);
      if (!category) {
        return c.json({ ok: false, error: "Category not found" }, 404);
      }

      if (category.status !== "ACTIVE") {
        return c.json(
          {
            ok: false,
            error: "Questions can only be moved to active categories",
          },
          409,
        );
      }
    }

    const updatedQuestion = await updateQuestion(
      params.questionId,
      authResult.userId,
      data,
    );
    if (!updatedQuestion) {
      return c.json({ ok: false, error: "Question not found" }, 404);
    }

    return c.json({ ok: true, question: updatedQuestion }, 200);
  } catch (err) {
    const code = (err as { code?: string } | null)?.code;
    if (code === POSTGRES_FOREIGN_KEY_VIOLATION) {
      return c.json({ ok: false, error: "Category not found" }, 404);
    }
    console.error("Failed to edit question", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}

export async function handleDeleteQuestion(
  c: Context,
  params: QuestionIdParams,
) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const existingQuestion = await findQuestionRowById(params.questionId);
    if (!existingQuestion) {
      return c.json({ ok: false, error: "Question not found" }, 404);
    }

    if (existingQuestion.authorId !== authResult.userId) {
      return c.json(
        { ok: false, error: "You can only delete your own question" },
        403,
      );
    }

    if (existingQuestion.status === "DELETED") {
      return c.json({ ok: false, error: "Question is already deleted" }, 409);
    }

    const deletedQuestion = await softDeleteQuestion(
      params.questionId,
      authResult.userId,
    );
    if (!deletedQuestion) {
      return c.json({ ok: false, error: "Question not found" }, 404);
    }

    return c.json({ ok: true }, 200);
  } catch (err) {
    console.error("Failed to delete question", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}

export async function handleVoteQuestion(
  c: Context,
  params: QuestionIdParams,
  data: VoteQuestionInput,
) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const existingQuestion = await findQuestionRowById(params.questionId);
    if (!existingQuestion) {
      return c.json({ ok: false, error: "Question not found" }, 404);
    }

    if (existingQuestion.status !== "PUBLISHED") {
      return c.json(
        { ok: false, error: "Only published questions can be voted on" },
        409,
      );
    }

    if (existingQuestion.authorId === authResult.userId) {
      return c.json(
        { ok: false, error: "You cannot vote on your own question" },
        409,
      );
    }

    const votedQuestion = await setQuestionVote(
      params.questionId,
      authResult.userId,
      data.voteType,
    );
    if (!votedQuestion) {
      return c.json({ ok: false, error: "Question not found" }, 404);
    }

    return c.json(
      {
        ok: true,
        question: votedQuestion,
      },
      200,
    );
  } catch (err) {
    console.error("Failed to vote question", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}
