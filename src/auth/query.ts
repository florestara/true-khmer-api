import { eq } from "drizzle-orm";
import { db } from "../db/index";
import { session, user } from "../db/schema/index";

export async function findSessionOwnerByRefreshToken(refreshToken: string) {
  const [sessionOwner] = await db
    .select({
      userId: session.userId,
      email: user.email,
    })
    .from(session)
    .innerJoin(user, eq(user.id, session.userId))
    .where(eq(session.token, refreshToken))
    .limit(1);

  return sessionOwner ?? null;
}

export async function findUserRoleById(userId: string) {
  const [foundUser] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  return foundUser ?? null;
}
