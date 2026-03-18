import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../../../db/index";
import { forumAnswer, forumAnswerVote, forumQuestion } from "../../../db/schema";
import { FORUM_ADVISORY_LOCK_NAMESPACE } from "../constants";
import type {
  AnswerVoteType,
  CreateAnswerInput,
  UpdateAnswerInput,
  VoteIntent,
} from "./schema";

type ForumQuestionRow = typeof forumQuestion.$inferSelect;
type ForumAnswerRow = typeof forumAnswer.$inferSelect;
type ForumAnswerInsert = typeof forumAnswer.$inferInsert;
type ForumAnswerVoteInsert = typeof forumAnswerVote.$inferInsert;
type ForumAnswerWithViewerVote = ForumAnswerRow & {
  score: number;
  viewerVote: AnswerVoteType | null;
};

function toInteger(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function hydrateAnswer(
  answer: ForumAnswerRow,
  viewerVote: AnswerVoteType | null,
): ForumAnswerWithViewerVote {
  return {
    ...answer,
    score: answer.upvoteCount - answer.downvoteCount,
    viewerVote,
  };
}

export async function findQuestionById(id: string): Promise<ForumQuestionRow | null> {
  const rows = await db.select().from(forumQuestion).where(eq(forumQuestion.id, id));
  return rows[0] ?? null;
}

export async function findAnswerById(id: string): Promise<ForumAnswerRow | null> {
  const rows = await db.select().from(forumAnswer).where(eq(forumAnswer.id, id));
  return rows[0] ?? null;
}

export async function findAnswersByQuestionId(
  questionId: string,
  viewerId: string,
): Promise<ForumAnswerWithViewerVote[]> {
  const rows = await db
    .select({
      answer: forumAnswer,
      viewerVoteType: forumAnswerVote.voteType,
    })
    .from(forumAnswer)
    .leftJoin(
      forumAnswerVote,
      and(
        eq(forumAnswerVote.answerId, forumAnswer.id),
        eq(forumAnswerVote.voterId, viewerId),
      ),
    )
    .where(and(eq(forumAnswer.questionId, questionId), eq(forumAnswer.status, "PUBLISHED")))
    .orderBy(desc(forumAnswer.upvoteCount), desc(forumAnswer.createdAt));

  return rows.map((row) =>
    hydrateAnswer(
      row.answer,
      row.viewerVoteType ? (row.viewerVoteType as AnswerVoteType) : null,
    ),
  );
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
      status: "PUBLISHED",
      upvoteCount: 0,
      downvoteCount: 0,
    };

    const [newAnswer] = await tx.insert(forumAnswer).values(answerInsertData).returning();

    await tx
      .update(forumQuestion)
      .set({
        answerCount: sql`greatest(${forumQuestion.answerCount} + 1, 0)`,
        updatedAt: sql`now()`,
      })
      .where(eq(forumQuestion.id, data.questionId));

    return hydrateAnswer(newAnswer, null);
  });
}

export async function updateAnswer(
  answerId: string,
  authorId: string,
  data: UpdateAnswerInput,
): Promise<ForumAnswerWithViewerVote | null> {
  const [updatedAnswer] = await db
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
    .returning();

  return updatedAnswer ? hydrateAnswer(updatedAnswer, null) : null;
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

    await tx
      .update(forumQuestion)
      .set({
        answerCount: sql`greatest(${forumQuestion.answerCount} - 1, 0)`,
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
      .where(and(eq(forumAnswer.id, answerId), eq(forumAnswer.status, "PUBLISHED")));

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
        upvoteCount:
          sql`coalesce(sum(case when ${forumAnswerVote.voteType} = 'UPVOTE' then 1 else 0 end), 0)`,
        downvoteCount:
          sql`coalesce(sum(case when ${forumAnswerVote.voteType} = 'DOWNVOTE' then 1 else 0 end), 0)`,
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
      .returning();

    if (!updatedAnswer) {
      return null;
    }

    const [viewerVoteRow] = await tx
      .select({
        voteType: forumAnswerVote.voteType,
      })
      .from(forumAnswerVote)
      .where(
        and(eq(forumAnswerVote.answerId, answerId), eq(forumAnswerVote.voterId, voterId)),
      )
      .limit(1);

    return hydrateAnswer(
      updatedAnswer,
      viewerVoteRow?.voteType ? (viewerVoteRow.voteType as AnswerVoteType) : null,
    );
  });
}
