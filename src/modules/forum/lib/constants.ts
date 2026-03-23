export const FORUM_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const FORUM_ADVISORY_LOCK_NAMESPACE = 100;
export const FORUM_CATEGORY_DISPLAY_ORDER_LOCK_KEY = 1;

export const POSTGRES_FOREIGN_KEY_VIOLATION = "23503";
export const POSTGRES_UNIQUE_VIOLATION = "23505";
