import {
  getPointSystemByKey,
  insertPointTransaction,
  getForumQuestionById,
  isUsersFirstQuestion,
  countUserAnswersInThread,
  getHighestAwardedMilestone,
  getLaunchpadValidationSnapshot,
} from "./points.query";
import type { ActionType } from "./points.query";

export async function awardPoints(params: {
  userId: string;
  actionKey: ActionType;
  referenceType?: string;
  referenceId?: string;
  mode?: "action" | "support";
  dedupeByReference?: boolean;
}) {
  const config = await getPointSystemByKey(params.actionKey);
  if (!config) {
    console.warn(`Point system config not found for key: ${params.actionKey}`);
    return null;
  }

  const transaction = await insertPointTransaction({
    userId: params.userId,
    actionType: params.actionKey,
    points: config.value,
    referenceType: params.referenceType,
    referenceId: params.referenceId,
    mode: params.mode ?? config.mode,
    maxPerDay: config.maxPerDay,
    dedupeByReference:
      params.dedupeByReference ??
      Boolean(params.referenceType && params.referenceId),
  });

  return transaction;
}

export async function awardForumParticipationPoints(params: {
  answerAuthorId: string;
  answerId: string;
  questionId: string;
}) {
  // Award participation points only for the user's first answer in this thread
  const priorAnswers = await countUserAnswersInThread(
    params.answerAuthorId,
    params.questionId,
  );
  if (priorAnswers <= 1) {
    await awardPoints({
      userId: params.answerAuthorId,
      actionKey: "forum_participation",
      referenceType: "forum_answer",
      referenceId: params.answerId,
    });
  }

  const question = await getForumQuestionById(params.questionId);
  if (
    question &&
    question.authorId !== params.answerAuthorId &&
    question.answerCount === 1
  ) {
    const isFirst = await isUsersFirstQuestion(question.authorId, question.id);
    if (isFirst) {
      await awardPoints({
        userId: question.authorId,
        actionKey: "forum_first_question_bonus",
        referenceType: "forum_question",
        referenceId: question.id,
      });
    }
  }
}

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
    params.score <= 0
  ) {
    return null;
  }

  const actionKey: ActionType =
    params.contentType === "forum_question"
      ? "forum_question_upvotes"
      : "forum_answer_upvotes";

  // Determine the current milestone (10, 20, 30, ...)
  const currentMilestone = Math.floor(params.score / 10) * 10;
  if (currentMilestone <= 0) {
    return null;
  }

  // Check the highest milestone already awarded for this content
  const highestAwarded = await getHighestAwardedMilestone(
    params.contentAuthorId,
    actionKey,
    params.contentType,
    params.contentId,
  );

  if (currentMilestone <= highestAwarded) {
    return null;
  }

  return awardPoints({
    userId: params.contentAuthorId,
    actionKey,
    referenceType: params.contentType,
    referenceId: params.contentId,
    dedupeByReference: false,
  });
}

export async function transferForumBestAnswerPoints(params: {
  answerAuthorId: string;
  answerId: string;
  questionAuthorId: string;
  questionId: string;
  selectionChanged: boolean;
  previousBestAnswer?: {
    id: string;
    authorId: string;
  } | null;
}) {
  if (!params.selectionChanged) {
    return null;
  }

  const config = await getPointSystemByKey("forum_best_answer");
  if (!config) {
    console.warn("Point system config not found for key: forum_best_answer");
    return null;
  }

  const transactions = [];

  if (
    params.previousBestAnswer &&
    params.previousBestAnswer.authorId !== params.questionAuthorId
  ) {
    transactions.push(
      insertPointTransaction({
        userId: params.previousBestAnswer.authorId,
        actionType: "forum_best_answer",
        points: -config.value,
        referenceType: "forum_answer",
        referenceId: params.previousBestAnswer.id,
        mode: config.mode,
        dedupeByReference: false,
      }),
    );
  }

  if (params.answerAuthorId !== params.questionAuthorId) {
    transactions.push(
      insertPointTransaction({
        userId: params.answerAuthorId,
        actionType: "forum_best_answer",
        points: config.value,
        referenceType: "forum_answer",
        referenceId: params.answerId,
        mode: config.mode,
        maxPerDay: config.maxPerDay,
        dedupeByReference: false,
      }),
    );
  }

  return Promise.all(transactions);
}

export async function awardLaunchpadValidationPoints(params: {
  launchpadId: string;
}) {
  const snapshot = await getLaunchpadValidationSnapshot(params.launchpadId);
  if (!snapshot || snapshot.capacity <= 0) {
    return;
  }

  if (snapshot.participantIds.length < snapshot.capacity) {
    return;
  }

  await Promise.all([
    awardPoints({
      userId: snapshot.proposerId,
      actionKey: "launchpad_project_validated_proposer",
      referenceType: "launchpad",
      referenceId: snapshot.launchpadId,
    }),
    ...snapshot.participantIds
      .filter((participantId) => participantId !== snapshot.proposerId)
      .map((participantId) =>
        awardPoints({
          userId: participantId,
          actionKey: "launchpad_project_validated_participant",
          referenceType: "launchpad",
          referenceId: snapshot.launchpadId,
        }),
      ),
  ]);
}
