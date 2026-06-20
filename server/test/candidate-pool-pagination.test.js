import test from 'node:test';
import assert from 'node:assert/strict';
import {
  app,
  buildCursorFirstPageResponse,
  buildCursorPage,
  buildRealOpportunitiesWithProviders,
  cleanupOpportunityPoolSnapshots,
  createOpportunityPoolSnapshot,
  decodeCursor,
  encodeCursor,
  getOpportunityPoolSnapshot,
  opportunityPoolSnapshots,
} from '../index.js';

function signalItem(source, index, overrides = {}) {
  const idPrefix = source.toLowerCase().replaceAll(' ', '-');
  const evidenceStrength = overrides.evidenceStrength || 'medium';
  return {
    id: `${idPrefix}-${index}`,
    title: `${source} signal ${index}`,
    source,
    sourceType: 'real',
    category: 'AI App',
    summary: `${source} summary ${index}`,
    targetMarket: 'Global',
    productType: 'AI tool',
    tags: [source],
    trendVelocity: 70,
    discussionVolume: 60,
    contentFit: 70,
    commercialValue: 65,
    competitionLevel: 45,
    paymentRisk: 40,
    localizationRisk: 30,
    competitionRisk: 45,
    evidence: overrides.evidence || [{
      title: `${source} evidence ${index}`,
      url: `https://example.com/${idPrefix}/${index}`,
      source,
      type: source === 'GitHub' ? 'developer_signal' : 'community_signal',
      retrievedAt: '2026-06-13T00:00:00.000Z',
      evidenceStrength,
      metadata: {
        points: overrides.points ?? 100,
        comments: overrides.comments ?? 25,
      },
    }],
  };
}

function items(source, count, options = {}) {
  return Array.from({ length: count }, (_, index) => signalItem(source, index + 1, options));
}

function withMeta(values, providerMeta = {}) {
  Object.defineProperty(values, 'providerMeta', {
    value: {
      requestedCount: providerMeta.requestedCount ?? values.length,
      rawCount: providerMeta.rawCount ?? values.length,
      mappedCount: providerMeta.mappedCount ?? values.length,
      validCount: providerMeta.validCount ?? values.length,
      droppedCount: providerMeta.droppedCount ?? 0,
      dropReasons: providerMeta.dropReasons ?? {},
      ...providerMeta,
    },
    enumerable: false,
  });
  return values;
}

function testProviders(overrides = {}) {
  const calls = {
    hackerNews: 0,
    appStore: 0,
    github: 0,
    productHunt: 0,
    gdelt: 0,
  };
  const loaders = {
    hackerNews: async () => { calls.hackerNews += 1; return withMeta(items('Hacker News', 40)); },
    appStore: async () => { calls.appStore += 1; return withMeta(items('Apple App Store', 40)); },
    github: async () => { calls.github += 1; return withMeta(items('GitHub', 30)); },
    productHunt: async () => {
      calls.productHunt += 1;
      return {
        ok: false,
        configured: false,
        errorClass: 'not_configured',
        skippedReason: 'PRODUCT_HUNT_TOKEN is not configured',
        items: [],
        providerMeta: {
          configured: false,
          requestedCount: 0,
          rawCount: 0,
          mappedCount: 0,
          validCount: 0,
          droppedCount: 0,
          dropReasons: {},
        },
      };
    },
    gdelt: async () => {
      calls.gdelt += 1;
      return {
        ok: false,
        errorClass: 'timeout',
        skippedReason: 'GDELT request timeout',
        items: [],
        providerMeta: {
          requestedCount: 30,
          rawCount: 0,
          mappedCount: 0,
          validCount: 0,
          droppedCount: 0,
          dropReasons: {},
          errorClass: 'timeout',
        },
      };
    },
    ...overrides,
  };

  return {
    calls,
    providers: [
      { key: 'hackerNews', source: 'Hacker News', load: loaders.hackerNews },
      { key: 'appStore', source: 'Apple App Store', load: loaders.appStore },
      { key: 'github', source: 'GitHub', load: loaders.github },
      { key: 'productHunt', source: 'Product Hunt', load: loaders.productHunt },
      { key: 'gdelt', source: 'GDELT', load: loaders.gdelt },
    ],
  };
}

function finalCountSum(providerStats) {
  return Object.values(providerStats).reduce((sum, stat) => sum + stat.finalCount, 0);
}

function candidatePoolCountSum(providerStats) {
  return Object.values(providerStats).reduce((sum, stat) => sum + (stat.candidatePoolCount || 0), 0);
}

test('legacy builder keeps hard limit 50 without cursor mode fields', async () => {
  const { providers } = testProviders();
  const result = await buildRealOpportunitiesWithProviders(providers);

  assert.equal(result.items.length, 50);
  assert.equal(result.poolStats.finalCount, 50);
  assert.equal(result.poolStats.mode, undefined);
});

test('limit=20 helper returns cursor_v1 first page with stable pageInfo', async () => {
  opportunityPoolSnapshots.clear();
  const { providers } = testProviders();
  const result = await buildCursorFirstPageResponse(providers, 20);
  const body = result.body;

  assert.equal(body.pageInfo.mode, 'cursor_v1');
  assert.equal(body.count, 20);
  assert.equal(body.items.length, 20);
  assert.equal(body.pageInfo.returnedCount, 20);
  assert.equal(body.pageInfo.totalCount, 110);
  assert.equal(body.poolStats.candidatePoolCount, body.pageInfo.totalCount);
  assert.ok(body.pageInfo.nextCursor);
});

test('second cursor page has no overlap and does not call providers again', async () => {
  opportunityPoolSnapshots.clear();
  const { providers, calls } = testProviders();
  const first = (await buildCursorFirstPageResponse(providers, 20)).body;
  const callSnapshot = { ...calls };
  const cursor = decodeCursor(first.pageInfo.nextCursor);
  const snapshot = getOpportunityPoolSnapshot(cursor.snapshotId);
  const second = buildCursorPage(snapshot, cursor.offset, cursor.pageSize);
  const firstIds = new Set(first.items.map((item) => item.id));
  const overlap = second.items.filter((item) => firstIds.has(item.id));

  assert.equal(second.count, 20);
  assert.equal(overlap.length, 0);
  assert.deepEqual(calls, callSnapshot);
});

test('loading all cursor pages preserves snapshot order and unique ids', async () => {
  opportunityPoolSnapshots.clear();
  const { providers } = testProviders();
  const first = (await buildCursorFirstPageResponse(providers, 30)).body;
  const allItems = [...first.items];
  let cursorValue = first.pageInfo.nextCursor;

  while (cursorValue) {
    const cursor = decodeCursor(cursorValue);
    const snapshot = getOpportunityPoolSnapshot(cursor.snapshotId);
    const page = buildCursorPage(snapshot, cursor.offset, cursor.pageSize);
    allItems.push(...page.items);
    cursorValue = page.pageInfo.nextCursor;
    if (!page.pageInfo.hasMore) {
      assert.equal(page.pageInfo.nextCursor, null);
    }
  }

  const snapshot = getOpportunityPoolSnapshot(first.pageInfo.snapshotId);
  assert.deepEqual(allItems.map((item) => item.id), snapshot.items.map((item) => item.id));
  assert.equal(new Set(allItems.map((item) => item.id)).size, allItems.length);
  assert.equal(allItems.length, first.pageInfo.totalCount);
});

test('invalid limit values return 400 before provider fetch', async () => {
  const server = app.listen(0);
  try {
    const { port } = server.address();
    for (const value of ['0', '31', '2.5']) {
      const response = await fetch(`http://127.0.0.1:${port}/api/opportunities?source=real&limit=${value}`);
      assert.equal(response.status, 400);
      const data = await response.json();
      assert.equal(data.error, 'invalid_limit');
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('invalid cursor returns 400 and non-existent snapshot returns 410', async () => {
  const server = app.listen(0);
  try {
    const { port } = server.address();
    const invalid = await fetch(`http://127.0.0.1:${port}/api/opportunities?source=real&cursor=not-a-cursor`);
    assert.equal(invalid.status, 400);
    assert.equal((await invalid.json()).error, 'invalid_cursor');

    const missingCursor = encodeCursor({ v: 1, snapshotId: 'missing-snapshot', offset: 0, pageSize: 20 });
    const missing = await fetch(`http://127.0.0.1:${port}/api/opportunities?source=real&cursor=${encodeURIComponent(missingCursor)}`);
    assert.equal(missing.status, 410);
    assert.equal((await missing.json()).error, 'cursor_expired');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('cursor with a simultaneous limit is rejected', async () => {
  const server = app.listen(0);
  try {
    const { port } = server.address();
    const cursor = encodeCursor({ v: 1, snapshotId: 'anything', offset: 0, pageSize: 20 });
    const response = await fetch(`http://127.0.0.1:${port}/api/opportunities?source=real&cursor=${encodeURIComponent(cursor)}&limit=30`);
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, 'invalid_cursor');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('expired snapshot cursor returns 410', async () => {
  opportunityPoolSnapshots.clear();
  const oldNow = Date.now() - 20 * 60 * 1000;
  const snapshot = createOpportunityPoolSnapshot({
    items: items('GitHub', 1),
    providerStats: {},
    poolStats: { finalCount: 1 },
  }, oldNow);
  const cursor = encodeCursor({ v: 1, snapshotId: snapshot.id, offset: 0, pageSize: 20 });
  const server = app.listen(0);
  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/opportunities?source=real&cursor=${encodeURIComponent(cursor)}`);
    assert.equal(response.status, 410);
    assert.equal((await response.json()).error, 'cursor_expired');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('snapshot cleanup keeps at most 20 newest snapshots', () => {
  opportunityPoolSnapshots.clear();
  const base = Date.now();
  const created = [];
  for (let index = 0; index < 21; index += 1) {
    created.push(createOpportunityPoolSnapshot({
      items: items('GitHub', 1),
      providerStats: {},
      poolStats: { finalCount: 1 },
    }, base + index));
  }
  cleanupOpportunityPoolSnapshots(base + 21);

  assert.equal(opportunityPoolSnapshots.size, 20);
  assert.equal(opportunityPoolSnapshots.has(created[0].id), false);
});

test('cursor payload does not contain item title url or body fields', async () => {
  opportunityPoolSnapshots.clear();
  const { providers } = testProviders();
  const first = (await buildCursorFirstPageResponse(providers, 20)).body;
  const decoded = Buffer.from(first.pageInfo.nextCursor, 'base64url').toString('utf8');

  assert.doesNotMatch(decoded, /signal|https:\/\/|summary|evidence/i);
});

test('low-signal Hacker News items are capped at 10 with low_signal_cap', async () => {
  const lowSignal = items('Hacker News', 15, { evidenceStrength: 'low', points: 1, comments: 0 });
  const strongSignal = items('Hacker News', 5, { evidenceStrength: 'medium', points: 100, comments: 30 })
    .map((item, index) => ({ ...item, id: `hn-strong-${index + 1}` }));
  const { providers } = testProviders({
    hackerNews: async () => withMeta([...lowSignal, ...strongSignal], {
      rawCount: 20,
      mappedCount: 20,
      validCount: 20,
    }),
    appStore: async () => withMeta([]),
    github: async () => withMeta([]),
  });
  const first = (await buildCursorFirstPageResponse(providers, 20)).body;
  const snapshot = getOpportunityPoolSnapshot(first.pageInfo.snapshotId);
  const lowCount = snapshot.items.filter(isLowSignalHnTestItem).length;

  assert.equal(lowCount, 10);
  assert.equal(first.providerStats.hackerNews.dropReasons.low_signal_cap, 5);
});

function isLowSignalHnTestItem(item) {
  const evidence = item.evidence.find((ev) => ev.source === 'Hacker News');
  return evidence?.evidenceStrength === 'low';
}

test('provider unavailable, Product Hunt not configured, and GDELT timeout do not block pagination', async () => {
  opportunityPoolSnapshots.clear();
  const { providers } = testProviders({
    hackerNews: async () => { throw new Error('HN fetch failed'); },
  });
  const body = (await buildCursorFirstPageResponse(providers, 20)).body;

  assert.equal(body.count, 20);
  assert.equal(body.providerStats.hackerNews.ok, false);
  assert.equal(body.providerStats.productHunt.errorClass, 'not_configured');
  assert.equal(body.providerStats.gdelt.errorClass, 'timeout');
});

test('knowledge base evidence does not increase totalCount', async () => {
  opportunityPoolSnapshots.clear();
  const item = signalItem('GitHub', 1, {
    evidence: [
      {
        title: 'GitHub evidence',
        url: 'https://example.com/github/1',
        source: 'GitHub',
        type: 'developer_signal',
        retrievedAt: '2026-06-13T00:00:00.000Z',
        evidenceStrength: 'medium',
      },
      {
        title: 'Market knowledge',
        url: null,
        source: 'HotPulse Market Knowledge',
        type: 'industry_report',
        retrievedAt: '2026-06-13T00:00:00.000Z',
        evidenceStrength: 'medium',
        metadata: { knowledgeType: 'static_market_entry' },
      },
    ],
  });
  const { providers } = testProviders({
    hackerNews: async () => withMeta([]),
    appStore: async () => withMeta([]),
    github: async () => withMeta([item]),
  });
  const body = (await buildCursorFirstPageResponse(providers, 20)).body;

  assert.equal(body.pageInfo.totalCount, 1);
  assert.equal(body.poolStats.candidatePoolCount, 1);
});

test('paged providerStats and poolStats satisfy count invariants and page slicing is not a drop reason', async () => {
  opportunityPoolSnapshots.clear();
  const { providers } = testProviders();
  const first = (await buildCursorFirstPageResponse(providers, 20)).body;

  assert.equal(finalCountSum(first.providerStats), first.count);
  assert.equal(candidatePoolCountSum(first.providerStats), first.pageInfo.totalCount);
  assert.equal(first.poolStats.candidatePoolCount, first.pageInfo.totalCount);
  assert.equal(first.poolStats.finalCount, first.count);
  for (const stat of Object.values(first.providerStats)) {
    assert.equal(Boolean(stat.dropReasons?.page_slicing), false);
  }
});

test('mock response does not create a real snapshot or cursor pageInfo', async () => {
  opportunityPoolSnapshots.clear();
  const server = app.listen(0);
  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/opportunities`);
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.source, 'mock');
    assert.equal(data.pageInfo, undefined);
    assert.equal(opportunityPoolSnapshots.size, 0);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('legacy real API returns stable unique item ids', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const href = String(url);
    if (href.startsWith('http://127.0.0.1')) return originalFetch(url);
    if (href.includes('hn.algolia.com')) {
      return new Response(JSON.stringify({
        hits: Array.from({ length: 20 }, (_, index) => ({
          objectID: `${encodeURIComponent(href).slice(0, 12)}-${index}`,
          title: `HN AI tool ${index}`,
          url: `https://example.com/hn/${encodeURIComponent(href)}/${index}`,
          points: 120,
          num_comments: 30,
          created_at: '2026-06-13T00:00:00.000Z',
        })),
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (href.includes('itunes.apple.com')) {
      return new Response(JSON.stringify({
        results: Array.from({ length: 25 }, (_, index) => ({
          trackId: Number(`${href.length}${index}`),
          trackName: `App Store AI ${href.length}-${index}`,
          description: 'AI productivity app',
          trackViewUrl: `https://apps.apple.com/app/${href.length}-${index}`,
          averageUserRating: 4.6,
          userRatingCount: 5000,
          currentVersionReleaseDate: '2026-06-13T00:00:00.000Z',
          releaseDate: '2026-01-01T00:00:00.000Z',
          primaryGenreName: 'Productivity',
          formattedPrice: 'Free',
        })),
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (href.includes('api.github.com')) {
      return new Response(JSON.stringify({
        items: Array.from({ length: 10 }, (_, index) => ({
          id: Number(`${href.length}${index}`),
          full_name: `owner/repo-${href.length}-${index}`,
          name: `repo-${index}`,
          description: 'AI developer tool',
          html_url: `https://github.com/owner/repo-${href.length}-${index}`,
          stargazers_count: 1000,
          forks_count: 100,
          open_issues_count: 10,
          updated_at: '2026-06-13T00:00:00.000Z',
          created_at: '2026-01-01T00:00:00.000Z',
          language: 'TypeScript',
        })),
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ articles: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const server = app.listen(0);
  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/opportunities?source=real`);
    const data = await response.json();
    const ids = data.items.map((item) => item.id);

    assert.equal(response.status, 200);
    assert.equal(data.count, ids.length);
    assert.equal(ids.length, 50);
    assert.equal(new Set(ids).size, ids.length);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    globalThis.fetch = originalFetch;
  }
});
