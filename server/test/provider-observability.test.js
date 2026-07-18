import test from 'node:test';
import assert from 'node:assert/strict';
import { app, buildRealOpportunitiesWithProviders } from '../index.js';

function providerFixtureItem({
  id,
  source,
  title = `${source} validation signal`,
  evidence = [],
}) {
  return {
    id,
    title,
    source,
    sourceType: 'real',
    category: 'AI App',
    summary: `${source} summary`,
    targetMarket: 'Japan',
    productType: 'AI tool',
    tags: ['AI', 'Japan'],
    trendVelocity: 72,
    discussionVolume: 68,
    contentFit: 74,
    commercialValue: 70,
    competitionLevel: 45,
    paymentRisk: 35,
    localizationRisk: 30,
    competitionRisk: 45,
    evidence: evidence.length > 0 ? evidence : [
      {
        title: `${source} evidence`,
        url: `https://example.com/${id}`,
        source,
        type: source === 'GitHub' ? 'developer_signal' : 'community_signal',
        retrievedAt: '2026-06-13T00:00:00.000Z',
        evidenceStrength: 'medium',
        metadata: { provider: source },
      },
    ],
  };
}

function itemsFor(source, count, prefix = source.toLowerCase().replaceAll(' ', '-')) {
  return Array.from({ length: count }, (_, index) => providerFixtureItem({
    id: `${prefix}-${index + 1}`,
    source,
  }));
}

function withMeta(items, providerMeta) {
  Object.defineProperty(items, 'providerMeta', {
    value: providerMeta,
    enumerable: false,
  });
  return items;
}

function sumDropReasons(stat) {
  return Object.values(stat.dropReasons || {}).reduce((sum, count) => sum + count, 0);
}

function assertDropAccounting(result) {
  for (const stat of Object.values(result.providerStats)) {
    assert.equal(stat.droppedCount, sumDropReasons(stat));
  }
}

function providers(overrides = {}) {
  const loaders = {
    hackerNews: async () => withMeta(itemsFor('Hacker News', 0), { requestedCount: 0, rawCount: 0, mappedCount: 0, validCount: 0 }),
    appStore: async () => withMeta(itemsFor('Apple App Store', 0), { requestedCount: 0, rawCount: 0, mappedCount: 0, validCount: 0 }),
    github: async () => withMeta(itemsFor('GitHub', 0), { requestedCount: 0, rawCount: 0, mappedCount: 0, validCount: 0 }),
    productHunt: async () => ({
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
    }),
    gdelt: async () => ({
      ok: false,
      errorClass: 'no_usable_items',
      skippedReason: 'GDELT returned no usable articles',
      items: [],
      providerMeta: {
        requestedCount: 30,
        rawCount: 10,
        mappedCount: 0,
        validCount: 0,
        droppedCount: 10,
        dropReasons: { no_usable_items: 10 },
      },
    }),
    ...overrides,
  };

  return [
    { key: 'hackerNews', source: 'Hacker News', load: loaders.hackerNews },
    { key: 'appStore', source: 'Apple App Store', load: loaders.appStore },
    { key: 'github', source: 'GitHub', load: loaders.github },
    { key: 'productHunt', source: 'Product Hunt', load: loaders.productHunt },
    { key: 'gdelt', source: 'GDELT', load: loaders.gdelt },
  ];
}

test('Product Hunt missing token is reported as not_configured without a request', async () => {
  const result = await buildRealOpportunitiesWithProviders(providers());
  const stat = result.providerStats.productHunt;

  assert.equal(stat.ok, false);
  assert.equal(stat.configured, false);
  assert.equal(stat.errorClass, 'not_configured');
  assert.equal(stat.requestedCount, 0);
  assert.equal(stat.rawCount, 0);
  assert.equal(stat.mappedCount, 0);
  assert.equal(stat.validCount, 0);
  assert.equal(stat.finalCount, 0);
  assert.doesNotMatch(JSON.stringify(stat), /bearer|secret|sk-[a-z0-9]/i);
  assertDropAccounting(result);
});

test('GDELT 429 is classified as rate_limited with httpStatus', async () => {
  const result = await buildRealOpportunitiesWithProviders(providers({
    gdelt: async () => ({
      ok: false,
      errorClass: 'rate_limited',
      rateLimited: true,
      httpStatus: 429,
      skippedReason: 'GDELT rate limited',
      items: [],
      providerMeta: {
        requestedCount: 30,
        rawCount: 0,
        mappedCount: 0,
        validCount: 0,
        httpStatus: 429,
        errorClass: 'rate_limited',
        rateLimited: true,
        droppedCount: 0,
        dropReasons: {},
      },
    }),
  }));

  assert.equal(result.providerStats.gdelt.ok, false);
  assert.equal(result.providerStats.gdelt.errorClass, 'rate_limited');
  assert.equal(result.providerStats.gdelt.rateLimited, true);
  assert.equal(result.providerStats.gdelt.httpStatus, 429);
  assert.equal(result.providerStats.gdelt.requestedCount, 30);
  assert.equal(result.providerStats.gdelt.rawCount, 0);
  assert.equal(result.providerStats.gdelt.droppedCount, 0);
  assert.deepEqual(result.providerStats.gdelt.dropReasons, {});
  assertDropAccounting(result);
});

test('GDELT no usable items is distinct from transport failure', async () => {
  const result = await buildRealOpportunitiesWithProviders(providers());
  const stat = result.providerStats.gdelt;

  assert.equal(stat.ok, false);
  assert.equal(stat.errorClass, 'no_usable_items');
  assert.equal(stat.rawCount, 10);
  assert.equal(stat.validCount, 0);
  assert.equal(stat.dropReasons.no_usable_items, 10);
  assertDropAccounting(result);
});

test('HN raw 60 mapped 60 valid 60 selected 20 keeps pre-quota counts', async () => {
  const result = await buildRealOpportunitiesWithProviders(providers({
    hackerNews: async () => withMeta(itemsFor('Hacker News', 20), {
      requestedCount: 60,
      rawCount: 60,
      mappedCount: 60,
      validCount: 60,
      selectedCount: 20,
      droppedCount: 40,
      dropReasons: { provider_quota: 40 },
    }),
  }));

  const stat = result.providerStats.hackerNews;
  assert.equal(stat.rawCount, 60);
  assert.equal(stat.mappedCount, 60);
  assert.equal(stat.validCount, 60);
  assert.equal(stat.selectedCount, 20);
  assert.equal(stat.finalCount, 20);
  assert.equal(stat.dropReasons.provider_quota, 40);
  assertDropAccounting(result);
});

test('App Store raw duplicates valid and selected counts are stage accurate', async () => {
  const result = await buildRealOpportunitiesWithProviders(providers({
    appStore: async () => withMeta(itemsFor('Apple App Store', 20), {
      requestedCount: 75,
      rawCount: 68,
      deduplicatedCount: 66,
      mappedCount: 66,
      validCount: 66,
      selectedCount: 20,
      droppedCount: 48,
      dropReasons: { duplicate: 2, provider_quota: 46 },
    }),
  }));

  const stat = result.providerStats.appStore;
  assert.equal(stat.rawCount, 68);
  assert.equal(stat.deduplicatedCount, 66);
  assert.equal(stat.mappedCount, 66);
  assert.equal(stat.validCount, 66);
  assert.equal(stat.selectedCount, 20);
  assert.equal(stat.finalCount, 20);
  assert.equal(stat.dropReasons.duplicate, 2);
  assert.equal(stat.dropReasons.provider_quota, 46);
  assertDropAccounting(result);
});

test('GitHub raw 30 valid 30 selected 15 final 10 exposes provider and global truncation', async () => {
  const result = await buildRealOpportunitiesWithProviders(providers({
    hackerNews: async () => withMeta(itemsFor('Hacker News', 20), {
      requestedCount: 60,
      rawCount: 60,
      mappedCount: 60,
      validCount: 60,
      droppedCount: 40,
      dropReasons: { provider_quota: 40 },
    }),
    appStore: async () => withMeta(itemsFor('Apple App Store', 20), {
      requestedCount: 75,
      rawCount: 68,
      deduplicatedCount: 66,
      mappedCount: 66,
      validCount: 66,
      droppedCount: 48,
      dropReasons: { duplicate: 2, provider_quota: 46 },
    }),
    github: async () => withMeta(itemsFor('GitHub', 15), {
      requestedCount: 30,
      rawCount: 30,
      mappedCount: 30,
      validCount: 30,
      droppedCount: 15,
      dropReasons: { provider_quota: 15 },
    }),
    gdelt: async () => ({
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
    }),
  }));

  const stat = result.providerStats.github;
  assert.equal(result.poolStats.hardLimit, 50);
  assert.equal(stat.rawCount, 30);
  assert.equal(stat.mappedCount, 30);
  assert.equal(stat.validCount, 30);
  assert.equal(stat.selectedCount, 15);
  assert.equal(stat.finalCount, 10);
  assert.equal(stat.dropReasons.provider_quota, 15);
  assert.equal(stat.dropReasons.global_limit, 5);
  assert.equal(result.items.length, 50);
  assert.equal(result.poolStats.rawCount, 158);
  assert.equal(result.poolStats.mappedCount, 156);
  assert.equal(result.poolStats.validCount, 156);
  assert.equal(result.poolStats.deduplicatedCount, 55);
  assert.equal(result.poolStats.finalCount, result.items.length);
  assert.equal(Object.values(result.providerStats).reduce((sum, providerStat) => sum + providerStat.finalCount, 0), result.items.length);
  assertDropAccounting(result);
});

test('provider quota and global limit truncation reasons are counted', async () => {
  const result = await buildRealOpportunitiesWithProviders(providers({
    hackerNews: async () => withMeta(itemsFor('Hacker News', 30), {
      requestedCount: 60,
      rawCount: 45,
      mappedCount: 30,
      validCount: 30,
      droppedCount: 15,
      dropReasons: { provider_quota: 15 },
    }),
    appStore: async () => withMeta(itemsFor('Apple App Store', 30), {
      requestedCount: 75,
      rawCount: 40,
      mappedCount: 30,
      validCount: 30,
    }),
  }));

  assert.equal(result.providerStats.hackerNews.dropReasons.provider_quota, 15);
  assert.ok(result.providerStats.appStore.dropReasons.global_limit > 0);
  assert.equal(result.poolStats.finalCount, 50);
  assertDropAccounting(result);
});

test('duplicate drop reasons are preserved from provider metadata', async () => {
  const result = await buildRealOpportunitiesWithProviders(providers({
    hackerNews: async () => withMeta(itemsFor('Hacker News', 2), {
      requestedCount: 60,
      rawCount: 5,
      mappedCount: 2,
      validCount: 2,
      droppedCount: 3,
      dropReasons: { duplicate: 3 },
    }),
  }));

  assert.equal(result.providerStats.hackerNews.dropReasons.duplicate, 3);
  assert.equal(result.providerStats.hackerNews.droppedCount, 3);
  assertDropAccounting(result);
});

test('HotPulse Market Knowledge evidence does not create provider candidate counts', async () => {
  const item = providerFixtureItem({
    id: 'hn-knowledge-1',
    source: 'Hacker News',
    evidence: [
      {
        title: 'HN evidence',
        url: 'https://example.com/hn-knowledge-1',
        source: 'Hacker News',
        type: 'community_signal',
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

  const result = await buildRealOpportunitiesWithProviders(providers({
    hackerNews: async () => withMeta([item], {
      requestedCount: 1,
      rawCount: 1,
      mappedCount: 1,
      validCount: 1,
    }),
    gdelt: async () => ({
      ok: false,
      errorClass: 'no_results',
      skippedReason: 'GDELT returned no articles',
      items: [],
      providerMeta: {
        requestedCount: 30,
        rawCount: 0,
        mappedCount: 0,
        validCount: 0,
        droppedCount: 0,
        dropReasons: {},
      },
    }),
  }));

  assert.equal(result.poolStats.rawCount, 1);
  assert.equal(result.providerStats.hackerNews.finalCount, 1);
  assert.equal(result.providerStats.hackerNews.finalCount, result.items.filter((candidate) => candidate.source === 'Hacker News').length);
  assertDropAccounting(result);
});

test('PRAXON Market Knowledge evidence remains an internal knowledge source', async () => {
  const item = providerFixtureItem({
    id: 'hn-praxon-knowledge-1',
    source: 'Hacker News',
    evidence: [
      {
        title: 'HN evidence',
        url: 'https://example.com/hn-praxon-knowledge-1',
        source: 'Hacker News',
        type: 'community_signal',
        retrievedAt: '2026-06-13T00:00:00.000Z',
        evidenceStrength: 'medium',
      },
      {
        title: 'Market knowledge',
        url: null,
        source: 'PRAXON Market Knowledge',
        type: 'industry_report',
        retrievedAt: '2026-06-13T00:00:00.000Z',
        evidenceStrength: 'medium',
      },
    ],
  });

  const result = await buildRealOpportunitiesWithProviders(providers({
    hackerNews: async () => withMeta([item], {
      requestedCount: 1,
      rawCount: 1,
      mappedCount: 1,
      validCount: 1,
    }),
    gdelt: async () => ({
      ok: false,
      errorClass: 'no_results',
      skippedReason: 'GDELT returned no articles',
      items: [],
      providerMeta: {
        requestedCount: 30,
        rawCount: 0,
        mappedCount: 0,
        validCount: 0,
        droppedCount: 0,
        dropReasons: {},
      },
    }),
  }));

  assert.equal(result.poolStats.rawCount, 1);
  assert.equal(result.providerStats.hackerNews.finalCount, 1);
  assert.equal(result.items[0]?.evidence.some((evidence) => evidence.source === 'PRAXON Market Knowledge'), true);
  assertDropAccounting(result);
});

test('poolStats sums provider raw mapped valid counts and final counts are attributable', async () => {
  const result = await buildRealOpportunitiesWithProviders(providers({
    hackerNews: async () => withMeta(itemsFor('Hacker News', 3), { rawCount: 3, mappedCount: 3, validCount: 3 }),
    appStore: async () => withMeta(itemsFor('Apple App Store', 2), { rawCount: 2, mappedCount: 2, validCount: 2 }),
    github: async () => withMeta(itemsFor('GitHub', 1), { rawCount: 1, mappedCount: 1, validCount: 1 }),
  }));

  const finalCountSum = Object.values(result.providerStats).reduce((sum, stat) => sum + stat.finalCount, 0);
  assert.equal(result.poolStats.rawCount, Object.values(result.providerStats).reduce((sum, stat) => sum + stat.rawCount, 0));
  assert.equal(result.poolStats.mappedCount, Object.values(result.providerStats).reduce((sum, stat) => sum + stat.mappedCount, 0));
  assert.equal(result.poolStats.validCount, Object.values(result.providerStats).reduce((sum, stat) => sum + stat.validCount, 0));
  assert.equal(finalCountSum, result.items.length);
  assert.equal(result.poolStats.finalCount, result.items.length);
  for (const stat of Object.values(result.providerStats)) {
    assert.ok(stat.latencyMs >= 0);
  }
  assertDropAccounting(result);
});

test('GDELT timeout does not synthesize record-level drops', async () => {
  const result = await buildRealOpportunitiesWithProviders(providers({
    gdelt: async () => ({
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
    }),
  }));

  const stat = result.providerStats.gdelt;
  assert.equal(stat.errorClass, 'timeout');
  assert.equal(stat.requestedCount, 30);
  assert.equal(stat.droppedCount, 0);
  assert.deepEqual(stat.dropReasons, {});
  assert.equal(stat.dropReasons.no_results, undefined);
  assertDropAccounting(result);
});

test('network_error does not generate synthetic dropReasons', async () => {
  const result = await buildRealOpportunitiesWithProviders(providers({
    gdelt: async () => ({
      ok: false,
      errorClass: 'network_error',
      skippedReason: 'GDELT network error',
      items: [],
      providerMeta: {
        requestedCount: 30,
        rawCount: 0,
        mappedCount: 0,
        validCount: 0,
        droppedCount: 0,
        dropReasons: {},
        errorClass: 'network_error',
      },
    }),
  }));

  const stat = result.providerStats.gdelt;
  assert.equal(stat.errorClass, 'network_error');
  assert.equal(stat.rawCount, 0);
  assert.equal(stat.droppedCount, 0);
  assert.deepEqual(stat.dropReasons, {});
  assertDropAccounting(result);
});

test('mock opportunity response keeps original fields and has no real poolStats', async () => {
  const server = app.listen(0);
  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/opportunities`);
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.source, 'mock');
    assert.equal(typeof data.count, 'number');
    assert.ok(Array.isArray(data.items));
    assert.equal(data.providerStats, undefined);
    assert.equal(data.poolStats, undefined);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
