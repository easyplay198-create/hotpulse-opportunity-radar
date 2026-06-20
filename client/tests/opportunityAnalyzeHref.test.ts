import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildAnalyzeHrefBySource, buildAnalyzeHrefFromOpportunity } from '../src/lib/opportunityAnalyzeHref.js';
import { buildOpportunityDecisionV1 } from '../src/viewModels/opportunityDecisionAdapter.js';
import { buildAnalyzeHrefFromOpportunity as buildAnalyzeHrefFromPresentation } from '../src/pages/OpportunitiesPage/presentation.js';
import type { HotItem } from '../src/types/hot.js';

function sampleItem(overrides: Partial<HotItem> = {}): HotItem {
  return {
    id: 'opp-42',
    platformId: 'App Store',
    title: 'Perplexity - AI Search & Chat',
    category: 'AI',
    heat: 70,
    interaction: 60,
    valueScore: 66,
    verdict: 'watch',
    summary: '综合评分 67，建议 do_now',
    tags: ['ai'],
    publishedAt: '2026-06-20T01:00:00.000Z',
    targetMarket: '日本',
    productType: 'AI 工具',
    paymentRisk: 42,
    localizationRisk: 55,
    competitionRisk: 61,
    complianceRisk: 40,
    acquisitionRisk: 47,
    aiCostRisk: 52,
    dataTier: 'real',
    riskFlags: ['平台分发依赖'],
    evidence: [{
      title: 'App Store',
      source: 'App Store',
      type: 'app_store_signal',
      evidenceStrength: 'medium',
      retrievedAt: '2026-06-20T02:00:00.000Z',
      url: 'https://apps.apple.com/app/id123',
      metadata: { rating: 4.83, ratingCount: 477572 },
    }],
    ...overrides,
  };
}

describe('Opportunity analyze href helper', () => {
  it('presentation re-export and lib helper output exactly same href', () => {
    const input = {
      id: 'opp-1',
      title: '日本 AI 机会',
      productType: 'AI 工具',
      targetMarket: '日本',
      summary: '综合评分 67，建议 watch',
      evidenceStrength: 'high' as const,
      riskHint: '支付路径待验证',
    };
    assert.equal(buildAnalyzeHrefFromPresentation(input), buildAnalyzeHrefFromOpportunity(input));
  });

  it('decision adapter handoff uses same helper output', () => {
    const item = sampleItem();
    const decision = buildOpportunityDecisionV1(item);
    const href = buildAnalyzeHrefFromOpportunity({
      id: item.id,
      title: item.title,
      productType: item.productType,
      targetMarket: item.targetMarket,
      primarySource: item.platformId,
      evidence: item.evidence,
      risks: item.riskFlags,
      summary: item.summary,
      evidenceStrength: 'medium',
      riskHint: '主要风险待验证',
    });
    assert.equal(decision.validationHandoff.analyzeHref, href);
  });

  it('keeps opportunityId and auto=1', () => {
    const href = buildAnalyzeHrefFromOpportunity({
      id: 'x-1',
      title: 'Title',
    });
    const url = new URL(`https://example.com${href}`);
    assert.equal(url.searchParams.get('opportunityId'), 'x-1');
    assert.equal(url.searchParams.get('auto'), '1');
  });

  it('keeps targetMarket and productType', () => {
    const href = buildAnalyzeHrefFromOpportunity({
      id: 'x-1',
      title: 'Title',
      productType: 'AI 工具',
      targetMarket: '日本',
    });
    const url = new URL(`https://example.com${href}`);
    assert.equal(url.searchParams.get('targetMarket'), '日本');
    assert.equal(url.searchParams.get('productType'), 'AI 工具');
  });

  it('does not include score/valueScore/verdict keywords', () => {
    const href = buildAnalyzeHrefFromOpportunity({
      id: 'x-1',
      title: 'Title',
      summary: '综合评分 77，valueScore=77，verdict=watch',
    });
    assert.equal(href.includes('valueScore'), false);
    assert.equal(href.includes('score='), false);
    assert.equal(href.includes('verdict'), false);
  });

  it('does not include do_now/watch/skip keywords', () => {
    const href = buildAnalyzeHrefFromOpportunity({
      id: 'x-1',
      title: 'Title',
      summary: '建议 do_now，也可能 watch，不应 skip',
    });
    assert.equal(href.includes('do_now'), false);
    assert.equal(href.includes('watch'), false);
    assert.equal(href.includes('skip'), false);
  });

  it('encodes special characters safely', () => {
    const href = buildAnalyzeHrefFromOpportunity({
      id: 'x-1',
      title: 'A&B?=中文',
      productType: 'SaaS / AI',
      targetMarket: '日本&美国',
    });
    const url = new URL(`https://example.com${href}`);
    assert.equal(url.searchParams.get('targetMarket'), '日本&美国');
    assert.equal(url.searchParams.get('productType'), 'SaaS / AI');
  });

  it('does not output literal undefined string', () => {
    const href = buildAnalyzeHrefFromOpportunity({
      id: 'x-1',
      title: 'Title',
      productType: undefined,
      targetMarket: undefined,
      summary: undefined,
      riskHint: undefined,
    });
    assert.equal(href.includes('undefined'), false);
  });

  it('top-level analyze link by source stays unchanged', () => {
    assert.equal(buildAnalyzeHrefBySource('mock'), '/analyze?source=mock');
    assert.equal(buildAnalyzeHrefBySource('fallback'), '/analyze?source=fallback');
  });
});
