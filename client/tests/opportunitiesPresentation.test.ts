import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildAnalyzeHrefFromOpportunity,
  buildPublicAnalyzeQuery,
  getCardObservations,
  getDrawerObservedRows,
  getKnowledgeBaseEntries,
  isKnowledgeBaseEvidence,
  KNOWLEDGE_BASE_SOURCE_NAMES,
  mapDataTierLabel,
  mapEvidenceStrengthLabel,
  pickCardPrimarySource,
  RISK_PROVENANCE_LABEL,
  shouldShowMarket,
  sortByInternalScore,
  PUBLIC_SIGNAL_PRESETS,
  PUBLIC_SORT_OPTIONS,
} from '../src/pages/OpportunitiesPage/presentation.js';

type AnalyzeHrefInput = Parameters<typeof buildAnalyzeHrefFromOpportunity>[0];

describe('Opportunities presentation semantics', () => {
  it('maps evidenceStrength labels including insufficient', () => {
    assert.equal(mapEvidenceStrengthLabel('high'), '强证据');
    assert.equal(mapEvidenceStrengthLabel('medium'), '中等证据');
    assert.equal(mapEvidenceStrengthLabel('low'), '弱证据');
    assert.equal(mapEvidenceStrengthLabel('insufficient'), '证据不足');
    assert.equal(mapEvidenceStrengthLabel('unknown'), '证据不足');
  });

  it('maps dataTier labels', () => {
    assert.equal(mapDataTierLabel('real'), '真实信号');
    assert.equal(mapDataTierLabel('mock'), '演示数据');
    assert.equal(mapDataTierLabel('fallback'), '降级样本');
  });

  it('keeps internal default score ordering by valueScore', () => {
    const sorted = sortByInternalScore([
      { id: 'a', valueScore: 65 },
      { id: 'b', valueScore: 79 },
      { id: 'c', valueScore: 72 },
    ]);
    assert.deepEqual(sorted.map((item) => item.id), ['b', 'c', 'a']);
  });

  it('public sort options do not expose 综合分 wording', () => {
    const labels = PUBLIC_SORT_OPTIONS.map((option) => option.label).join('|');
    assert.equal(labels.includes('综合分'), false);
    assert.equal(labels.includes('默认顺序'), true);
  });

  it('public presets do not expose highScore preset', () => {
    const values = PUBLIC_SIGNAL_PRESETS.map((preset) => preset.value);
    const labels = PUBLIC_SIGNAL_PRESETS.map((preset) => preset.label).join('|');
    assert.equal(values.includes('strongEvidence'), true);
    assert.equal(values.some((value) => value === 'highScore'), false);
    assert.equal(labels.includes('高分'), false);
  });

  it('public analyze query removes score-derived wording', () => {
    const q = buildPublicAnalyzeQuery({
      title: 'AI 助手',
      productType: 'AI 工具',
      targetMarket: '日本',
      summary: '综合评分 67，当前建议 watch',
      evidenceStrength: 'medium',
      riskHint: '主要风险：支付路径待验证',
    });
    assert.equal(q.includes('综合评分'), false);
    assert.equal(q.includes('watch'), false);
    assert.equal(q.includes('do_now'), false);
    assert.equal(q.includes('skip'), false);
  });

  it('analyze href keeps existing keys but drops score/verdict wording', () => {
    const opportunity: AnalyzeHrefInput = {
      id: 'opp-1',
      title: '日本 AI 机会',
      productType: 'AI 工具',
      targetMarket: '日本',
      summary: '综合评分 67，建议 do_now',
      evidenceStrength: 'high',
      riskHint: '支付路径待验证',
    };
    const href = buildAnalyzeHrefFromOpportunity(opportunity);

    const url = new URL(`https://example.com${href}`);
    assert.equal(url.pathname, '/analyze');
    assert.equal(url.searchParams.get('opportunityId'), 'opp-1');
    assert.equal(url.searchParams.get('auto'), '1');
    assert.equal(url.searchParams.get('targetMarket'), '日本');
    assert.equal(url.searchParams.get('productType'), 'AI 工具');
    const query = url.searchParams.get('q') ?? '';
    assert.equal(query.includes('综合评分'), false);
    assert.equal(query.includes('do_now'), false);
    assert.equal(query.includes('watch'), false);
    assert.equal(query.includes('skip'), false);
  });
});

// ── Provenance-first helpers ─────────────────────────────────────────────

const appStoreEv = { source: 'App Store', title: 'App Store signal', metadata: { rating: 4.83, reviewCount: 477572 } };
const githubEv = { source: 'GitHub', title: 'GitHub signal', metadata: { stars: 185000, forks: 46000 } };
const hnEv = { source: 'Hacker News', title: 'HN signal', metadata: { points: 220, commentsCount: 85 } };
const hnWeakEv = { source: 'Hacker News', title: 'HN weak', metadata: { points: 2, commentsCount: 0 } };
const kbEv = { source: 'HotPulse Market Knowledge', title: '市场知识库条目', metadata: { knowledgeType: 'static_market_entry' } };
const kbEv2 = { source: 'SomeSource', title: '内部知识', metadata: { knowledgeType: 'internal' } };

describe('Provenance-first: isKnowledgeBaseEvidence', () => {
  it('returns true for HotPulse Market Knowledge source', () => {
    assert.equal(isKnowledgeBaseEvidence(kbEv), true);
  });

  it('returns true when metadata knowledgeType is present', () => {
    assert.equal(isKnowledgeBaseEvidence(kbEv2), true);
  });

  it('returns false for App Store', () => {
    assert.equal(isKnowledgeBaseEvidence(appStoreEv), false);
  });

  it('KNOWLEDGE_BASE_SOURCE_NAMES includes HotPulse Market Knowledge', () => {
    assert.equal(KNOWLEDGE_BASE_SOURCE_NAMES.has('HotPulse Market Knowledge'), true);
  });
});

describe('Provenance-first: pickCardPrimarySource', () => {
  it('returns first non-knowledge-base source', () => {
    const result = pickCardPrimarySource([kbEv, appStoreEv]);
    assert.equal(result, 'App Store');
  });

  it('never returns HotPulse Market Knowledge as primary source', () => {
    const result = pickCardPrimarySource([kbEv]);
    assert.notEqual(result, 'HotPulse Market Knowledge');
    assert.equal(result, '');
  });

  it('prefers platformId when provided', () => {
    const result = pickCardPrimarySource([appStoreEv], 'Apple App Store');
    assert.equal(result, 'Apple App Store');
  });

  it('skips knowledge_base metadata sources', () => {
    const result = pickCardPrimarySource([kbEv2, githubEv]);
    assert.equal(result, 'GitHub');
  });
});

describe('Provenance-first: shouldShowMarket', () => {
  it('hides Global market', () => {
    assert.equal(shouldShowMarket('Global'), false);
    assert.equal(shouldShowMarket('global'), false);
  });

  it('hides 待确认 market', () => {
    assert.equal(shouldShowMarket('待确认'), false);
  });

  it('hides empty/null/undefined', () => {
    assert.equal(shouldShowMarket(''), false);
    assert.equal(shouldShowMarket(null), false);
    assert.equal(shouldShowMarket(undefined), false);
  });

  it('shows specific market like Japan', () => {
    assert.equal(shouldShowMarket('日本'), true);
    assert.equal(shouldShowMarket('美国'), true);
  });
});

describe('Provenance-first: getCardObservations', () => {
  it('formats App Store rating correctly', () => {
    const [obs] = getCardObservations([appStoreEv]);
    assert.equal(obs.metricsLine, '4.83 / 5 · 477,572 条评价');
  });

  it('formats GitHub stars and forks correctly', () => {
    const [obs] = getCardObservations([githubEv]);
    assert.match(obs.metricsLine ?? '', /Stars/);
    assert.match(obs.metricsLine ?? '', /Forks/);
  });

  it('formats Hacker News points and comments', () => {
    const [obs] = getCardObservations([hnEv]);
    assert.match(obs.metricsLine ?? '', /220 points/);
    assert.match(obs.metricsLine ?? '', /85 comments/);
  });

  it('expresses very low HN points as weak signal', () => {
    const [obs] = getCardObservations([hnWeakEv]);
    assert.match(obs.metricsLine ?? '', /公开讨论较弱/);
    assert.match(obs.metricsLine ?? '', /2 points/);
  });

  it('excludes knowledge_base evidence from card observations', () => {
    const result = getCardObservations([kbEv, appStoreEv]);
    assert.equal(result.length, 1);
    assert.equal(result[0].sourceName, 'App Store');
  });

  it('card observations do not contain evidenceStrength text', () => {
    const result = getCardObservations([appStoreEv]);
    const text = JSON.stringify(result);
    assert.equal(text.includes('强证据'), false);
    assert.equal(text.includes('中等证据'), false);
    assert.equal(text.includes('证据强度'), false);
  });

  it('card observations do not contain evidenceCount', () => {
    const result = getCardObservations([appStoreEv, githubEv]);
    const text = JSON.stringify(result);
    assert.equal(text.includes('条证据'), false);
  });

  it('formats App Store rating with ratingCount field (alternative field name)', () => {
    const ev = { source: 'App Store', title: 'App Store', metadata: { rating: 4.81, ratingCount: 477572 } };
    const [obs] = getCardObservations([ev]);
    assert.match(obs.metricsLine ?? '', /477,572 条评价/);
    assert.match(obs.metricsLine ?? '', /4\.81 \/ 5/);
  });

  it('shows only rating when no count field is present', () => {
    const ev = { source: 'App Store', title: 'App Store', metadata: { rating: 4.5 } };
    const [obs] = getCardObservations([ev]);
    assert.equal(obs.metricsLine, '4.50 / 5');
    assert.equal(obs.metricsLine?.includes('条评价'), false);
  });

  it('does not show count when ratingCount is 0', () => {
    const ev = { source: 'App Store', title: 'App Store', metadata: { rating: 4.5, ratingCount: 0 } };
    const [obs] = getCardObservations([ev]);
    assert.equal(obs.metricsLine, '4.50 / 5');
    assert.equal(obs.metricsLine?.includes('条评价'), false);
  });

  it('does not show fabricated default count when neither reviewCount nor ratingCount exists', () => {
    const ev = { source: 'App Store', title: 'App Store', metadata: { rating: 4.9 } };
    const [obs] = getCardObservations([ev]);
    assert.equal(obs.metricsLine?.includes('条评价'), false);
    assert.equal(obs.metricsLine?.includes('评价'), false);
  });
});

describe('Provenance-first: getDrawerObservedRows', () => {
  it('returns observed rows with rawUrl for original link', () => {
    const ev = { ...appStoreEv, url: 'https://apps.apple.com/app/example/id12345' };
    const [row] = getDrawerObservedRows([ev]);
    assert.equal(row.rawUrl, 'https://apps.apple.com/app/example/id12345');
  });

  it('excludes knowledge_base from drawer observed rows', () => {
    const rows = getDrawerObservedRows([kbEv, hnEv]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].sourceName, 'Hacker News');
  });

  it('marks low HN signals as isWeakSignal', () => {
    const [row] = getDrawerObservedRows([hnWeakEv]);
    assert.equal(row.isWeakSignal, true);
  });
});

describe('Provenance-first: getKnowledgeBaseEntries', () => {
  it('returns only knowledge_base entries', () => {
    const entries = getKnowledgeBaseEntries([appStoreEv, kbEv]);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].source, 'HotPulse Market Knowledge');
  });

  it('knowledge_base entries never mixed with observed entries', () => {
    const observed = getDrawerObservedRows([appStoreEv, kbEv]);
    const kb = getKnowledgeBaseEntries([appStoreEv, kbEv]);
    const obsNames = observed.map((r) => r.sourceName);
    const kbNames = kb.map((e) => e.source);
    const overlap = obsNames.filter((name) => kbNames.includes(name));
    assert.equal(overlap.length, 0);
  });
});

describe('Provenance-first: RISK_PROVENANCE_LABEL', () => {
  it('is 规则推导', () => {
    assert.equal(RISK_PROVENANCE_LABEL, '规则推导');
  });
});

describe('Provenance-first: CTA query hygiene', () => {
  it('CTA query does not contain score or verdict', () => {
    const href = buildAnalyzeHrefFromOpportunity({
      id: 'x',
      title: 'Test',
      productType: 'SaaS',
      targetMarket: '日本',
      evidenceStrength: 'high',
      riskHint: '支付风险',
    });
    assert.equal(href.includes('score'), false);
    assert.equal(href.includes('verdict'), false);
    assert.equal(href.includes('do_now'), false);
    assert.equal(href.includes('skip'), false);
  });
});

describe('Provenance-first: internal valueScore sort preserved', () => {
  it('sortByInternalScore still ranks by valueScore descending', () => {
    const items = [
      { id: 'low', valueScore: 30 },
      { id: 'high', valueScore: 90 },
      { id: 'mid', valueScore: 60 },
    ];
    const sorted = sortByInternalScore(items);
    assert.equal(sorted[0].id, 'high');
    assert.equal(sorted[2].id, 'low');
  });
});

