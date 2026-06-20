import { OpportunitiesApiError, type PageInfo } from '../../api/fetchOpportunities';
import type { HotItem, ProviderStats } from '../../types/hot';

export type PaginationErrorKind = 'network' | 'invalid_cursor' | 'cursor_expired';

export interface PaginationErrorState {
  kind: PaginationErrorKind;
  message: string;
}

export interface OpportunityPaginationState {
  loadMoreLoading: boolean;
  loadMoreError: PaginationErrorState | null;
  cursorExpired: boolean;
  invalidCursor: boolean;
  hasMore: boolean;
  nextCursor: string | null;
  totalCount: number | null;
  pageInfo?: PageInfo;
  items: HotItem[];
  providerStats?: ProviderStats;
  generatedAt?: string;
}

export function createInitialPaginationState(items: HotItem[] = []): OpportunityPaginationState {
  return {
    loadMoreLoading: false,
    loadMoreError: null,
    cursorExpired: false,
    invalidCursor: false,
    hasMore: false,
    nextCursor: null,
    totalCount: null,
    items,
  };
}

export function uniqueAppendItems(existing: HotItem[], incoming: HotItem[]): HotItem[] {
  const seen = new Set(existing.map((item) => item.id));
  const uniqueIncoming = incoming.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
  return [...existing, ...uniqueIncoming];
}

export function applyFirstPageSuccess(
  _current: OpportunityPaginationState,
  payload: {
    items: HotItem[];
    pageInfo?: PageInfo;
    providerStats?: ProviderStats;
    generatedAt?: string;
  },
): OpportunityPaginationState {
  return {
    loadMoreLoading: false,
    loadMoreError: null,
    cursorExpired: false,
    invalidCursor: false,
    hasMore: Boolean(payload.pageInfo?.hasMore),
    nextCursor: payload.pageInfo?.nextCursor ?? null,
    totalCount: payload.pageInfo?.totalCount ?? null,
    pageInfo: payload.pageInfo,
    items: payload.items,
    providerStats: payload.providerStats,
    generatedAt: payload.generatedAt,
  };
}

export function applyLoadMoreSuccess(
  current: OpportunityPaginationState,
  payload: {
    items: HotItem[];
    pageInfo?: PageInfo;
    providerStats?: ProviderStats;
    generatedAt?: string;
  },
): OpportunityPaginationState {
  const mergedItems = uniqueAppendItems(current.items, payload.items);
  return {
    ...current,
    loadMoreLoading: false,
    loadMoreError: null,
    cursorExpired: false,
    invalidCursor: false,
    hasMore: Boolean(payload.pageInfo?.hasMore),
    nextCursor: payload.pageInfo?.nextCursor ?? null,
    totalCount: payload.pageInfo?.totalCount ?? current.totalCount,
    pageInfo: payload.pageInfo ?? current.pageInfo,
    items: mergedItems,
    providerStats: payload.providerStats ?? current.providerStats,
    generatedAt: payload.generatedAt ?? current.generatedAt,
  };
}

export function classifyPaginationError(error: unknown): PaginationErrorState {
  if (error instanceof OpportunitiesApiError) {
    if (error.code === 'invalid_cursor') {
      return { kind: 'invalid_cursor', message: '分页状态异常，请刷新信号池' };
    }
    if (error.code === 'cursor_expired') {
      return { kind: 'cursor_expired', message: '当前信号快照已过期' };
    }
    return { kind: 'network', message: '更多信号加载失败，请重试' };
  }

  return { kind: 'network', message: '更多信号加载失败，请重试' };
}

export function applyLoadMoreError(current: OpportunityPaginationState, error: unknown): OpportunityPaginationState {
  const classified = classifyPaginationError(error);
  return {
    ...current,
    loadMoreLoading: false,
    loadMoreError: classified,
    cursorExpired: classified.kind === 'cursor_expired',
    invalidCursor: classified.kind === 'invalid_cursor',
    hasMore: classified.kind === 'network' ? current.hasMore : false,
    nextCursor: classified.kind === 'network' ? current.nextCursor : null,
  };
}

export function loadedCountCopy(state: Pick<OpportunityPaginationState, 'items' | 'totalCount' | 'hasMore'>, filteredCount?: number) {
  if (typeof state.totalCount !== 'number') return null;
  const base = state.hasMore
    ? `已加载 ${state.items.length} / 共 ${state.totalCount} 条信号`
    : `已加载全部 ${state.totalCount} 条信号`;
  if (typeof filteredCount === 'number' && filteredCount !== state.items.length) {
    return `${base} · 当前筛选匹配 ${filteredCount} 条`;
  }
  return base;
}
