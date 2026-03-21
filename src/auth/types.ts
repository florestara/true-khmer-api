export type AuthPayload = {
  sub?: string;
  [key: string]: unknown;
};

export type AuthContext = {
  userId: string;
};

export type GetAuthUserIdResult =
  | { ok: true; userId: string }
  | { ok: false; response: Response };