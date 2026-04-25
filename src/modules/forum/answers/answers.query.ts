import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../../db/index";
import {
  forumAnswer,
  forumAnswerVote,
  forumQuestion,
  user,
  userProfile,
} from "../../../db/schema";
import { FORUM_ADVISORY_LOCK_NAMESPACE } from "../lib/constants";
import type {
  AnswerVoteType,
  CreateAnswerInput,
  UpdateAnswerInput,
  VoteIntent,
} from "./answers.schema";

type ForumQuestionRow = typeof forumQuestion.$inferSelect;
type ForumAnswerRow = typeof forumAnswer.$inferSelect;
type ForumAnswerInsert = typeof forumAnswer.$inferInsert;
type ForumAnswerVoteInsert = typeof forumAnswerVote.$inferInsert;

export class ReplyTargetUnavailableError extends Error {
  constructor() {
    super("Reply target is no longer available");
    this.name = "ReplyTargetUnavailableError";
  }
}

export class BestAnswerSelectionForbiddenError extends Error {
  constructor() {
    super("Only the question author can mark the best answer");
    this.name = "BestAnswerSelectionForbiddenError";
  }
}

type AnswerHydrationRow = {
  answer: ForumAnswerRow;
  questionBestAnswerId: string | null;
  authorDisplayName: string | null;
  authorFullName: string;
  authorAvatarKey: string | null;
  viewerVoteType: string | null;
};
type PublicAnswerHydrationRow = Omit<AnswerHydrationRow, "viewerVoteType">;
type RepliedAnswerWithViewerVote = Omit<
  ForumAnswerRow,
  "authorId" | "deletedAt"
> & {
  score: number;
  isBestAnswer: boolean;
  viewerVote: AnswerVoteType | null;
  author: {
    id: string;
    name: string;
    avatarKey: string | null;
  };
};
type ForumAnswerWithViewerVote = RepliedAnswerWithViewerVote & {
  repliedAnswers: RepliedAnswerWithViewerVote[] | null;
};

function toInteger(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function resolveOptionalAuthorName(
  displayName: string | null,
  fullName: string | null,
): string | null {
  const normalizedDisplayName = displayName?.trim();
  if (normalizedDisplayName && normalizedDisplayName.length > 0) {
    return normalizedDisplayName;
  }

  const normalizedFullName = fullName?.trim();
  return normalizedFullName && normalizedFullName.length > 0
    ? normalizedFullName
    : null;
}

function resolveAuthorName(row: AnswerHydrationRow): string {
  return (
    resolveOptionalAuthorName(row.authorDisplayName, row.authorFullName) ?? ""
  );
}

function compareAnswersByCreatedAt(
  left: Pick<RepliedAnswerWithViewerVote, "createdAt">,
  right: Pick<RepliedAnswerWithViewerVote, "createdAt">,
) {
  return left.createdAt.localeCompare(right.createdAt);
}

function buildAnswersBaseQuery(
  executor: Pick<typeof db, "select">,
  viewerId: string,
) {
  return executor
    .select({
      answer: forumAnswer,
      questionBestAnswerId: sql<string | null>`(
        select ${forumQuestion.bestAnswerId}
        from ${forumQuestion}
        where ${forumQuestion.id} = ${forumAnswer.questionId}
      )`,
      authorDisplayName: userProfile.displayName,
      authorFullName: user.name,
      authorAvatarKey: userProfile.avatarKey,
      viewerVoteType: forumAnswerVote.voteType,
    })
    .from(forumAnswer)
    .innerJoin(user, eq(user.id, forumAnswer.authorId))
    .leftJoin(userProfile, eq(userProfile.userId, user.id))
    .leftJoin(
      forumAnswerVote,
      and(
        eq(forumAnswerVote.answerId, forumAnswer.id),
        eq(forumAnswerVote.voterId, viewerId),
      ),
    );
}

function buildPublicAnswersBaseQuery(executor: Pick<typeof db, "select">) {
  return executor
    .select({
      answer: forumAnswer,
      questionBestAnswerId: sql<string | null>`(
        select ${forumQuestion.bestAnswerId}
        from ${forumQuestion}
        where ${forumQuestion.id} = ${forumAnswer.questionId}
      )`,
      authorDisplayName: userProfile.displayName,
      authorFullName: user.name,
      authorAvatarKey: userProfile.avatarKey,
      viewerVoteType: sql<null>`null`,
    })
    .from(forumAnswer)
    .innerJoin(user, eq(user.id, forumAnswer.authorId))
    .leftJoin(userProfile, eq(userProfile.userId, user.id));
}

function hydrateAnswer(row: AnswerHydrationRow): ForumAnswerWithViewerVote {
  const { authorId, deletedAt: _deletedAt, ...answer } = row.answer;

  return {
    ...answer,
    score: answer.upvoteCount - answer.downvoteCount,
    isBestAnswer: answer.id === row.questionBestAnswerId,
    viewerVote: row.viewerVoteType
      ? (row.viewerVoteType as AnswerVoteType)
      : null,
    repliedAnswers: null,
    author: {
      id: authorId,
      name: resolveAuthorName(row),
      avatarKey: row.authorAvatarKey,
    },
  };
}

function hydratePublicAnswer(
  row: PublicAnswerHydrationRow,
): ForumAnswerWithViewerVote {
  return hydrateAnswer({
    ...row,
    viewerVoteType: null,
  });
}

function groupAnswersWithReplies(
  answers: ForumAnswerWithViewerVote[],
): ForumAnswerWithViewerVote[] {
  const rootAnswers: ForumAnswerWithViewerVote[] = [];
  const rootAnswerMap = new Map<string, ForumAnswerWithViewerVote>();
  const replyAnswers: ForumAnswerWithViewerVote[] = [];

  for (const answer of answers) {
    const normalizedAnswer: ForumAnswerWithViewerVote = {
      ...answer,
      repliedAnswers: null,
    };

    if (normalizedAnswer.replyTo) {
      replyAnswers.push(normalizedAnswer);
      continue;
    }

    rootAnswers.push(normalizedAnswer);
    rootAnswerMap.set(normalizedAnswer.id, normalizedAnswer);
  }

  for (const answer of replyAnswers) {
    const parentAnswer = rootAnswerMap.get(answer.replyTo as string);
    if (!parentAnswer) {
      continue;
    }

    if (!parentAnswer.repliedAnswers) {
      parentAnswer.repliedAnswers = [];
    }

    const { repliedAnswers: omittedRepliedAnswers, ...repliedAnswer } = answer;
    parentAnswer.repliedAnswers.push(repliedAnswer);
  }

  for (const answer of rootAnswers) {
    if (answer.repliedAnswers) {
      answer.repliedAnswers.sort(compareAnswersByCreatedAt);
    }
  }

  return rootAnswers;
}

export async function findQuestionById(
  id: string,
): Promise<ForumQuestionRow | null> {
  const rows = await db
    .select()
    .from(forumQuestion)
    .where(eq(forumQuestion.id, id));
  return rows[0] ?? null;
}

export async function findAnswerById(
  id: string,
): Promise<ForumAnswerRow | null> {
  const rows = await db
    .select()
    .from(forumAnswer)
    .where(eq(forumAnswer.id, id));
  return rows[0] ?? null;
}

export async function findAnswerWithViewerVoteById(
  id: string,
  viewerId: string,
): Promise<ForumAnswerWithViewerVote | null> {
  const rows = await buildAnswersBaseQuery(db, viewerId)
    .where(and(eq(forumAnswer.id, id), eq(forumAnswer.status, "PUBLISHED")))
    .limit(1);

  return rows[0] ? hydrateAnswer(rows[0]) : null;
}

export async function findAnswersByQuestionId(
  questionId: string,
  viewerId: string,
): Promise<ForumAnswerWithViewerVote[]> {
  const rows = await buildAnswersBaseQuery(db, viewerId)
    .where(
      and(
        eq(forumAnswer.questionId, questionId),
        eq(forumAnswer.status, "PUBLISHED"),
      ),
    )
    .orderBy(desc(forumAnswer.upvoteCount), desc(forumAnswer.createdAt));

  return groupAnswersWithReplies(rows.map((row) => hydrateAnswer(row)));
}

export async function findAnswersByQuestionIdPublic(
  questionId: string,
): Promise<ForumAnswerWithViewerVote[]> {
  const rows = await buildPublicAnswersBaseQuery(db)
    .where(
      and(
        eq(forumAnswer.questionId, questionId),
        eq(forumAnswer.status, "PUBLISHED"),
      ),
    )
    .orderBy(desc(forumAnswer.upvoteCount), desc(forumAnswer.createdAt));

  return groupAnswersWithReplies(rows.map((row) => hydratePublicAnswer(row)));
}

export async function findAnswersByAuthorId(
  authorId: string,
): Promise<ForumAnswerWithViewerVote[]> {
  const rows = await buildAnswersBaseQuery(db, authorId)
    .innerJoin(forumQuestion, eq(forumQuestion.id, forumAnswer.questionId))
    .where(
      and(
        eq(forumAnswer.authorId, authorId),
        eq(forumAnswer.status, "PUBLISHED"),
        eq(forumQuestion.status, "PUBLISHED"),
      ),
    )
    .orderBy(desc(forumAnswer.createdAt), desc(forumAnswer.upvoteCount));

  return rows.map((row) => hydrateAnswer(row));
}

export async function createAnswer(
  data: CreateAnswerInput,
  authorId: string,
): Promise<ForumAnswerWithViewerVote> {
  return db.transaction(async (tx) => {
    const answerInsertData: ForumAnswerInsert = {
      questionId: data.questionId,
      authorId,
      body: data.body,
      replyTo: data.replyToAnswer,
      status: "PUBLISHED",
      upvoteCount: 0,
      downvoteCount: 0,
      replyCount: 0,
    };

    const [newAnswer] = await tx
      .insert(forumAnswer)
      .values(answerInsertData)
      .returning();

    await tx
      .update(forumQuestion)
      .set({
        answerCount: sql`greatest(${forumQuestion.answerCount} + 1, 0)`,
        updatedAt: sql`now()`,
      })
      .where(eq(forumQuestion.id, data.questionId));

    if (data.replyToAnswer) {
      const updatedParentAnswers = await tx
        .update(forumAnswer)
        .set({
          replyCount: sql`greatest(${forumAnswer.replyCount} + 1, 0)`,
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(forumAnswer.id, data.replyToAnswer),
            eq(forumAnswer.status, "PUBLISHED"),
          ),
        )
        .returning({ id: forumAnswer.id });

      if (updatedParentAnswers.length === 0) {
        throw new ReplyTargetUnavailableError();
      }
    }

    const createdRows = await buildAnswersBaseQuery(tx, authorId)
      .where(
        and(
          eq(forumAnswer.id, newAnswer.id),
          eq(forumAnswer.status, "PUBLISHED"),
        ),
      )
      .limit(1);

    const createdAnswer = createdRows[0] ? hydrateAnswer(createdRows[0]) : null;
    if (!createdAnswer) {
      throw new Error("Created answer could not be loaded");
    }

    return createdAnswer;
  });
}

export async function updateAnswer(
  answerId: string,
  authorId: string,
  data: UpdateAnswerInput,
): Promise<ForumAnswerWithViewerVote | null> {
  return db.transaction(async (tx) => {
    const [updatedAnswer] = await tx
      .update(forumAnswer)
      .set({
        body: data.body,
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(forumAnswer.id, answerId),
          eq(forumAnswer.authorId, authorId),
          eq(forumAnswer.status, "PUBLISHED"),
        ),
      )
      .returning({ id: forumAnswer.id });

    if (!updatedAnswer) {
      return null;
    }

    const updatedRows = await buildAnswersBaseQuery(tx, authorId)
      .where(
        and(
          eq(forumAnswer.id, updatedAnswer.id),
          eq(forumAnswer.status, "PUBLISHED"),
        ),
      )
      .limit(1);

    return updatedRows[0] ? hydrateAnswer(updatedRows[0]) : null;
  });
}

export async function softDeleteAnswer(
  answerId: string,
  authorId: string,
): Promise<ForumAnswerRow | null> {
  return db.transaction(async (tx) => {
    const [deletedAnswer] = await tx
      .update(forumAnswer)
      .set({
        status: "DELETED",
        deletedAt: sql`now()`,
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(forumAnswer.id, answerId),
          eq(forumAnswer.authorId, authorId),
          eq(forumAnswer.status, "PUBLISHED"),
        ),
      )
      .returning();

    if (!deletedAnswer) {
      return null;
    }

    let totalDeletedCount = 1;
    const deletedAnswerIds = [deletedAnswer.id];

    if (deletedAnswer.replyTo) {
      await tx
        .update(forumAnswer)
        .set({
          replyCount: sql`greatest(${forumAnswer.replyCount} - 1, 0)`,
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(forumAnswer.id, deletedAnswer.replyTo),
            eq(forumAnswer.status, "PUBLISHED"),
          ),
        );
    }

    if (!deletedAnswer.replyTo) {
      const deletedReplies = await tx
        .update(forumAnswer)
        .set({
          status: "DELETED",
          deletedAt: sql`now()`,
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(forumAnswer.replyTo, deletedAnswer.id),
            eq(forumAnswer.status, "PUBLISHED"),
          ),
        )
        .returning({ id: forumAnswer.id });

      totalDeletedCount += deletedReplies.length;
      deletedAnswerIds.push(...deletedReplies.map((answer) => answer.id));
    }

    await tx
      .update(forumQuestion)
      .set({
        answerCount: sql`greatest(${forumQuestion.answerCount} - ${totalDeletedCount}, 0)`,
        updatedAt: sql`now()`,
      })
      .where(eq(forumQuestion.id, deletedAnswer.questionId));

    await tx
      .update(forumQuestion)
      .set({
        bestAnswerId: null,
        bestAnswerSelectedAt: null,
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(forumQuestion.id, deletedAnswer.questionId),
          inArray(forumQuestion.bestAnswerId, deletedAnswerIds),
        ),
      );

    return deletedAnswer;
  });
}

export async function markBestAnswer(
  answerId: string,
  questionAuthorId: string,
): Promise<ForumAnswerWithViewerVote | null> {
  return db.transaction(async (tx) => {
    const [answer] = await tx
      .select()
      .from(forumAnswer)
      .where(
        and(eq(forumAnswer.id, answerId), eq(forumAnswer.status, "PUBLISHED")),
      )
      .limit(1);

    if (!answer) {
      return null;
    }

    // Serialize best-answer assignment per question.
    await tx.execute(
      sql`select pg_advisory_xact_lock(${FORUM_ADVISORY_LOCK_NAMESPACE}, hashtext(${answer.questionId}))`,
    );

    const [question] = await tx
      .select()
      .from(forumQuestion)
      .where(
        and(
          eq(forumQuestion.id, answer.questionId),
          inArray(forumQuestion.status, ["PUBLISHED", "CLOSED"]),
        ),
      )
      .limit(1);

    if (!question) {
      return null;
    }

    if (question.authorId !== questionAuthorId) {
      throw new BestAnswerSelectionForbiddenError();
    }

    const [updatedQuestion] = await tx
      .update(forumQuestion)
      .set({
        bestAnswerId: answer.id,
        bestAnswerSelectedAt: sql`now()`,
        updatedAt: sql`now()`,
      })
      .where(eq(forumQuestion.id, question.id))
      .returning({ id: forumQuestion.id });

    if (!updatedQuestion) {
      return null;
    }

    const markedRows = await buildAnswersBaseQuery(tx, questionAuthorId)
      .where(
        and(
          eq(forumAnswer.id, answer.id),
          eq(forumAnswer.status, "PUBLISHED"),
        ),
      )
      .limit(1);

    return markedRows[0] ? hydrateAnswer(markedRows[0]) : null;
  });
}

export async function setAnswerVote(
  answerId: string,
  voterId: string,
  voteIntent: VoteIntent,
): Promise<ForumAnswerWithViewerVote | null> {
  return db.transaction(async (tx) => {
    // Serialize vote updates per answer inside the forum advisory-lock namespace.
    await tx.execute(
      sql`select pg_advisory_xact_lock(${FORUM_ADVISORY_LOCK_NAMESPACE}, hashtext(${answerId}))`,
    );

    const [answer] = await tx
      .select()
      .from(forumAnswer)
      .where(
        and(eq(forumAnswer.id, answerId), eq(forumAnswer.status, "PUBLISHED")),
      );

    if (!answer) {
      return null;
    }

    if (voteIntent === "NONE") {
      await tx
        .delete(forumAnswerVote)
        .where(
          and(
            eq(forumAnswerVote.answerId, answerId),
            eq(forumAnswerVote.voterId, voterId),
          ),
        );
    } else {
      const voteInsertData: ForumAnswerVoteInsert = {
        answerId,
        voterId,
        voteType: voteIntent,
      };

      await tx
        .insert(forumAnswerVote)
        .values(voteInsertData)
        .onConflictDoUpdate({
          target: [forumAnswerVote.answerId, forumAnswerVote.voterId],
          set: {
            voteType: voteIntent,
            updatedAt: sql`now()`,
          },
        });
    }

    const [voteCountRow] = await tx
      .select({
        upvoteCount: sql`coalesce(sum(case when ${forumAnswerVote.voteType} = 'UPVOTE' then 1 else 0 end), 0)`,
        downvoteCount: sql`coalesce(sum(case when ${forumAnswerVote.voteType} = 'DOWNVOTE' then 1 else 0 end), 0)`,
      })
      .from(forumAnswerVote)
      .where(eq(forumAnswerVote.answerId, answerId));

    const normalizedUpvoteCount = toInteger(voteCountRow?.upvoteCount);
    const normalizedDownvoteCount = toInteger(voteCountRow?.downvoteCount);

    const [updatedAnswer] = await tx
      .update(forumAnswer)
      .set({
        upvoteCount: normalizedUpvoteCount,
        downvoteCount: normalizedDownvoteCount,
        updatedAt: sql`now()`,
      })
      .where(eq(forumAnswer.id, answerId))
      .returning({ id: forumAnswer.id });

    if (!updatedAnswer) {
      return null;
    }

    const votedRows = await buildAnswersBaseQuery(tx, voterId)
      .where(
        and(
          eq(forumAnswer.id, updatedAnswer.id),
          eq(forumAnswer.status, "PUBLISHED"),
        ),
      )
      .limit(1);

    return votedRows[0] ? hydrateAnswer(votedRows[0]) : null;
  });
}
