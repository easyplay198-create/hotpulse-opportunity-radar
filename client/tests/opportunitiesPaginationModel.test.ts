import test from 'node:test';
import assert from 'node:assert/strict';
import { OpportunitiesApiError, type PageInfo } from '../src/api/fetchOpportunities';
import {
  applyFirstPageSuccess,
  applyLoadMoreError,
  applyLoadMoreSuccess,
  classifyPaginationError,
  createInitialPaginationState,
  loadedCountCopy,
  uniqueAppendItems,
} from '../src/pages/OpportunitiesPage/paginationModel';
import type { HotItem } from '../src/types/hot';

function item(id: string): HotItem {
  return {
    id,
    platformId: 'GitHub',
    title: `Signal ${id}`,
    category: 'AI App',
    heat: 70,
    interaction: 60,
    valueScore: 75,
    verdict: 'watch',
    summary: `Summary ${id}`,
    tags: ['AI'],
    dataTier: 'real',
  };
}

function pageInfo(overrides: Partial<PageInfo> = {}): PageInfo {
  return {
    mode: 'cursor_v1',
    pageSize: 20,
    returnedCount: 20,
    totalCount: 81,
    offset: 0,
    hasMore: true,
    nextCursor: 'cursor-2',
    snapshotId: 'snapshot-1',
    generatedAt: '2026-06-20T00:00:00.000Z',
    expiresAt: '2026-06-20T00:10:00.000Z',
    ...overrides,
  };
}

test('first real page stores pageInfo and first page items', () => {
  const state = applyFirstPageSuccess(createInitialPaginationState(), {
    items: [item('a'), item('b')],
    pageInfo: pageInfo({ returnedCount: 2, nextCursor: 'cursor-2' }),
    generatedAt: '2026-06-20T00:00:00.000Z',
  });

  assert.equal(state.items.length, 2);
  assert.equal(state.hasMore, true);
  assert.equal(state.nextCursor, 'cursor-2');
  assert.equal(state.totalCount, 81);
});

test('load-more appends instead of replacing and removes duplicate ids safely', () => {
  const state = applyFirstPageSuccess(createInitialPaginationState(), {
    items: [item('a'), item('b')],
    pageInfo: pageInfo({ returnedCount: 2, nextCursor: 'cursor-2' }),
  });
  const next = applyLoadMoreSuccess(state, {
    items: [item('b'), item('c'), item('d')],
    pageInfo: pageInfo({ offset: 2, returnedCount: 3, nextCursor: 'cursor-3' }),
  });

  assert.deepEqual(next.items.map((candidate) => candidate.id), ['a', 'b', 'c', 'd']);
  assert.equal(next.nextCursor, 'cursor-3');
});

test('uniqueAppendItems preserves existing order and incoming order', () => {
  const merged = uniqueAppendItems([item('a'), item('b')], [item('b'), item('c'), item('a'), item('d')]);

  assert.deepEqual(merged.map((candidate) => candidate.id), ['a', 'b', 'c', 'd']);
});

test('network load-more error keeps old items and cursor for retry', () => {
  const state = applyFirstPageSuccess(createInitialPaginationState(), {
    items: [item('a')],
    pageInfo: pageInfo({ returnedCount: 1, nextCursor: 'retry-cursor' }),
  });
  const failed = applyLoadMoreError(state, new Error('network down'));

  assert.deepEqual(failed.items.map((candidate) => candidate.id), ['a']);
  assert.equal(failed.nextCursor, 'retry-cursor');
  assert.equal(failed.hasMore, true);
  assert.equal(failed.loadMoreError?.kind, 'network');
});

test('invalid_cursor keeps old list but stops using the bad cursor', () => {
  const state = applyFirstPageSuccess(createInitialPaginationState(), {
    items: [item('a')],
    pageInfo: pageInfo({ returnedCount: 1, nextCursor: 'bad-cursor' }),
  });
  const failed = applyLoadMoreError(state, new OpportunitiesApiError('invalid', 400, 'invalid_cursor'));

  assert.deepEqual(failed.items.map((candidate) => candidate.id), ['a']);
  assert.equal(failed.invalidCursor, true);
  assert.equal(failed.nextCursor, null);
  assert.equal(failed.hasMore, false);
});

test('cursor_expired keeps old list and requires explicit refresh', () => {
  const state = applyFirstPageSuccess(createInitialPaginationState(), {
    items: [item('a')],
    pageInfo: pageInfo({ returnedCount: 1, nextCursor: 'expired-cursor' }),
  });
  const failed = applyLoadMoreError(state, new OpportunitiesApiError('expired', 410, 'cursor_expired'));

  assert.deepEqual(failed.items.map((candidate) => candidate.id), ['a']);
  assert.equal(failed.cursorExpired, true);
  assert.equal(failed.nextCursor, null);
  assert.equal(failed.hasMore, false);
});

test('classifyPaginationError preserves backend cursor error codes', () => {
  assert.equal(classifyPaginationError(new OpportunitiesApiError('bad', 400, 'invalid_cursor')).kind, 'invalid_cursor');
  assert.equal(classifyPaginationError(new OpportunitiesApiError('gone', 410, 'cursor_expired')).kind, 'cursor_expired');
  assert.equal(classifyPaginationError(new OpportunitiesApiError('oops', 500, 'provider_error')).kind, 'network');
});

test('loaded count copy distinguishes loaded items, totalCount, and filtered matches', () => {
  const state = applyFirstPageSuccess(createInitialPaginationState(), {
    items: [item('a'), item('b')],
    pageInfo: pageInfo({ returnedCount: 2, totalCount: 81, hasMore: true }),
  });

  assert.equal(loadedCountCopy(state), '已加载 2 / 共 81 条信号');
  assert.equal(loadedCountCopy(state, 1), '已加载 2 / 共 81 条信号 · 当前筛选匹配 1 条');
});

test('final page copy reports all loaded', () => {
  const state = applyFirstPageSuccess(createInitialPaginationState(), {
    items: [item('a'), item('b')],
    pageInfo: pageInfo({ returnedCount: 2, totalCount: 2, hasMore: false, nextCursor: null }),
  });

  assert.equal(loadedCountCopy(state), '已加载全部 2 条信号');
});
