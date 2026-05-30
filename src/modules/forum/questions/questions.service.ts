import type { Context } from "hono";
import {
  type CreateQuestionInput,
  type EditQuestionInput,
  type GetSavedQuestionsQuery,
  type GetTrendingTagsQuery,
  type GetQuestionsQuery,
  type PresignForumQuestionImageUploadPayload,
  type QuestionIdParams,
  type VoteQuestionInput,
} from "./questions.schema";
import {
  createQuestion,
  findQuestionById,
  findQuestionByIdPublic,
  findQuestionRowById,
  findSavedQuestionsByUserId,
  findQuestionsByAuthorId,
  findQuestions,
  findQuestionsPublic,
  getTrendingTags,
  incrementQuestionViewCount,
  saveQuestionForUser,
  setQuestionVote,
  softDeleteQuestion,
  unsaveQuestionForUser,
  updateQuestion,
} from "./questions.query";
import { getAuthUserId } from "../../auth/utils/get-auth";
import { POSTGRES_FOREIGN_KEY_VIOLATION } from "../../../db/constants";
import { findCategoryById } from "../categories/categories.query";
import {
  awardPoints,
  awardForumUpvotePoints,
} from "../../points/points.service";
import {
  recordRecentActivityQuietly,
  replaceRecentActivitiesByReference,
} from "../../recent-activity/recent-activity.service";
import { presignForumImageUpload } from "../../uploads/uploads.service";
import { notifyForumQuestionUpvoted } from "../../notifications/notifications.service";

function quoteActivityText(value: string) {
  return `'${value}'`;
}

function normalizeOwnedObjectKey(
  expectedPrefix: string,
  objectKey: string,
): string | null {
  const rawKey = objectKey.startsWith("/") ? objectKey.slice(1) : objectKey;
  let normalizedKey: string;
  try {
    normalizedKey = decodeURIComponent(rawKey);
  } catch {
    return null;
  }

  const forbiddenPattern = /(^|\/)\.\.(\/|$)|\\|\/\/|[\u0000-\u001F\u007F]/;
  if (forbiddenPattern.test(normalizedKey)) {
    return null;
  }

  if (!normalizedKey.startsWith(expectedPrefix)) {
    return null;
  }

  return normalizedKey;
}

function normalizeOwnedForumImageKey(
  userId: string,
  imageKey: string,
): string | null {
  return normalizeOwnedObjectKey(`forum/${userId}/`, imageKey);
}

function buildImageKeyValidationResponse(c: Context) {
  return c.json(
    {
      ok: false,
      error: "Validation failed",
      issues: [
        {
          path: "imageKey",
          message: "imageKey does not belong to current user",
        },
      ],
    },
    400,
  );
}

export async function handlePresignForumQuestionImageUpload(
  c: Context,
  payload: PresignForumQuestionImageUploadPayload,
) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const upload = presignForumImageUpload({
      userId: authResult.userId,
      contentType: payload.contentType,
      fileSize: payload.fileSize,
    });

    return c.json({ ok: true, upload }, 200);
  } catch (error) {
    console.error("Failed to generate forum image upload URL", error);
    return c.json({ ok: false, error: "Failed to generate upload URL" }, 500);
  }
}

export async function handleGetQuestions(
  c: Context,
  query: GetQuestionsQuery,
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
    if (query.categoryId) {
      const category = await findCategoryById(query.categoryId);
      if (!category) {
        return c.json({ ok: false, error: "Category not found" }, 404);
      }
    }

    const result = isPublic
      ? await findQuestionsPublic(query)
      : await findQuestions(query, userId as string);
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

export async function handleGetQuestion(
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
    const question = isPublic
      ? await findQuestionByIdPublic(params.questionId)
      : await findQuestionById(params.questionId, userId as string);
    if (!question) {
      return c.json({ ok: false, error: "Question not found" }, 404);
    }
    try {
      question.viewCount = await incrementQuestionViewCount(params.questionId);
    } catch (error) {
      console.warn("Failed to increment forum question view count", {
        error,
        questionId: params.questionId,
      });
    }
    return c.json({ ok: true, question }, 200);
  } catch (err) {
    console.error("Failed to get question", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}

export async function handleGetMyQuestions(c: Context) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const questions = await findQuestionsByAuthorId(authResult.userId);
    return c.json({ ok: true, questions }, 200);
  } catch (err) {
    console.error("Failed to get my questions", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}

export async function handleGetSavedQuestions(
  c: Context,
  query: GetSavedQuestionsQuery,
) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const result = await findSavedQuestionsByUserId(authResult.userId, query);
    return c.json({ ok: true, ...result }, 200);
  } catch (err) {
    console.error("Failed to get saved questions", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}

export async function handleGetTrendingTags(
  c: Context,
  query: GetTrendingTagsQuery,
  isPublic = false,
) {
  if (!isPublic) {
    const authResult = getAuthUserId(c);
    if (!authResult.ok) {
      return authResult.response;
    }
  }

  try {
    if (query.categoryId) {
      const category = await findCategoryById(query.categoryId);
      if (!category) {
        return c.json({ ok: false, error: "Category not found" }, 404);
      }
    }

    const tags = await getTrendingTags(query);
    return c.json({ ok: true, tags }, 200);
  } catch (err) {
    console.error("Failed to get trending tags", err);
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

    const normalizedImageKey = data.imageKey
      ? normalizeOwnedForumImageKey(authResult.userId, data.imageKey)
      : null;
    if (data.imageKey && !normalizedImageKey) {
      return buildImageKeyValidationResponse(c);
    }

    const newQuestion = await createQuestion(
      { ...data, imageKey: normalizedImageKey },
      authResult.userId,
    );

    awardPoints({
      userId: authResult.userId,
      actionKey: "forum_question_posted",
      referenceType: "forum_question",
      referenceId: newQuestion.id,
    }).catch((err) =>
      console.error("Failed to award points for question", err),
    );

    recordRecentActivityQuietly({
      userId: authResult.userId,
      type: "forum_question_posted",
      title: "Shared a new post in Forum",
      description: quoteActivityText(newQuestion.title),
      targetType: "forum_question",
      targetId: newQuestion.id,
      referenceType: "forum_question",
      referenceId: newQuestion.id,
      data: {
        questionId: newQuestion.id,
        categoryId: newQuestion.category.id,
      },
    });

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

    const normalizedImageKey =
      data.imageKey === undefined || data.imageKey === null
        ? data.imageKey
        : normalizeOwnedForumImageKey(authResult.userId, data.imageKey);
    if (data.imageKey && !normalizedImageKey) {
      return buildImageKeyValidationResponse(c);
    }

    const updatedQuestion = await updateQuestion(
      params.questionId,
      authResult.userId,
      { ...data, imageKey: normalizedImageKey },
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

    recordRecentActivityQuietly({
      userId: authResult.userId,
      type: "forum_question_deleted",
      title: "Deleted a Forum post",
      description: quoteActivityText(existingQuestion.title),
      targetType: "forum_question",
      targetId: deletedQuestion.id,
      referenceType: "forum_question",
      referenceId: deletedQuestion.id,
      data: {
        questionId: deletedQuestion.id,
      },
    });

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

    const existingQuestionWithViewerVote = await findQuestionById(
      params.questionId,
      authResult.userId,
    );
    if (!existingQuestionWithViewerVote) {
      return c.json({ ok: false, error: "Question not found" }, 404);
    }

    const votedQuestion = await setQuestionVote(
      params.questionId,
      authResult.userId,
      data.voteType,
    );
    if (!votedQuestion) {
      return c.json({ ok: false, error: "Question not found" }, 404);
    }

    awardForumUpvotePoints({
      voterId: authResult.userId,
      contentAuthorId: existingQuestion.authorId,
      contentId: params.questionId,
      contentType: "forum_question",
      score: votedQuestion.score,
      voteType: data.voteType,
    }).catch((err) =>
      console.error("Failed to award forum_upvote points", err),
    );

    void replaceRecentActivitiesByReference({
      userId: authResult.userId,
      referenceType: "forum_question",
      referenceId: votedQuestion.id,
      types: ["forum_question_upvoted", "forum_question_downvoted"],
      activity:
        data.voteType === "NONE"
          ? null
          : {
        userId: authResult.userId,
        type:
          data.voteType === "UPVOTE"
            ? "forum_question_upvoted"
            : "forum_question_downvoted",
        title:
          data.voteType === "UPVOTE"
            ? "Upvoted a Forum post"
            : "Downvoted a Forum post",
        description: quoteActivityText(votedQuestion.title),
        targetType: "forum_question",
        targetId: votedQuestion.id,
        referenceType: "forum_question",
        referenceId: votedQuestion.id,
        data: {
          questionId: votedQuestion.id,
          voteType: data.voteType,
        },
      },
    }).catch((err) => {
      console.error("Failed to replace forum question vote activity", err);
    });

    if (
      data.voteType === "UPVOTE" &&
      existingQuestionWithViewerVote.viewerVote !== "UPVOTE" &&
      votedQuestion.viewerVote === "UPVOTE" &&
      existingQuestion.authorId !== authResult.userId
    ) {
      notifyForumQuestionUpvoted({
        recipientUserId: existingQuestion.authorId,
        questionId: votedQuestion.id,
        questionTitle: votedQuestion.title,
        upvoteCount: votedQuestion.upvoteCount,
      }).catch((err) =>
        console.error("Failed to notify forum question upvote", err),
      );
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

export async function handleSaveQuestion(c: Context, params: QuestionIdParams) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const existingQuestion = await findQuestionRowById(params.questionId);
    if (!existingQuestion || existingQuestion.status === "DELETED") {
      return c.json({ ok: false, error: "Question not found" }, 404);
    }

    const savedQuestion = await saveQuestionForUser(
      params.questionId,
      authResult.userId,
    );
    if (!savedQuestion) {
      return c.json({ ok: false, error: "Question not found" }, 404);
    }

    if (savedQuestion.created) {
      recordRecentActivityQuietly({
        userId: authResult.userId,
        type: "forum_question_saved",
        title: "Saved a Forum post",
        description: quoteActivityText(existingQuestion.title),
        targetType: "forum_question",
        targetId: existingQuestion.id,
        referenceType: "forum_question",
        referenceId: existingQuestion.id,
        data: {
          questionId: existingQuestion.id,
        },
      });
    }

    return c.json({ ok: true }, 200);
  } catch (err) {
    console.error("Failed to save question", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}

export async function handleUnsaveQuestion(
  c: Context,
  params: QuestionIdParams,
) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const existingQuestion = await findQuestionRowById(params.questionId);
    if (!existingQuestion || existingQuestion.status === "DELETED") {
      return c.json({ ok: false, error: "Question not found" }, 404);
    }

    const unsavedQuestion = await unsaveQuestionForUser(
      params.questionId,
      authResult.userId,
    );
    if (!unsavedQuestion) {
      return c.json({ ok: false, error: "Question not found" }, 404);
    }

    return c.json({ ok: true }, 200);
  } catch (err) {
    console.error("Failed to unsave question", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}
