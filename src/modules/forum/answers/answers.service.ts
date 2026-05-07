import type { Context } from "hono";
import type {
  AnswerIdParams,
  CreateAnswerInput,
  GetAnswersQuery,
  QuestionIdParams,
  UpdateAnswerInput,
  VoteAnswerInput,
} from "./answers.schema";
import {
  BestAnswerSelectionForbiddenError,
  BestAnswerSelectionInvalidTargetError,
  createAnswer,
  findAnswerById,
  findAnswersByAuthorId,
  findAnswersByQuestionId,
  findAnswersByQuestionIdPublic,
  findQuestionById,
  markBestAnswer,
  ReplyTargetUnavailableError,
  setAnswerVote,
  softDeleteAnswer,
  updateAnswer,
} from "./answers.query";
import { POSTGRES_FOREIGN_KEY_VIOLATION } from "../../../db/constants";
import { getAuthUserId } from "../../../modules/auth/utils/get-auth";
import {
  awardForumParticipationPoints,
  awardForumUpvotePoints,
} from "../../points/points.service";
import {
  recordRecentActivityQuietly,
  replaceRecentActivitiesByReference,
} from "../../recent-activity/recent-activity.service";

function quoteActivityText(value: string) {
  return `'${value}'`;
}

export async function handleGetAnswers(
  c: Context,
  params: QuestionIdParams,
  query: GetAnswersQuery,
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
      ? await findAnswersByQuestionIdPublic(params.questionId, query.sortBy)
      : await findAnswersByQuestionId(
          params.questionId,
          userId as string,
          query.sortBy,
        );
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

    if (data.replyToAnswer) {
      const parentAnswer = await findAnswerById(data.replyToAnswer);
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

    // Award forum participation + first question bonus (handled by point service)
    awardForumParticipationPoints({
      answerAuthorId: authResult.userId,
      answerId: newAnswer.id,
      questionId: data.questionId,
    }).catch((err) =>
      console.error("Failed to award forum answer points", err),
    );

    recordRecentActivityQuietly({
      userId: authResult.userId,
      type: "forum_answer_posted",
      title: data.replyToAnswer
        ? "Replied to a Forum answer"
        : "Answered a Forum post",
      description: quoteActivityText(question.title),
      targetType: "forum_question",
      targetId: question.id,
      referenceType: "forum_answer",
      referenceId: newAnswer.id,
      data: {
        questionId: question.id,
        answerId: newAnswer.id,
        replyToAnswerId: data.replyToAnswer ?? null,
      },
    });

    return c.json({ ok: true, answer: newAnswer }, 201);
  } catch (err) {
    if (err instanceof ReplyTargetUnavailableError) {
      return c.json({ ok: false, error: err.message }, 409);
    }

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

    const question = await findQuestionById(deletedAnswer.questionId);
    recordRecentActivityQuietly({
      userId: authResult.userId,
      type: "forum_answer_deleted",
      title: "Deleted a Forum answer",
      description: question ? quoteActivityText(question.title) : null,
      targetType: "forum_question",
      targetId: deletedAnswer.questionId,
      referenceType: "forum_answer",
      referenceId: deletedAnswer.id,
      data: {
        questionId: deletedAnswer.questionId,
        answerId: deletedAnswer.id,
      },
    });

    return c.json({ ok: true }, 200);
  } catch (err) {
    console.error("Failed to delete answer", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}

export async function handleMarkBestAnswer(
  c: Context,
  params: AnswerIdParams,
) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const markedAnswer = await markBestAnswer(
      params.answerId,
      authResult.userId,
    );

    if (markedAnswer.kind === "NotFound") {
      return c.json({ ok: false, error: "Answer not found" }, 404);
    }

    if (markedAnswer.kind === "AnswerNotPublished") {
      return c.json({ ok: false, error: "Answer not published" }, 409);
    }

    if (markedAnswer.kind === "QuestionInvalid") {
      return c.json(
        { ok: false, error: "Question not found or not in a markable state" },
        409,
      );
    }

    const question = await findQuestionById(markedAnswer.answer.questionId);
    recordRecentActivityQuietly({
      userId: authResult.userId,
      type: "forum_best_answer_marked",
      title: "Marked a best answer in Forum",
      description: question ? quoteActivityText(question.title) : null,
      targetType: "forum_question",
      targetId: markedAnswer.answer.questionId,
      referenceType: "forum_answer",
      referenceId: markedAnswer.answer.id,
      data: {
        questionId: markedAnswer.answer.questionId,
        answerId: markedAnswer.answer.id,
      },
    });

    return c.json({ ok: true, answer: markedAnswer.answer }, 200);
  } catch (err) {
    if (err instanceof BestAnswerSelectionForbiddenError) {
      return c.json({ ok: false, error: err.message }, 403);
    }

    if (err instanceof BestAnswerSelectionInvalidTargetError) {
      return c.json({ ok: false, error: err.message }, 409);
    }

    console.error("Failed to mark best answer", err);
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

    awardForumUpvotePoints({
      voterId: authResult.userId,
      contentAuthorId: existingAnswer.authorId,
      contentId: params.answerId,
      contentType: "forum_answer",
      score: votedAnswer.score,
      voteType: data.voteType,
    }).catch((err) =>
      console.error("Failed to award forum_answer_upvotes points", err),
    );

    const question =
      data.voteType === "NONE"
        ? null
        : await findQuestionById(existingAnswer.questionId);
    await replaceRecentActivitiesByReference({
      userId: authResult.userId,
      referenceType: "forum_answer",
      referenceId: params.answerId,
      types: ["forum_answer_upvoted", "forum_answer_downvoted"],
      activity:
        data.voteType === "NONE"
          ? null
          : {
        userId: authResult.userId,
        type:
          data.voteType === "UPVOTE"
            ? "forum_answer_upvoted"
            : "forum_answer_downvoted",
        title:
          data.voteType === "UPVOTE"
            ? "Upvoted a Forum answer"
            : "Downvoted a Forum answer",
        description: question ? quoteActivityText(question.title) : null,
        targetType: "forum_question",
        targetId: existingAnswer.questionId,
        referenceType: "forum_answer",
        referenceId: params.answerId,
        data: {
          questionId: existingAnswer.questionId,
          answerId: params.answerId,
          voteType: data.voteType,
        },
      },
    }).catch((err) => {
      console.error("Failed to replace forum answer vote activity", err);
    });

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
