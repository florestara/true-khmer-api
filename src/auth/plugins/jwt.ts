const ALLOWED_ROLES = new Set(["user", "admin"]);

function normalizeRole(role: unknown): "user" | "admin" {
  if (typeof role === "string" && ALLOWED_ROLES.has(role)) {
    return role as "user" | "admin";
  }
  return "user";
}

function getRequiredUserId(user: Record<string, unknown>) {
  const id = user.id;

  if (id === null || id === undefined) {
    throw new Error("Cannot generate JWT subject: user.id is null or undefined");
  }

  if (typeof id !== "string" || id.trim() === "") {
    throw new Error("Cannot generate JWT subject: user.id must be a non-empty string");
  }

  return id;
}

export const jwtPluginConfig = {
  jwt: {
    expirationTime: "15m",
    definePayload: async ({
      user,
      session,
    }: {
      user: Record<string, unknown>;
      session: { id: string };
    }) => ({
      // Token type discriminator: this plugin only issues access tokens.
      // Downstream auth/authorization logic can rely on `type === "access"`
      // to distinguish these JWTs from other token types (e.g. refresh tokens).
      type: "access",
      role: normalizeRole(user.role),
      emailVerified: Boolean(user.emailVerified),
      sid: session.id,
    }),
    getSubject: async ({ user }: { user: Record<string, unknown> }) =>
      getRequiredUserId(user),
  },
} as const;
