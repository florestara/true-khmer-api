export type AuthPayload = {
  sub?: string;
  [key: string]: unknown;
};

export function getAuthUserId(payload: AuthPayload | undefined): string | undefined {
  const sub = payload?.sub;
  if (typeof sub === "string") {
    const normalizedSub = sub.trim();
    if (normalizedSub.length > 0) {
      return normalizedSub;
    }
  }
  return undefined;
}
