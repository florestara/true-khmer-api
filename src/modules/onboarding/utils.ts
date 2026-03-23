export function normalizeLocationName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}
