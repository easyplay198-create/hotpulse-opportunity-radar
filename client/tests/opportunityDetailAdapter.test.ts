import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildHotspotListFromItems, getHotspotList } from '../src/api/getHotspotList.js';
import type { EvidenceItem, HotItem } from '../src/types/hot.js';
import type { HotspotItem } from '../src/types/hotspot.js';
import { resolveOpportunityDataTier } from '../src/types/opportunityDetail.js';
import { resolveResponseDataTierOrThrow } from '../src/api/getHotspotListFromApi.js';
import { normalizeCachedOpportunitiesEntry } from '../src/lib/opportunitiesCache.js';
import {
  buildOpportunityDetailViewModel,
  computeEvidenceStrength,
  mapEvidenceProvenance,
  mapEvidenceSourceCategory,
  normalizeEvidence,
} from '../src/viewModels/opportunityDetailAdapter.js';

function sampleHotspot(overrides: Partial<HotspotItem> = {}): HotspotItem {
  return {
    id: 'hs-test-1',
    title: 'Test Opportunity',
    source: 'Hacker News',
    sourceType: 'community',
    category: 'AI',
    publishTime: '2026-06-18T00:00:00.000Z',
    trendVelocity: 70,
    discussionVolume: 65,
    contentFit: 60,
    commercialValue: 55,
    competitionLevel: 45,
    riskLevel: 2,
    tags: ['test'],
    summary: 'test summary',
    score: 66,
    verdict: 'watch',
    reasonPositive: ['a'],
    reasonNegative: ['b'],
    ...overrides,
  };
}

function sampleEvidence(overrides: Partial<EvidenceItem> = {}): EvidenceItem {
  return {
    title: 'Evidence',
    source: 'Hacker News',
    type: 'community_signal',
    evidenceStrength: 'medium',
    retrievedAt: '2026-06-18T01:00:00.000Z',
    url: 'https://news.ycombinator.com/item?id=1',
    metadata: { points: 100 },
    ...overrides,
  };
}

function sampleHotItem(overrides: Partial<HotItem> = {}): HotItem {
  return {
    id: 'h1',
    platformId: 'Hacker News',
    title: 'Sample',
    category: 'AI',
    heat: 70,
    interaction: 60,
    valueScore: 68,
    verdict: 'watch',
    summary: 'summary',
    tags: ['tag'],
    publishedAt: '2026-06-18T00:00:00.000Z',
    dataTier: 'real',
    ...overrides,
  };
}

describe('Data Tier mapping', () => {
  it('response source real -> real', () => {
    assert.equal(resolveOpportunityDataTier('real'), 'real');
  });

  it('response source mock -> mock', () => {
    assert.equal(resolveOpportunityDataTier('mock'), 'mock');
  });

  it('response source fallback -> fallback', () => {
    assert.equal(resolveOpportunityDataTier('fallback'), 'fallback');
  });

  it('hacker-news provider mode -> real', () => {
    assert.equal(resolveOpportunityDataTier('hacker-news'), 'real');
  });

  it('unknown source is conservative and never real', () => {
    assert.notEqual(resolveOpportunityDataTier('mystery-mode'), 'real');
    assert.equal(resolveOpportunityDataTier('mystery-mode'), null);
  });

  it('empty source returns null', () => {
    assert.equal(resolveOpportunityDataTier(''), null);
    assert.equal(resolveOpportunityDataTier('   '), null);
  });

  it('non-string source values are safely treated as null', () => {
    assert.equal(resolveOpportunityDataTier(null), null);
    assert.equal(resolveOpportunityDataTier(undefined), null);
    assert.equal(resolveOpportunityDataTier(123), null);
    assert.equal(resolveOpportunityDataTier({ source: 'real' }), null);
    assert.equal(resolveOpportunityDataTier(['real']), null);
  });

  it('unknown source never maps to mock tier', () => {
    assert.notEqual(resolveOpportunityDataTier('unknown-provider'), 'mock');
    assert.equal(resolveOpportunityDataTier('unknown-provider'), null);
  });

  it('client local seed path getHotspotList uses fallback tier', async () => {
    const list = await getHotspotList();
    assert.equal(list.items.length > 0, true);
    assert.equal(list.items.every((item) => item.dataTier === 'fallback'), true);
  });

  it('unknown API response source is rejected', () => {
    assert.throws(() => resolveResponseDataTierOrThrow('unknown-provider'), /Unsupported opportunities source/);
  });

  it('unknown API source rejection can lead to existing fallback chain', async () => {
    const sentinelId = 'unknown-source-sentinel';
    assert.throws(() => resolveResponseDataTierOrThrow('mystery-source'), /Unsupported opportunities source/);
    const fallbackList = await getHotspotList();
    assert.equal(fallbackList.items.every((item) => item.dataTier === 'fallback'), true);
    assert.equal(fallbackList.items.some((item) => item.id === sentinelId), false);
  });

  it('request params and response mismatch use response tier as authority', () => {
    // Simulate "requested real, response fallback": only response tier should be used downstream.
    assert.equal(resolveResponseDataTierOrThrow('fallback'), 'fallback');
  });
});

describe('Cache compatibility and authority', () => {
  it('cache source is authority and injects missing item dataTier', () => {
    const legacyItem = {
      id: 'legacy-no-tier',
      platformId: 'Hacker News',
      title: 'Legacy',
      category: 'AI',
      heat: 60,
      interaction: 55,
      valueScore: 58,
      verdict: 'watch',
      summary: 'legacy',
      tags: [],
      publishedAt: '2026-06-18T00:00:00.000Z',
    } as unknown as HotItem;

    const normalized = normalizeCachedOpportunitiesEntry({
      source: 'real',
      opportunities: [legacyItem],
      retrievedAt: '2026-06-18T00:00:00.000Z',
    }, 'real');

    assert.notEqual(normalized, null);
    assert.equal(normalized?.source, 'real');
    assert.equal(normalized?.opportunities[0]?.dataTier, 'real');
  });

  it('cache source overrides conflicting item dataTier', () => {
    const conflicting = sampleHotItem({ dataTier: 'fallback' });
    const normalized = normalizeCachedOpportunitiesEntry({
      source: 'mock',
      opportunities: [conflicting],
      retrievedAt: '2026-06-18T00:00:00.000Z',
    }, 'mock');

    assert.notEqual(normalized, null);
    assert.equal(normalized?.opportunities[0]?.dataTier, 'mock');
  });

  it('unknown cache source is rejected and never downgraded to mock', () => {
    const normalized = normalizeCachedOpportunitiesEntry({
      source: 'unknown-provider',
      opportunities: [sampleHotItem()],
      retrievedAt: '2026-06-18T00:00:00.000Z',
    }, 'real');

    assert.equal(normalized, null);
  });

  it('cache source mismatch is rejected', () => {
    const normalized = normalizeCachedOpportunitiesEntry({
      source: 'fallback',
      opportunities: [sampleHotItem({ dataTier: 'real' })],
      retrievedAt: '2026-06-18T00:00:00.000Z',
    }, 'real');

    assert.equal(normalized, null);
  });
});

describe('Evidence normalization', () => {
  it('App Store evidence -> observed + app_store', () => {
    const evidence = sampleEvidence({ source: 'Apple App Store', type: 'app_store_signal' });
    assert.equal(mapEvidenceSourceCategory(evidence.source), 'app_store');
    assert.equal(mapEvidenceProvenance(evidence), 'observed');
  });

  it('Hacker News evidence -> observed + community', () => {
    const evidence = sampleEvidence({ source: 'Hacker News' });
    assert.equal(mapEvidenceSourceCategory(evidence.source), 'community');
    assert.equal(mapEvidenceProvenance(evidence), 'observed');
  });

  it('GitHub evidence -> observed + developer', () => {
    const evidence = sampleEvidence({ source: 'GitHub', type: 'developer_signal' });
    assert.equal(mapEvidenceSourceCategory(evidence.source), 'developer');
    assert.equal(mapEvidenceProvenance(evidence), 'observed');
  });

  it('HotPulse Market Knowledge -> knowledge_base', () => {
    const evidence = sampleEvidence({
      source: 'HotPulse Market Knowledge',
      type: 'industry_report',
      url: null,
      metadata: { knowledgeType: 'static_market_entry' },
    });
    const normalized = normalizeEvidence(evidence);
    assert.equal(normalized.sourceType, 'knowledge_base');
    assert.equal(normalized.provenance, 'knowledge_base');
    assert.equal(normalized.sourceName, 'PRAXON Market Knowledge');
  });

  it('PRAXON Market Knowledge -> knowledge_base', () => {
    const evidence = sampleEvidence({
      source: 'PRAXON Market Knowledge',
      type: 'industry_report',
      url: null,
    });
    const normalized = normalizeEvidence(evidence);
    assert.equal(normalized.sourceType, 'knowledge_base');
    assert.equal(normalized.provenance, 'knowledge_base');
    assert.equal(normalized.sourceName, 'PRAXON Market Knowledge');
  });

  it('unknown source -> unknown', () => {
    const evidence = sampleEvidence({ source: 'Random Feed' });
    const normalized = normalizeEvidence(evidence);
    assert.equal(normalized.sourceType, 'unknown');
    assert.equal(normalized.provenance, 'unknown');
  });

  it('empty/null/invalid URL are removed', () => {
    assert.equal(normalizeEvidence(sampleEvidence({ url: '' })).sourceUrl, undefined);
    assert.equal(normalizeEvidence(sampleEvidence({ url: null })).sourceUrl, undefined);
    assert.equal(normalizeEvidence(sampleEvidence({ url: 'ftp://x.com/a' })).sourceUrl, undefined);
  });

  it('retrievedAt is not copied to publishedAt', () => {
    const normalized = normalizeEvidence(sampleEvidence({ retrievedAt: '2026-06-18T02:00:00.000Z' }));
    assert.equal(normalized.retrievedAt, '2026-06-18T02:00:00.000Z');
    assert.equal(normalized.publishedAt, undefined);
  });

  it('metadata is preserved', () => {
    const normalized = normalizeEvidence(sampleEvidence({ metadata: { a: 1, b: 'x' } }));
    assert.deepEqual(normalized.metadata, { a: 1, b: 'x' });
  });

  it('evidenceStrength maps to normalized strength', () => {
    assert.equal(normalizeEvidence(sampleEvidence({ evidenceStrength: 'high' })).strength, 'high');
    assert.equal(normalizeEvidence(sampleEvidence({ evidenceStrength: 'medium' })).strength, 'medium');
    assert.equal(normalizeEvidence(sampleEvidence({ evidenceStrength: 'low' })).strength, 'low');
  });
});

describe('Opportunity detail ViewModel', () => {
  it('no evidence -> insufficient', () => {
    const vm = buildOpportunityDetailViewModel(sampleHotItem({ evidence: [] }));
    assert.equal(vm.signal.evidenceStrength, 'insufficient');
  });

  it('high evidence outranks medium/low', () => {
    const strengths = computeEvidenceStrength([
      normalizeEvidence(sampleEvidence({ evidenceStrength: 'low' })),
      normalizeEvidence(sampleEvidence({ evidenceStrength: 'high' })),
      normalizeEvidence(sampleEvidence({ evidenceStrength: 'medium' })),
    ]);
    assert.equal(strengths, 'high');
  });

  it('sourceCount deduplicates source names', () => {
    const vm = buildOpportunityDetailViewModel(sampleHotItem({
      evidence: [
        sampleEvidence({ source: 'GitHub' }),
        sampleEvidence({ source: 'GitHub' }),
        sampleEvidence({ source: 'Hacker News' }),
      ],
    }));
    assert.equal(vm.dataNotes.sourceCount, 2);
  });

  it('latestRetrievedAt picks newest valid timestamp', () => {
    const vm = buildOpportunityDetailViewModel(sampleHotItem({
      evidence: [
        sampleEvidence({ retrievedAt: '2026-06-18T00:00:00.000Z' }),
        sampleEvidence({ retrievedAt: '2026-06-18T03:00:00.000Z' }),
      ],
    }));
    assert.equal(vm.identity.latestRetrievedAt, '2026-06-18T03:00:00.000Z');
  });

  it('invalid timestamps are ignored', () => {
    const vm = buildOpportunityDetailViewModel(sampleHotItem({
      evidence: [sampleEvidence({ retrievedAt: 'invalid-time' })],
    }));
    assert.equal(vm.identity.latestRetrievedAt, undefined);
  });

  it('missing risk values remain unknown, not 0', () => {
    const vm = buildOpportunityDetailViewModel(sampleHotItem({
      paymentRisk: undefined,
      localizationRisk: undefined,
      competitionRisk: undefined,
      complianceRisk: undefined,
      acquisitionRisk: undefined,
      aiCostRisk: undefined,
    }));
    const payment = vm.risks.find((risk) => risk.category === 'payment');
    assert.equal(payment?.level, 'unknown');
    assert.equal(payment?.score, undefined);
  });

  it('view model does not produce forbidden business metrics', () => {
    const vm = buildOpportunityDetailViewModel(sampleHotItem());
    const asText = JSON.stringify(vm);
    assert.equal(asText.includes('marketSize'), false);
    assert.equal(asText.includes('retention'), false);
    assert.equal(asText.includes('conversion'), false);
    assert.equal(asText.includes('userCount'), false);
  });

  it('view model evidenceStrength does not read valueScore', () => {
    const vm = buildOpportunityDetailViewModel(sampleHotItem({
      valueScore: 99,
      evidence: [sampleEvidence({ evidenceStrength: 'low' })],
    }));
    assert.equal(vm.signal.evidenceStrength, 'low');
  });

  it('real item can include knowledge_base evidence', () => {
    const vm = buildOpportunityDetailViewModel(sampleHotItem({
      dataTier: 'real',
      evidence: [
        sampleEvidence({
          source: 'HotPulse Market Knowledge',
          type: 'industry_report',
          url: null,
          metadata: { knowledgeType: 'static_market_entry' },
        }),
      ],
    }));
    assert.equal(vm.identity.dataTier, 'real');
    assert.equal(vm.evidence[0].provenance, 'knowledge_base');
  });

  it('fallback item does not auto-mark unknown evidence as observed', () => {
    const vm = buildOpportunityDetailViewModel(sampleHotItem({
      dataTier: 'fallback',
      evidence: [sampleEvidence({ source: 'Unclassified Source' })],
    }));
    assert.equal(vm.identity.dataTier, 'fallback');
    assert.equal(vm.evidence[0].provenance, 'unknown');
  });
});

describe('buildHotspotListFromItems attaches dataTier', () => {
  it('injects mapped tier into each HotItem', () => {
    const list = buildHotspotListFromItems([sampleHotspot()], { dataTier: 'real' });
    assert.equal(list.items[0].dataTier, 'real');
  });

  it('response-level dataTier cannot be overridden by item field', () => {
    const transportItem = {
      ...sampleHotspot(),
      // Simulate dirty transport payload; must be ignored by mapper.
      dataTier: 'fallback',
    } as unknown as HotspotItem;
    const list = buildHotspotListFromItems([transportItem], { dataTier: 'mock' });
    assert.equal(list.items[0].dataTier, 'mock');
  });
});
