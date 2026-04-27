export type CursorPagination = {
  limit: number;
  hasMore: boolean;
  nextCursor: string | null;
  total: number;
};

type BuildCursorPaginationParams<T> = {
  rows: T[];
  limit: number;
  total: number;
  getNextCursor: (lastRow: T) => string | null;
};

export function buildCursorPagination<T>({
  rows,
  limit,
  total,
  getNextCursor,
}: BuildCursorPaginationParams<T>) {
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const lastRow = pageRows.length > 0 ? pageRows[pageRows.length - 1] : null;
  const nextCursor = hasMore && lastRow ? getNextCursor(lastRow) : null;

  return {
    pageRows,
    pagination: {
      limit,
      hasMore,
      nextCursor,
      total,
    },
  };
}

export function normalizePaginationTotal(
  total: number | string | bigint | null | undefined,
) {
  if (typeof total === "number") {
    return total;
  }

  if (typeof total === "bigint") {
    return Number(total);
  }

  if (typeof total === "string") {
    return Number(total);
  }

  return 0;
}
