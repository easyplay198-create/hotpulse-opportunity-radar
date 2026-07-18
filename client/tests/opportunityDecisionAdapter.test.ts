import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { EvidenceItem, HotItem } from '../src/types/hot.js';
import { buildOpportunityDecisionV1 } from '../src/viewModels/opportunityDecisionAdapter.js';
import {
  APP_STORE_KEY_QUESTIONS,
  GITHUB_KEY_QUESTIONS,
  HACKER_NEWS_KEY_QUESTIONS,
  MISSING_EXTERNAL_KEY_QUESTIONS,
  keyQuestionsAreSafe,
} from '../src/lib/opportunityValidationQuestions.js';

function sampleEvidence(overrides: Partial<EvidenceItem> = {}): EvidenceItem {
  return {
    title: 'Sample evidence',
    source: 'App Store',
    type: 'app_store_signal',
    evidenceStrength: 'medium',
    retrievedAt: '2026-06-20T02:00:00.000Z',
    url: 'https://apps.apple.com/app/id123',
    metadata: {},
    ...overrides,
  };
}

function sampleItem(overrides: Partial<HotItem> = {}): HotItem {
  return {
    id: 'opp-1',
    platformId: 'App Store',
    title: 'Perplexity - AI Search & Chat',
    category: 'AI',
    heat: 70,
    interaction: 60,
    valueScore: 66,
    verdict: 'watch',
    summary: 'sample summary',
    tags: ['ai'],
    publishedAt: '2026-06-20T01:00:00.000Z',
    targetMarket: 'Global',
    productType: 'AI 应用',
    paymentRisk: 42,
    localizationRisk: 55,
    competitionRisk: 61,
    complianceRisk: 40,
    acquisitionRisk: 47,
    aiCostRisk: 52,
    dataTier: 'real',
    evidence: [
      sampleEvidence({
        title: 'App Store evidence',
        metadata: { rating: 4.83, ratingCount: 477572 },
      }),
    ],
    ...overrides,
  };
}

describe('OpportunityDecisionV1 - App Store', () => {
  it('includes rating + ratingCount observations and claims', () => {
    const decision = buildOpportunityDecisionV1(sampleItem());
    const appObservation = decision.observations[0];
    assert.equal(appObservation.provenance, 'observed');
    assert.match(appObservation.valueLabel ?? '', /4\.83/);
    assert.match(appObservation.valueLabel ?? '', /477,572 条评价/);
    assert.equal(decision.supportsClaims.some((claim) => claim.statement.includes('评分为 4.83/5')), true);
    assert.equal(decision.supportsClaims.some((claim) => claim.statement.includes('477,572 条评分记录')), true);
  });

  it('supports only rating when count is missing', () => {
    const decision = buildOpportunityDecisionV1(sampleItem({
      evidence: [sampleEvidence({ metadata: { rating: 4.5 } })],
    }));
    assert.equal(decision.supportsClaims.some((claim) => claim.statement.includes('评分为 4.50/5')), true);
    assert.equal(decision.supportsClaims.some((claim) => claim.statement.includes('评分记录')), false);
  });

  it('does not create count claim when ratingCount is 0', () => {
    const decision = buildOpportunityDecisionV1(sampleItem({
      evidence: [sampleEvidence({ metadata: { rating: 4.5, ratingCount: 0 } })],
    }));
    assert.equal(decision.supportsClaims.some((claim) => claim.statement.includes('评分记录')), false);
  });

  it('handles missing external url', () => {
    const decision = buildOpportunityDecisionV1(sampleItem({
      evidence: [sampleEvidence({ url: null, metadata: { rating: 4.5, ratingCount: 1000 } })],
    }));
    assert.equal(decision.dataNotes.hasExternalSourceUrl, false);
    assert.equal(decision.supportsClaims.length, 0);
  });

  it('keeps claims within minimal factual boundary', () => {
    const decision = buildOpportunityDecisionV1(sampleItem());
    const text = decision.supportsClaims.map((claim) => claim.statement).join(' | ');
    assert.equal(text.includes('需求旺盛'), false);
    assert.equal(text.includes('高度认可'), false);
    assert.equal(text.includes('高留存'), false);
  });

  it('includes required app store limitations', () => {
    const decision = buildOpportunityDecisionV1(sampleItem());
    const text = decision.limitations.map((item) => item.statement).join(' | ');
    assert.equal(text.includes('评分仅反映该平台已有评分用户的反馈'), true);
    assert.equal(text.includes('评价数量不等于活跃用户数、MAU、留存率或付费用户数'), true);
    assert.equal(text.includes('平台表现不能直接证明其他国家或渠道的获客可行性'), true);
  });
});

describe('OpportunityDecisionV1 - GitHub', () => {
  it('supports stars + forks observations and claims', () => {
    const decision = buildOpportunityDecisionV1(sampleItem({
      platformId: 'GitHub',
      evidence: [sampleEvidence({
        source: 'GitHub',
        type: 'developer_signal',
        url: 'https://github.com/example/repo',
        metadata: { stars: 50600, forks: 4200 },
      })],
    }));
    assert.equal(decision.supportsClaims.some((claim) => claim.statement.includes('50.6k Stars')), true);
    assert.equal(decision.supportsClaims.some((claim) => claim.statement.includes('4.2k Forks')), true);
  });

  it('supports stars-only case', () => {
    const decision = buildOpportunityDecisionV1(sampleItem({
      evidence: [sampleEvidence({
        source: 'GitHub',
        type: 'developer_signal',
        url: 'https://github.com/example/repo',
        metadata: { stars: 600 },
      })],
    }));
    assert.equal(decision.supportsClaims.some((claim) => claim.statement.includes('Stars')), true);
    assert.equal(decision.supportsClaims.some((claim) => claim.statement.includes('Forks')), false);
  });

  it('does not infer business value from stars', () => {
    const decision = buildOpportunityDecisionV1(sampleItem({
      evidence: [sampleEvidence({
        source: 'GitHub',
        type: 'developer_signal',
        url: 'https://github.com/example/repo',
        metadata: { stars: 1500 },
      })],
    }));
    const claimText = decision.supportsClaims.map((claim) => claim.statement).join(' | ');
    assert.equal(claimText.includes('商业价值'), false);
    assert.equal(claimText.includes('付费'), false);
  });

  it('contains limitation that forks are not equal to customers', () => {
    const decision = buildOpportunityDecisionV1(sampleItem({
      evidence: [sampleEvidence({
        source: 'GitHub',
        type: 'developer_signal',
        url: 'https://github.com/example/repo',
        metadata: { stars: 1200, forks: 200 },
      })],
    }));
    assert.equal(decision.limitations.some((limitation) => limitation.statement.includes('Forks 不等于独立商业客户')), true);
  });
});

describe('OpportunityDecisionV1 - Hacker News', () => {
  it('supports points + comments claims', () => {
    const decision = buildOpportunityDecisionV1(sampleItem({
      platformId: 'Hacker News',
      evidence: [sampleEvidence({
        source: 'Hacker News',
        type: 'community_signal',
        url: 'https://news.ycombinator.com/item?id=123',
        metadata: { points: 22, commentsCount: 5 },
      })],
    }));
    assert.equal(decision.supportsClaims.some((claim) => claim.statement.includes('22 points')), true);
    assert.equal(decision.supportsClaims.some((claim) => claim.statement.includes('5 comments')), true);
  });

  it('adds weak-signal limitation when points < 10', () => {
    const decision = buildOpportunityDecisionV1(sampleItem({
      evidence: [sampleEvidence({
        source: 'Hacker News',
        type: 'community_signal',
        url: 'https://news.ycombinator.com/item?id=123',
        metadata: { points: 2, commentsCount: 1 },
      })],
    }));
    assert.equal(decision.limitations.some((limitation) => limitation.statement.includes('当前讨论信号较弱')), true);
  });

  it('does not generate trend judgment for low-interaction hn signal', () => {
    const decision = buildOpportunityDecisionV1(sampleItem({
      evidence: [sampleEvidence({
        source: 'Hacker News',
        type: 'community_signal',
        url: 'https://news.ycombinator.com/item?id=123',
        metadata: { points: 2, commentsCount: 0 },
      })],
    }));
    assert.equal(decision.whyNow.statement?.includes('互动量不足以构成“为什么是现在”的判断依据'), true);
    assert.equal(decision.whyNow.statement?.includes('趋势上升'), false);
  });

  it('includes hn sampling bias limitation', () => {
    const decision = buildOpportunityDecisionV1(sampleItem({
      evidence: [sampleEvidence({
        source: 'Hacker News',
        type: 'community_signal',
        url: 'https://news.ycombinator.com/item?id=123',
        metadata: { points: 20, commentsCount: 10 },
      })],
    }));
    assert.equal(decision.limitations.some((limitation) => limitation.statement.includes('Hacker News 样本偏向英语科技和开发者社区')), true);
  });
});

describe('OpportunityDecisionV1 - Provenance and data tier', () => {
  it('separates observed and knowledge_base observations', () => {
    const decision = buildOpportunityDecisionV1(sampleItem({
      evidence: [
        sampleEvidence({ source: 'App Store', metadata: { rating: 4.8, ratingCount: 1000 } }),
        sampleEvidence({
          source: 'HotPulse Market Knowledge',
          type: 'industry_report',
          url: null,
          metadata: { knowledgeType: 'static_market_entry' },
        }),
      ],
    }));
    assert.equal(decision.observations.some((observation) => observation.provenance === 'observed'), true);
    assert.equal(decision.observations.some((observation) => observation.provenance === 'knowledge_base'), true);
  });

  it('does not count knowledge_base entries as external sources', () => {
    const decision = buildOpportunityDecisionV1(sampleItem({
      evidence: [
        sampleEvidence({
          source: 'HotPulse Market Knowledge',
          type: 'industry_report',
          url: null,
          metadata: { knowledgeType: 'static_market_entry' },
        }),
      ],
    }));
    assert.equal(decision.dataNotes.externalSourceCount, 0);
    assert.equal(decision.dataNotes.knowledgeBaseEntryCount, 1);
  });

  it('classifies PRAXON Market Knowledge without counting it as external', () => {
    const decision = buildOpportunityDecisionV1(sampleItem({
      evidence: [
        sampleEvidence({
          source: 'PRAXON Market Knowledge',
          type: 'industry_report',
          url: null,
        }),
      ],
    }));
    assert.equal(decision.observations[0]?.provenance, 'knowledge_base');
    assert.equal(decision.dataNotes.externalSourceCount, 0);
    assert.equal(decision.dataNotes.knowledgeBaseEntryCount, 1);
  });

  it('unknown evidence does not increase external observed source count', () => {
    const decision = buildOpportunityDecisionV1(sampleItem({
      evidence: [sampleEvidence({ source: 'Unknown Feed', url: 'https://example.com' })],
    }));
    assert.equal(decision.dataNotes.externalSourceCount, 0);
    assert.equal(decision.observations[0]?.provenance, 'unknown');
  });

  it('preserves mock/fallback dataTier in identity', () => {
    const mockDecision = buildOpportunityDecisionV1(sampleItem({ dataTier: 'mock' }));
    const fallbackDecision = buildOpportunityDecisionV1(sampleItem({ dataTier: 'fallback' }));
    assert.equal(mockDecision.identity.dataTier, 'mock');
    assert.equal(fallbackDecision.identity.dataTier, 'fallback');
  });
});

describe('OpportunityDecisionV1 - Missing data handling', () => {
  it('does not inject current time when retrievedAt is invalid', () => {
    const decision = buildOpportunityDecisionV1(sampleItem({
      evidence: [sampleEvidence({ retrievedAt: 'not-a-date' })],
    }));
    assert.equal(decision.identity.retrievedAt, undefined);
    assert.equal(decision.whyNow.status, 'insufficient');
    assert.equal(decision.whyNow.statement, null);
  });

  it('does not backfill risk score with 0', () => {
    const decision = buildOpportunityDecisionV1(sampleItem({
      paymentRisk: undefined,
      localizationRisk: undefined,
      competitionRisk: undefined,
      complianceRisk: undefined,
      acquisitionRisk: undefined,
      aiCostRisk: undefined,
      riskFlags: [],
    }));
    assert.equal(decision.risks.length, 0);
  });

  it('without url does not create traceable claims', () => {
    const decision = buildOpportunityDecisionV1(sampleItem({
      evidence: [sampleEvidence({ url: null, metadata: { stars: 1000 } })],
    }));
    assert.equal(decision.supportsClaims.length, 0);
  });

  it('supportsClaims are empty when no observed evidence exists', () => {
    const decision = buildOpportunityDecisionV1(sampleItem({
      evidence: [sampleEvidence({
        source: 'HotPulse Market Knowledge',
        type: 'industry_report',
        url: null,
        metadata: { knowledgeType: 'static_market_entry' },
      })],
    }));
    assert.equal(decision.supportsClaims.length, 0);
  });

  it('missingFields are populated correctly', () => {
    const decision = buildOpportunityDecisionV1(sampleItem({
      productType: '',
      targetMarket: '',
      evidence: [sampleEvidence({ retrievedAt: 'invalid-date', url: null, source: 'Unknown Feed' })],
      paymentRisk: undefined,
      localizationRisk: undefined,
      competitionRisk: undefined,
      complianceRisk: undefined,
      acquisitionRisk: undefined,
      aiCostRisk: undefined,
      riskFlags: [],
    }));
    assert.equal(decision.dataNotes.missingFields.includes('productType'), true);
    assert.equal(decision.dataNotes.missingFields.includes('targetMarket'), true);
    assert.equal(decision.dataNotes.missingFields.includes('observedEvidence'), true);
    assert.equal(decision.dataNotes.missingFields.includes('externalSourceUrl'), true);
    assert.equal(decision.dataNotes.missingFields.includes('retrievedAt'), true);
    assert.equal(decision.dataNotes.missingFields.includes('riskSignals'), true);
  });
});

describe('OpportunityDecisionV1 - Risk dedupe', () => {
  it('keeps only one risk when structured risk and riskFlag conflict', () => {
    const decision = buildOpportunityDecisionV1(sampleItem({
      acquisitionRisk: 72,
      riskFlags: ['平台分发依赖'],
    }));
    const sameRisk = decision.risks.filter((risk) => risk.category === 'distribution' && risk.statement.includes('平台分发依赖'));
    assert.equal(sameRisk.length, 1);
    assert.equal(sameRisk[0]?.basis.includes('规则'), true);
    assert.equal(sameRisk[0]?.provenance, 'rule_derived');
  });

  it('does not merge different categories with similar wording', () => {
    const decision = buildOpportunityDecisionV1(sampleItem({
      paymentRisk: 70,
      acquisitionRisk: 75,
      riskFlags: ['支付路径待验证'],
    }));
    const distribution = decision.risks.find((risk) => risk.category === 'distribution');
    const payment = decision.risks.find((risk) => risk.category === 'payment');
    assert.notEqual(distribution, undefined);
    assert.notEqual(payment, undefined);
    assert.notEqual(distribution?.category, payment?.category);
  });

  it('retains basis and provenance after dedupe', () => {
    const decision = buildOpportunityDecisionV1(sampleItem({
      paymentRisk: 80,
      riskFlags: ['支付路径待验证'],
    }));
    const payment = decision.risks.find((risk) => risk.category === 'payment');
    assert.equal(payment?.basis.length ? true : false, true);
    assert.equal(payment?.provenance, 'rule_derived');
  });
});

describe('OpportunityDecisionV1 - Signal summary boundary', () => {
  const blockedPhrases = [
    '市场需求旺盛',
    '趋势上升',
    '商业价值高',
    '值得进入',
    '适合进入',
    '用户高度认可',
    '成功概率',
    '市场空间巨大',
  ];

  function assertNoBlockedSummary(statement: string) {
    for (const phrase of blockedPhrases) {
      assert.equal(statement.includes(phrase), false);
    }
  }

  it('app store summary stays signal-only', () => {
    const decision = buildOpportunityDecisionV1(sampleItem());
    assertNoBlockedSummary(decision.signalSummary.statement);
    assert.equal(decision.signalSummary.statement.includes('当前记录'), true);
  });

  it('github summary stays signal-only', () => {
    const decision = buildOpportunityDecisionV1(sampleItem({
      platformId: 'GitHub',
      evidence: [sampleEvidence({
        source: 'GitHub',
        type: 'developer_signal',
        url: 'https://github.com/example/repo',
        metadata: { stars: 50600, forks: 4200 },
      })],
    }));
    assertNoBlockedSummary(decision.signalSummary.statement);
  });

  it('hn summary stays signal-only', () => {
    const decision = buildOpportunityDecisionV1(sampleItem({
      platformId: 'Hacker News',
      evidence: [sampleEvidence({
        source: 'Hacker News',
        type: 'community_signal',
        url: 'https://news.ycombinator.com/item?id=123',
        metadata: { points: 22, commentsCount: 5 },
      })],
    }));
    assertNoBlockedSummary(decision.signalSummary.statement);
  });

  it('mock/fallback summaries stay signal-only', () => {
    const mockDecision = buildOpportunityDecisionV1(sampleItem({ dataTier: 'mock' }));
    const fallbackDecision = buildOpportunityDecisionV1(sampleItem({ dataTier: 'fallback' }));
    assertNoBlockedSummary(mockDecision.signalSummary.statement);
    assertNoBlockedSummary(fallbackDecision.signalSummary.statement);
  });
});

describe('OpportunityDecisionV1 - Safe semantics', () => {
  function safeNarrativeText() {
    const decision = buildOpportunityDecisionV1(sampleItem());
    return [
      decision.signalSummary.statement,
      decision.whyNow.statement ?? '',
      ...decision.supportsClaims.map((claim) => claim.statement),
      decision.validationHandoff.statement,
    ].join(' | ');
  }

  it('does not include marketSize wording', () => {
    const text = safeNarrativeText();
    assert.equal(text.includes('marketSize'), false);
    assert.equal(text.includes('市场规模'), false);
  });

  it('does not include MAU/DAU wording', () => {
    const text = safeNarrativeText();
    assert.equal(text.includes('MAU'), false);
    assert.equal(text.includes('DAU'), false);
  });

  it('does not include revenue wording', () => {
    const text = safeNarrativeText();
    assert.equal(text.includes('revenue'), false);
    assert.equal(text.includes('收入'), false);
  });

  it('does not include conversion wording', () => {
    const text = safeNarrativeText();
    assert.equal(text.includes('转化率'), false);
  });

  it('does not include success probability wording', () => {
    const text = safeNarrativeText();
    assert.equal(text.includes('成功概率'), false);
  });

  it('does not include "适合进入" wording', () => {
    const text = safeNarrativeText();
    assert.equal(text.includes('适合进入'), false);
  });

  it('does not include "需求旺盛" wording', () => {
    const text = safeNarrativeText();
    assert.equal(text.includes('需求旺盛'), false);
  });

  it('does not include "趋势上升" wording', () => {
    const text = safeNarrativeText();
    assert.equal(text.includes('趋势上升'), false);
  });
});

describe('OpportunityDecisionV1 - validation handoff questions', () => {
  it('generates 3 App Store key questions with rule provenance', () => {
    const decision = buildOpportunityDecisionV1(sampleItem());
    assert.deepEqual(decision.validationHandoff.keyQuestions, [...APP_STORE_KEY_QUESTIONS]);
    assert.equal(decision.validationHandoff.questionsProvenance, 'rule_derived');
  });

  it('generates 3 GitHub key questions', () => {
    const decision = buildOpportunityDecisionV1(sampleItem({
      platformId: 'GitHub',
      evidence: [sampleEvidence({
        source: 'GitHub',
        type: 'developer_signal',
        url: 'https://github.com/example/repo',
        metadata: { stars: 1200, forks: 120 },
      })],
    }));
    assert.deepEqual(decision.validationHandoff.keyQuestions, [...GITHUB_KEY_QUESTIONS]);
  });

  it('generates 3 Hacker News key questions', () => {
    const decision = buildOpportunityDecisionV1(sampleItem({
      platformId: 'Hacker News',
      evidence: [sampleEvidence({
        source: 'Hacker News',
        type: 'community_signal',
        url: 'https://news.ycombinator.com/item?id=123',
        metadata: { points: 8, commentsCount: 2 },
      })],
    }));
    assert.deepEqual(decision.validationHandoff.keyQuestions, [...HACKER_NEWS_KEY_QUESTIONS]);
  });

  it('uses missing external questions for knowledge-only signals', () => {
    const decision = buildOpportunityDecisionV1(sampleItem({
      platformId: 'HotPulse Market Knowledge',
      evidence: [sampleEvidence({
        source: 'HotPulse Market Knowledge',
        type: 'industry_report',
        url: null,
        metadata: { knowledgeType: 'static_market_entry' },
      })],
    }));
    assert.deepEqual(decision.validationHandoff.keyQuestions, [...MISSING_EXTERNAL_KEY_QUESTIONS]);
  });

  it('keeps key questions as safe questions, not conclusions', () => {
    const decision = buildOpportunityDecisionV1(sampleItem());
    assert.equal(decision.validationHandoff.keyQuestions.length, 3);
    assert.equal(keyQuestionsAreSafe(decision.validationHandoff.keyQuestions), true);
    const text = decision.validationHandoff.keyQuestions.join('|');
    assert.equal(text.includes('需求旺盛'), false);
    assert.equal(text.includes('趋势上升'), false);
    assert.equal(text.includes('值得投入'), false);
  });
});
