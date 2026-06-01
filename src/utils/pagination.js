const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 14;
const MAX_LIMIT = 100;

/**
 * Parses page/limit from query string (offset pagination).
 * @returns {{ page: number, limit: number, skip: number }}
 */
export const parsePaginationQuery = (query = {}) => {
  let page = Number.parseInt(query.page, 10);
  let limit = Number.parseInt(query.limit, 10);

  if (!Number.isFinite(page) || page < 1) page = DEFAULT_PAGE;
  if (!Number.isFinite(limit) || limit < 1) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;

  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

/**
 * Builds pagination metadata for list responses.
 */
export const buildPaginationMeta = ({ page, limit, total }) => {
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  const from = total === 0 ? 0 : skipToFrom(page, limit);
  const to = total === 0 ? 0 : Math.min(page * limit, total);

  return {
    page,
    limit,
    total,
    totalPages,
    from,
    to,
  };
};

const skipToFrom = (page, limit) => (page - 1) * limit + 1;
