/**
 * Data-table state lives in the URL so views are shareable and survive a
 * reload. Parsing is tolerant (a hand-edited link is clamped, never an error);
 * strict validation stays with each list's zod query schema on the server.
 */

export type TableState = { page: number; pageSize: number; sort?: string; filters: Record<string, string> };

export const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

const toInt = (v: string | null) => {
  const n = v === null ? NaN : Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
};

export function parseTableState(params: URLSearchParams, opts: { filterKeys: readonly string[]; defaultPageSize?: number }): TableState {
  const defaultSize = opts.defaultPageSize ?? DEFAULT_PAGE_SIZE;
  const filters: Record<string, string> = {};
  for (const key of opts.filterKeys) {
    const v = params.get(key);
    if (v) filters[key] = v;
  }
  const sort = params.get("sort") || undefined;
  return {
    page: Math.max(1, toInt(params.get("page")) ?? 1),
    pageSize: Math.min(MAX_PAGE_SIZE, Math.max(1, toInt(params.get("pageSize")) ?? defaultSize)),
    ...(sort && { sort }),
    filters,
  };
}

type Patch = Partial<Omit<TableState, "filters">> & { filters?: Record<string, string | undefined> };

/** URL for `state` with `patch` applied. Changing filters or sort goes back to page 1; defaults are omitted. */
export function tableStateHref(pathname: string, state: TableState, patch: Patch, defaultPageSize = DEFAULT_PAGE_SIZE): string {
  const filters: Record<string, string | undefined> = { ...state.filters, ...patch.filters };
  const sort = "sort" in patch ? patch.sort : state.sort;
  const resetPage = patch.filters !== undefined || ("sort" in patch && patch.sort !== state.sort);
  const page = patch.page ?? (resetPage ? 1 : state.page);
  const pageSize = patch.pageSize ?? state.pageSize;

  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v) q.set(k, v);
  if (sort) q.set("sort", sort);
  if (page > 1) q.set("page", String(page));
  if (pageSize !== defaultPageSize) q.set("pageSize", String(pageSize));
  const qs = q.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
