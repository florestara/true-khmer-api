export type PagePagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

type BuildPagePaginationParams<T> = {
  rows: T[];
  page: number;
  limit: number;
};

function normalizePositiveInteger(value: number, fallback: number): number {
  return Number.isFinite(value) && Number.isInteger(value) && value > 0
    ? value
    : fallback;
}

export function buildPagePagination<T>({
  rows,
  page,
  limit,
}: BuildPagePaginationParams<T>) {
  const normalizedLimit = normalizePositiveInteger(limit, 1);
  const total = rows.length;
  const totalPages = Math.ceil(total / normalizedLimit);
  const normalizedPage = Math.min(
    normalizePositiveInteger(page, 1),
    Math.max(totalPages, 1),
  );
  const start = (normalizedPage - 1) * normalizedLimit;
  const pageRows = rows.slice(start, start + normalizedLimit);

  return {
    pageRows,
    pagination: {
      page: normalizedPage,
      limit: normalizedLimit,
      total,
      totalPages,
      hasNextPage: normalizedPage < totalPages,
      hasPreviousPage: normalizedPage > 1,
    },
  };
}
