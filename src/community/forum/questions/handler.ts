import type { Context } from "hono";
import { getAuthUserId, type AuthPayload } from "../../../auth/types";
import {
  UUID_RE,
  type CreateQuestionInput,
  type GetQuestionParams,
  type GetQuestionsPageQuery,
} from "./schema";
import {
  createQuestion,
  findAllQuestions,
  findCategoryById,
  findQuestionById,
  findQuestionsPage,
} from "./query";

const POSTGRES_FOREIGN_KEY_VIOLATION = "23503";

export async function handleGetQuestions(c: Context) {
  try {
    const questions = await findAllQuestions();
    return c.json({ ok: true, questions }, 200);
  } catch (err) {
    console.error("Failed to get questions", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}

export async function handleGetQuestionsPage(c: Context, query: GetQuestionsPageQuery) {
  try {
    const page = await findQuestionsPage(query.limit, query.cursor);
    return c.json(
      {
        ok: true,
        questions: page.questions,
        pagination: {
          limit: query.limit,
          hasMore: page.hasMore,
          nextCursor: page.nextCursor,
        },
      },
      200
    );
  } catch (err) {
    console.error("Failed to get questions page", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}

export async function handleGetQuestion(c: Context, params: GetQuestionParams) {
  try {
    const question = await findQuestionById(params.questionId);
    if (!question) {
      return c.json({ ok: false, error: "Question not found" }, 404);
    }
    return c.json({ ok: true, question }, 200);
  } catch (err) {
    console.error("Failed to get question", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}

export async function handleCreateQuestion(c: Context, data: CreateQuestionInput) {
  const authPayload = c.get("auth") as AuthPayload | undefined;
  const authorId = getAuthUserId(authPayload);
  if (!authorId) {
    return c.json({ ok: false, error: "Authenticated user id not found" }, 401);
  }

  if (!UUID_RE.test(authorId)) {
    return c.json(
      {
        ok: false,
        error:
          "Authenticated user id is not UUID. Align forum author_id type with auth user id type.",
      },
      400
    );
  }

  try {
    const category = await findCategoryById(data.categoryId);
    if (!category) {
      return c.json({ ok: false, error: "Category not found" }, 404);
    }

    if (category.status !== "ACTIVE") {
      return c.json(
        { ok: false, error: "Questions can only be posted to active categories" },
        409
      );
    }

    const newQuestion = await createQuestion(data, authorId);
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
