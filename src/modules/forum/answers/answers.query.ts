import { and, desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
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
const replyTargetAnswer = alias(forumAnswer, "reply_target_answer");
const replyTargetUser = alias(user, "reply_target_user");
const replyTargetUserProfile = alias(
  userProfile,
  "reply_target_user_profile",
);
const replyTargetVote = alias(forumAnswerVote, "reply_target_vote");

type AnswerHydrationRow = {
  answer: ForumAnswerRow;
  authorDisplayName: string | null;
  authorFullName: string;
  authorAvatarKey: string | null;
  viewerVoteType: string | null;
  replyTargetId: string | null;
  replyTargetBody: string | null;
  replyTargetStatus: ForumAnswerRow["status"] | null;
  replyTargetAuthorId: string | null;
  replyTargetAuthorDisplayName: string | null;
  replyTargetAuthorFullName: string | null;
  replyTargetAuthorAvatarKey: string | null;
  replyTargetUpvoteCount: number | null;
  replyTargetDownvoteCount: number | null;
  replyTargetReplyCount: number | null;
  replyTargetCreatedAt: string | null;
  replyTargetUpdatedAt: string | null;
  replyTargetQuestionId: string | null;
  replyTargetViewerVoteType: string | null;
};
type PublicAnswerHydrationRow = Omit<
  AnswerHydrationRow,
  "viewerVoteType" | "replyTargetViewerVoteType"
>;
type ReplyTargetEmbeddedAnswer = {
  id: string;
  body: string;
  upvoteCount: number;
  downvoteCount: number;
  replyCount: number;
  score: number;
  viewerVote: AnswerVoteType | null;
  createdAt: string;
  updatedAt: string;
  questionId: string;
  status: "PUBLISHED";
  replyTo: null;
  author: {
    id: string;
    name: string;
    avatarKey: string | null;
  };
};
type ForumAnswerWithViewerVote = Omit<ForumAnswerRow, "authorId" | "deletedAt"> & {
  score: number;
  viewerVote: AnswerVoteType | null;
  replyToAnswer: ReplyTargetEmbeddedAnswer | null;
  author: {
    id: string;
    name: string;
    avatarKey: string | null;
  };
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
  return resolveOptionalAuthorName(row.authorDisplayName, row.authorFullName) ?? "";
}

function hydrateReplyTarget(
  row: Pick<
    AnswerHydrationRow,
    | "replyTargetId"
    | "replyTargetBody"
    | "replyTargetStatus"
    | "replyTargetAuthorId"
    | "replyTargetAuthorDisplayName"
    | "replyTargetAuthorFullName"
    | "replyTargetAuthorAvatarKey"
    | "replyTargetUpvoteCount"
    | "replyTargetDownvoteCount"
    | "replyTargetReplyCount"
    | "replyTargetCreatedAt"
    | "replyTargetUpdatedAt"
    | "replyTargetQuestionId"
    | "replyTargetViewerVoteType"
  >,
): ReplyTargetEmbeddedAnswer | null {
  if (!row.replyTargetId || row.replyTargetStatus !== "PUBLISHED") {
    return null;
  }

  const replyTargetAuthorName = resolveOptionalAuthorName(
    row.replyTargetAuthorDisplayName,
    row.replyTargetAuthorFullName,
  );

  if (
    !row.replyTargetAuthorId ||
    !replyTargetAuthorName ||
    row.replyTargetBody === null ||
    row.replyTargetUpvoteCount === null ||
    row.replyTargetDownvoteCount === null ||
    row.replyTargetReplyCount === null ||
    row.replyTargetCreatedAt === null ||
    row.replyTargetUpdatedAt === null ||
    row.replyTargetQuestionId === null
  ) {
    return null;
  }

  return {
    id: row.replyTargetId,
    body: row.replyTargetBody,
    upvoteCount: row.replyTargetUpvoteCount,
    downvoteCount: row.replyTargetDownvoteCount,
    replyCount: row.replyTargetReplyCount,
    score: row.replyTargetUpvoteCount - row.replyTargetDownvoteCount,
    viewerVote: row.replyTargetViewerVoteType
      ? (row.replyTargetViewerVoteType as AnswerVoteType)
      : null,
    createdAt: row.replyTargetCreatedAt,
    updatedAt: row.replyTargetUpdatedAt,
    questionId: row.replyTargetQuestionId,
    status: "PUBLISHED",
    replyTo: null,
    author: {
      id: row.replyTargetAuthorId,
      name: replyTargetAuthorName,
      avatarKey: row.replyTargetAuthorAvatarKey,
    },
  };
}

function buildAnswersBaseQuery(
  executor: Pick<typeof db, "select">,
  viewerId: string,
) {
  return executor
    .select({
      answer: forumAnswer,
      authorDisplayName: userProfile.displayName,
      authorFullName: user.name,
      authorAvatarKey: userProfile.avatarKey,
      viewerVoteType: forumAnswerVote.voteType,
      replyTargetId: replyTargetAnswer.id,
      replyTargetBody: replyTargetAnswer.body,
      replyTargetStatus: replyTargetAnswer.status,
      replyTargetAuthorId: replyTargetAnswer.authorId,
      replyTargetAuthorDisplayName: replyTargetUserProfile.displayName,
      replyTargetAuthorFullName: replyTargetUser.name,
      replyTargetAuthorAvatarKey: replyTargetUserProfile.avatarKey,
      replyTargetUpvoteCount: replyTargetAnswer.upvoteCount,
      replyTargetDownvoteCount: replyTargetAnswer.downvoteCount,
      replyTargetReplyCount: replyTargetAnswer.replyCount,
      replyTargetCreatedAt: replyTargetAnswer.createdAt,
      replyTargetUpdatedAt: replyTargetAnswer.updatedAt,
      replyTargetQuestionId: replyTargetAnswer.questionId,
      replyTargetViewerVoteType: replyTargetVote.voteType,
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
    )
    .leftJoin(replyTargetAnswer, eq(replyTargetAnswer.id, forumAnswer.replyTo))
    .leftJoin(replyTargetUser, eq(replyTargetUser.id, replyTargetAnswer.authorId))
    .leftJoin(
      replyTargetUserProfile,
      eq(replyTargetUserProfile.userId, replyTargetUser.id),
    )
    .leftJoin(
      replyTargetVote,
      and(
        eq(replyTargetVote.answerId, replyTargetAnswer.id),
        eq(replyTargetVote.voterId, viewerId),
      ),
    );
}

function buildPublicAnswersBaseQuery(executor: Pick<typeof db, "select">) {
  return executor
    .select({
      answer: forumAnswer,
      authorDisplayName: userProfile.displayName,
      authorFullName: user.name,
      authorAvatarKey: userProfile.avatarKey,
      replyTargetId: replyTargetAnswer.id,
      replyTargetBody: replyTargetAnswer.body,
      replyTargetStatus: replyTargetAnswer.status,
      replyTargetAuthorId: replyTargetAnswer.authorId,
      replyTargetAuthorDisplayName: replyTargetUserProfile.displayName,
      replyTargetAuthorFullName: replyTargetUser.name,
      replyTargetAuthorAvatarKey: replyTargetUserProfile.avatarKey,
      replyTargetUpvoteCount: replyTargetAnswer.upvoteCount,
      replyTargetDownvoteCount: replyTargetAnswer.downvoteCount,
      replyTargetReplyCount: replyTargetAnswer.replyCount,
      replyTargetCreatedAt: replyTargetAnswer.createdAt,
      replyTargetUpdatedAt: replyTargetAnswer.updatedAt,
      replyTargetQuestionId: replyTargetAnswer.questionId,
      replyTargetViewerVoteType: sql<null>`null`,
    })
    .from(forumAnswer)
    .innerJoin(user, eq(user.id, forumAnswer.authorId))
    .leftJoin(userProfile, eq(userProfile.userId, user.id))
    .leftJoin(replyTargetAnswer, eq(replyTargetAnswer.id, forumAnswer.replyTo))
    .leftJoin(replyTargetUser, eq(replyTargetUser.id, replyTargetAnswer.authorId))
    .leftJoin(
      replyTargetUserProfile,
      eq(replyTargetUserProfile.userId, replyTargetUser.id),
    );
}

function hydrateAnswer(
  row: AnswerHydrationRow,
): ForumAnswerWithViewerVote {
  const { authorId, deletedAt: _deletedAt, ...answer } = row.answer;

  return {
    ...answer,
    score: answer.upvoteCount - answer.downvoteCount,
    viewerVote: row.viewerVoteType ? (row.viewerVoteType as AnswerVoteType) : null,
    replyToAnswer: hydrateReplyTarget(row),
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
    replyTargetViewerVoteType: null,
  });
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

  return rows.map((row) => hydrateAnswer(row));
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

  return rows.map((row) => hydratePublicAnswer(row));
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
      replyTo: data.replyTo,
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

    if (data.replyTo) {
      await tx
        .update(forumAnswer)
        .set({
          replyCount: sql`greatest(${forumAnswer.replyCount} + 1, 0)`,
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(forumAnswer.id, data.replyTo),
            eq(forumAnswer.status, "PUBLISHED"),
          ),
        );
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
    }

    await tx
      .update(forumQuestion)
      .set({
        answerCount: sql`greatest(${forumQuestion.answerCount} - ${totalDeletedCount}, 0)`,
        updatedAt: sql`now()`,
      })
      .where(eq(forumQuestion.id, deletedAnswer.questionId));

    return deletedAnswer;
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
