import {
  getPointSystemByKey,
  countUserTransactionsToday,
  insertPointTransaction,
  getForumQuestionById,
  countUserForumQuestions,
} from "./points.query";

export async function awardPoints(params: {
  userId: string;
  actionKey: string;
  referenceType?: string;
  referenceId?: string;
}) {
  const config = await getPointSystemByKey(params.actionKey);
  if (!config) {
    console.warn(`Point system config not found for key: ${params.actionKey}`);
    return null;
  }

  // Check daily limit (0 = unlimited)
  if (config.maxPerDay > 0) {
    const todayCount = await countUserTransactionsToday(
      params.userId,
      params.actionKey as any,
    );
    if (todayCount >= config.maxPerDay) {
      return null;
    }
  }

  const transaction = await insertPointTransaction({
    userId: params.userId,
    actionType: params.actionKey as any,
    points: config.value,
    referenceType: params.referenceType,
    referenceId: params.referenceId,
    mode: config.mode,
  });

  return transaction;
}

/**
 * Award points for posting a forum answer.
 * Also handles the first-question bonus: if the question author's
 * first-ever question just received its first reply, award the bonus.
 */
export async function awardForumParticipationPoints(params: {
  answerAuthorId: string;
  answerId: string;
  questionId: string;
}) {
  // Award participation points to the answer author
  await awardPoints({
    userId: params.answerAuthorId,
    actionKey: "forum_participation",
    referenceType: "forum_answer",
    referenceId: params.answerId,
  });

  // Check first-question bonus for the question author
  const question = await getForumQuestionById(params.questionId);
  if (
    question &&
    question.authorId !== params.answerAuthorId &&
    question.answerCount <= 1 // just got its first reply
  ) {
    const questionCount = await countUserForumQuestions(question.authorId);
    if (questionCount === 1) {
      await awardPoints({
        userId: question.authorId,
        actionKey: "forum_first_question_bonus",
        referenceType: "forum_question",
        referenceId: question.id,
      });
    }
  }
}

/**
 * Award upvote milestone points to content author.
 * Awards points every time the score hits a multiple of 10.
 */
export async function awardForumUpvotePoints(params: {
  voterId: string;
  contentAuthorId: string;
  contentId: string;
  contentType: "forum_question" | "forum_answer";
  score: number;
  voteType: string;
}) {
  if (
    params.voteType !== "UPVOTE" ||
    params.contentAuthorId === params.voterId ||
    params.score <= 0 ||
    params.score % 10 !== 0
  ) {
    return null;
  }

  const actionKey =
    params.contentType === "forum_question"
      ? "forum_question_upvotes"
      : "forum_answer_upvotes";

  return awardPoints({
    userId: params.contentAuthorId,
    actionKey,
    referenceType: params.contentType,
    referenceId: params.contentId,
  });
}
