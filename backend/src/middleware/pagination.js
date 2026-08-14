/**
 * Every list endpoint used to return the whole table.
 *
 * That was survivable at a handful of rows and is the reason both list screens
 * now take seconds: the database reads everything, Node serialises everything,
 * and the browser parses everything, to render thirty visible lines.
 *
 * Callers that genuinely need all rows (an export, say) can pass `all=1`, which
 * is still bounded by HARD_MAX so a bad request cannot ask for a million rows.
 */
const DEFAULT_LIMIT = 50;
const HARD_MAX = 500;

export function parsePaging(query = {}, defaultLimit = DEFAULT_LIMIT) {
  const wantsAll = query.all === '1' || query.all === 'true';

  const rawLimit = Number(query.limit);
  const limit = wantsAll
    ? HARD_MAX
    : Math.min(HARD_MAX, Math.max(1, Number.isFinite(rawLimit) && rawLimit > 0 ? Math.trunc(rawLimit) : defaultLimit));

  const rawPage = Number(query.page);
  const page = Math.max(1, Number.isFinite(rawPage) && rawPage > 0 ? Math.trunc(rawPage) : 1);

  return { limit, offset: (page - 1) * limit, page };
}

/** Uniform envelope so the client can always tell whether more rows exist. */
export function pageResult({ rows, count, page, limit, extra = {} }) {
  return {
    rows,
    count,
    page,
    limit,
    hasMore: page * limit < count,
    ...extra,
  };
}
