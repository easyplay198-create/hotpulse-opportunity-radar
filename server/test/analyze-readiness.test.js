import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import {
  app,
  buildJudgmentAssumptions,
  buildJudgmentVerdict,
  parseQueryIntent,
  resolveAnalysisMode,
} from '../index.js';
import {
  buildCorePayload,
  buildDeterministicPresentationFallback,
  buildLlmDraftForAnalyze,
} from '../analyze/llmOrchestrator.js';

function canonicalFixture(overrides = {}) {
  const canonical = {
    assumptions: {
      productType: 'AI 图片工具',
      targetMarket: '日本',
      targetUser: '创作者 / 设计师',
      audienceStatus: 'inferred_hypothesis',
      painPoint: '低成本生成商品素材',
      businessModel: '订阅',
      acquisitionChannel: '内容获客',
      acquisitionChannelDetail: 'YouTube Shorts',
      platformForm: 'Web SaaS',
    },
    missingInfo: [],
    verdict: {
      level: 'prevalidate',
      title: '先做低成本预验证',
      nextMove: '补齐用户访谈和付费意愿证据',
      mainRisk: '证据覆盖不足',
      reason: '当前证据不足。',
    },
    hypotheses: [
      {
        id: 'demand',
        title: '需求假设',
        statement: '初步假设创作者和设计师可能存在该痛点，仍需通过真实访谈验证。',
        status: 'ready_to_test',
      },
      {
        id: 'payment',
        title: '付费假设',
        statement: '订阅制是否能被目标用户接受仍待验证。',
        status: 'ready_to_test',
      },
      {
        id: 'channel',
        title: '渠道假设',
        statement: 'YouTube Shorts 能否低成本触达早期样本仍待验证。',
        status: 'ready_to_test',
      },
    ],
    actionPlan: {
      twentyFourHours: {
        title: '24 小时验证',
        stopCondition: '少于 2 人表达明确需求',
        successMetric: '10 人中至少 3 人表达明确需求',
        steps: ['访谈 10 个目标用户', '整理付费意愿记录'],
        triggeredItems: [],
      },
      sevenDays: {
        title: '7 天验证',
        stopCondition: '没有人接受价格',
        successMetric: '至少 2 个用户接受价格',
        steps: ['制作 landing page', '测试 2 个价格点'],
        triggeredItems: [],
      },
      stopGate: {
        title: '停止条件',
        stopCondition: '没有明确需求、价格或渠道信号',
        successMetric: '只有出现明确继续信号才扩大投入',
        steps: ['10 个目标用户中少于 2 人表达明确需求', '没有人愿意留下邮箱或预约'],
        triggeredItems: [],
      },
    },
    firstPartyKnowledge: {},
    ...overrides,
  };

  return canonical;
}

function validModelDraftFor(canonical) {
  const corePayload = buildCorePayload(canonical);
  const modelActionItems = (stage) => corePayload.actionPlan[stage].items.map((item, index) => ({
    id: item.id,
    title: `${stage} 模型标题 ${index + 1}`,
  }));

  return {
    narrative: {
      userFacingSummary: '已明确日本、订阅制和 YouTube Shorts 获客路径，仍需补真实访谈证据。',
      verdictNarrative: '证据不足，当前不能作为真实进入结论，建议停留在低成本验证阶段。',
    },
    hypothesesCopy: corePayload.hypotheses.map((item) => ({
      id: item.id,
      whyItMatters: `${item.id} 的模型解释`,
    })),
    actionPlanCopy: {
      twentyFourHours: modelActionItems('twentyFourHours'),
      sevenDays: modelActionItems('sevenDays'),
      stopGate: modelActionItems('stopGate'),
    },
  };
}

function assertPresentationComplete(draft) {
  assert.ok(draft.narrative.reportTeaser);
  assert.ok(draft.narrative.userFacingSummary);
  assert.ok(draft.narrative.verdictNarrative);
  assert.equal(draft.hypothesesCopy.length, 3);
  assert.ok(draft.hypothesesCopy.every((item) => item.title && item.description && item.whyItMatters));
  assert.ok(draft.actionPlanCopy.twentyFourHours.every((item) => item.title && item.copy));
  assert.ok(draft.actionPlanCopy.sevenDays.every((item) => item.title && item.copy));
  assert.ok(draft.actionPlanCopy.stopGate.every((item) => item.title && item.copy));
}

const USER_VISIBLE_ENGINEERING_TERMS = /\b(mock|fallback|API|schema)\b|数据源切换|切换真实数据源|mock preview/i;

function collectUserVisiblePresentationText(draft) {
  return [
    draft.narrative.reportTeaser,
    draft.narrative.userFacingSummary,
    draft.narrative.verdictNarrative,
    ...draft.hypothesesCopy.flatMap((item) => [item.title, item.description, item.whyItMatters]),
    ...draft.actionPlanCopy.twentyFourHours.flatMap((item) => [item.title, item.copy]),
    ...draft.actionPlanCopy.sevenDays.flatMap((item) => [item.title, item.copy]),
    ...draft.actionPlanCopy.stopGate.flatMap((item) => [item.title, item.copy]),
  ].filter(Boolean).join('\n');
}

function assertUserVisiblePresentationHasNoEngineeringTerms(draft) {
  const presentationText = collectUserVisiblePresentationText(draft);
  assert.doesNotMatch(presentationText, USER_VISIBLE_ENGINEERING_TERMS);
}

test('analysisMode maps loaded source exactly', () => {
  assert.equal(resolveAnalysisMode('real'), 'real');
  assert.equal(resolveAnalysisMode('mock'), 'mock');
  assert.equal(resolveAnalysisMode('fallback'), 'fallback');
});

test('real mode can reach validate verdict when evidence conditions are met', () => {
  const verdict = buildJudgmentVerdict({
    mode: resolveAnalysisMode('real'),
    response: { recommendation: { matchScore: 90 }, riskBottlenecks: [{ title: '渠道风险' }] },
    evidence: [
      { strength: 'high', url: 'https://example.com/a', sourceType: 'community' },
      { strength: 'high', url: 'https://example.com/b', sourceType: 'app_store' },
      { strength: 'medium', url: null, sourceType: 'market_signal' },
    ],
    missingInfo: [],
    firstPartyKnowledge: null,
    assumptions: {},
  });

  assert.equal(verdict.level, 'validate');
});

test('fallback remains prevalidate even with strong evidence', () => {
  const verdict = buildJudgmentVerdict({
    mode: resolveAnalysisMode('fallback'),
    response: { recommendation: { matchScore: 90 }, riskBottlenecks: [{ title: '渠道风险' }] },
    evidence: [
      { strength: 'high', url: 'https://example.com/a', sourceType: 'community' },
      { strength: 'high', url: 'https://example.com/b', sourceType: 'app_store' },
      { strength: 'medium', url: null, sourceType: 'market_signal' },
    ],
    missingInfo: [],
    firstPartyKnowledge: null,
    assumptions: {},
  });

  assert.equal(verdict.level, 'prevalidate');
});

test('mock mode is not mislabeled as real', () => {
  const verdict = buildJudgmentVerdict({
    mode: resolveAnalysisMode('mock'),
    response: { recommendation: { matchScore: 90 } },
    evidence: [
      { strength: 'high', url: 'https://example.com/a', sourceType: 'community' },
      { strength: 'high', url: 'https://example.com/b', sourceType: 'app_store' },
      { strength: 'medium', url: null, sourceType: 'market_signal' },
    ],
    missingInfo: [],
    firstPartyKnowledge: null,
    assumptions: {},
  });

  assert.equal(resolveAnalysisMode('mock'), 'mock');
  assert.equal(verdict.level, 'preview');
});

test('parseQueryIntent marks explicit audience when user provides one', () => {
  const intent = parseQueryIntent('AI 图片工具出海日本，面向独立设计师，订阅制');
  assert.equal(intent.audienceStatus, 'explicit');
  assert.equal(intent.audience, '独立设计师');
});

test('parseQueryIntent marks missing audience as inferred hypothesis', () => {
  const intent = parseQueryIntent('AI 图片工具出海日本，订阅制');
  assert.equal(intent.audienceStatus, 'inferred_hypothesis');
});

test('buildCorePayload preserves canonical audienceStatus', () => {
  const intent = parseQueryIntent('AI 图片工具出海日本，面向独立设计师，订阅制');
  const assumptions = buildJudgmentAssumptions('AI 图片工具出海日本，面向独立设计师，订阅制', {}, intent);
  const corePayload = buildCorePayload(canonicalFixture({ assumptions }));
  assert.equal(corePayload.assumptions.audienceStatus, 'explicit');
});

test('deterministic fallback builds a complete public llmDraft presentation', () => {
  const draft = buildDeterministicPresentationFallback(canonicalFixture());
  assertPresentationComplete(draft);
  assert.match(draft.narrative.reportTeaser, /日本/);
  assert.match(draft.narrative.reportTeaser, /YouTube Shorts/);
});

test('not_configured returns deterministic non-empty presentation before any provider call', async () => {
  let called = false;
  const draft = await buildLlmDraftForAnalyze({
    canonicalResponse: canonicalFixture(),
    apiKey: '',
    draftClient: async () => {
      called = true;
      return { status: 'success', draft: null };
    },
  });

  assert.equal(called, false);
  assert.equal(draft.status, 'not_configured');
  assertPresentationComplete(draft);
});

test('not_configured presentation copy does not expose engineering terms', async () => {
  const canonical = canonicalFixture({
    verdict: {
      level: 'preview',
      title: '样本模式：仅展示验证结果结构',
      nextMove: '切换真实数据源或补齐真实证据后再判断',
      mainRisk: '当前是 mock preview，不能作为真实进入判断。',
      reason: 'mock preview 不包含真实市场证据。',
    },
  });
  let called = false;
  const draft = await buildLlmDraftForAnalyze({
    canonicalResponse: canonical,
    apiKey: '',
    draftClient: async () => {
      called = true;
      return { status: 'success', draft: null };
    },
  });

  assert.equal(called, false);
  assert.equal(draft.status, 'not_configured');
  assertPresentationComplete(draft);
  assertUserVisiblePresentationHasNoEngineeringTerms(draft);
  assert.match(draft.narrative.verdictNarrative, /证据不足/);
  assert.match(draft.narrative.verdictNarrative, /不能作为真实进入结论/);
  assert.match(draft.narrative.verdictNarrative, /低成本验证阶段/);
  assert.match(draft.narrative.verdictNarrative, /真实用户样本和市场证据/);
  assert.match(draft.narrative.verdictNarrative, /再决定是否扩大投入/);
});

test('timeout returns deterministic non-empty presentation', async () => {
  const draft = await buildLlmDraftForAnalyze({
    canonicalResponse: canonicalFixture(),
    apiKey: 'test-key',
    draftClient: async () => ({ status: 'timeout', model: 'stub-model', warnings: ['timeout'] }),
  });

  assert.equal(draft.status, 'timeout');
  assertPresentationComplete(draft);
});

test('provider error returns deterministic non-empty presentation', async () => {
  const draft = await buildLlmDraftForAnalyze({
    canonicalResponse: canonicalFixture(),
    apiKey: 'test-key',
    draftClient: async () => ({ status: 'error', model: 'stub-model', warnings: ['provider error'] }),
  });

  assert.equal(draft.status, 'error');
  assertPresentationComplete(draft);
});

test('malformed provider output returns deterministic non-empty presentation', async () => {
  const draft = await buildLlmDraftForAnalyze({
    canonicalResponse: canonicalFixture(),
    apiKey: 'test-key',
    draftClient: async () => ({ status: 'malformed', model: 'stub-model', warnings: ['bad json'] }),
  });

  assert.equal(draft.status, 'malformed');
  assertPresentationComplete(draft);
});

test('rejected model alignment returns deterministic non-empty presentation', async () => {
  const draft = await buildLlmDraftForAnalyze({
    canonicalResponse: canonicalFixture(),
    apiKey: 'test-key',
    draftClient: async () => ({
      status: 'success',
      model: 'stub-model',
      draft: {
        ...validModelDraftFor(canonicalFixture()),
        hypothesesCopy: [{ id: 'payment', whyItMatters: 'wrong order' }],
      },
      warnings: [],
    }),
  });

  assert.equal(draft.status, 'rejected');
  assertPresentationComplete(draft);
});

test('deterministic reportTeaser is stable across provider failures', async () => {
  const canonical = canonicalFixture();
  const expected = buildDeterministicPresentationFallback(canonical).narrative.reportTeaser;
  const statuses = ['timeout', 'error', 'malformed'];

  for (const status of statuses) {
    const draft = await buildLlmDraftForAnalyze({
      canonicalResponse: canonical,
      apiKey: 'test-key',
      draftClient: async () => ({ status, model: 'stub-model', warnings: [status] }),
    });
    assert.equal(draft.narrative.reportTeaser, expected);
  }
});

test('provider failure presentations do not reintroduce engineering terms', async () => {
  const canonical = canonicalFixture({
    verdict: {
      level: 'preview',
      title: '样本模式：仅展示验证结果结构',
      nextMove: '切换真实数据源或补齐真实证据后再判断',
      mainRisk: '当前是 mock preview，不能作为真实进入判断。',
      reason: 'mock preview 不包含真实市场证据。',
    },
  });
  const rejectedDraft = {
    ...validModelDraftFor(canonical),
    hypothesesCopy: [{ id: 'payment', whyItMatters: 'wrong order' }],
  };
  const cases = [
    ['timeout', async () => ({ status: 'timeout', model: 'stub-model', warnings: ['timeout'] })],
    ['error', async () => ({ status: 'error', model: 'stub-model', warnings: ['provider error'] })],
    ['malformed', async () => ({ status: 'malformed', model: 'stub-model', warnings: ['bad json'] })],
    ['rejected', async () => ({ status: 'success', model: 'stub-model', draft: rejectedDraft, warnings: [] })],
  ];

  for (const [expectedStatus, draftClient] of cases) {
    const draft = await buildLlmDraftForAnalyze({
      canonicalResponse: canonical,
      apiKey: 'test-key',
      draftClient,
    });
    assert.equal(draft.status, expectedStatus);
    assertPresentationComplete(draft);
    assertUserVisiblePresentationHasNoEngineeringTerms(draft);
  }
});

test('success only overwrites allowlisted explanation fields', async () => {
  const canonical = canonicalFixture();
  const deterministic = buildDeterministicPresentationFallback(canonical);
  const modelDraft = validModelDraftFor(canonical);
  const draft = await buildLlmDraftForAnalyze({
    canonicalResponse: canonical,
    apiKey: 'test-key',
    draftClient: async () => ({ status: 'success', model: 'stub-model', draft: modelDraft, warnings: [] }),
  });

  assert.equal(draft.status, 'success');
  assert.equal(draft.narrative.reportTeaser, deterministic.narrative.reportTeaser);
  assert.equal(draft.narrative.userFacingSummary, modelDraft.narrative.userFacingSummary);
  assert.equal(draft.narrative.verdictNarrative, modelDraft.narrative.verdictNarrative);
  assert.deepEqual(
    draft.hypothesesCopy.map(({ id, title, description }) => ({ id, title, description })),
    deterministic.hypothesesCopy.map(({ id, title, description }) => ({ id, title, description })),
  );
  assert.equal(draft.hypothesesCopy[0].whyItMatters, modelDraft.hypothesesCopy[0].whyItMatters);
  assert.equal(draft.actionPlanCopy.twentyFourHours[0].title, modelDraft.actionPlanCopy.twentyFourHours[0].title);
  assert.equal(draft.actionPlanCopy.twentyFourHours[0].copy, deterministic.actionPlanCopy.twentyFourHours[0].copy);
});

test('canonical ownership is unchanged by llm draft generation', async () => {
  const canonical = canonicalFixture();
  const before = structuredClone(canonical);
  await buildLlmDraftForAnalyze({
    canonicalResponse: canonical,
    apiKey: 'test-key',
    draftClient: async () => ({ status: 'success', model: 'stub-model', draft: validModelDraftFor(canonical), warnings: [] }),
  });

  assert.deepEqual(canonical, before);
  assert.equal(canonical.assumptions.targetMarket, before.assumptions.targetMarket);
  assert.equal(canonical.verdict.level, before.verdict.level);
  assert.deepEqual(canonical.hypotheses, before.hypotheses);
  assert.deepEqual(canonical.actionPlan, before.actionPlan);
  assert.equal(canonical.assumptions.targetUser, before.assumptions.targetUser);
  assert.equal(canonical.assumptions.acquisitionChannelDetail, before.assumptions.acquisitionChannelDetail);
  assert.deepEqual(canonical.actionPlan.stopGate.steps, before.actionPlan.stopGate.steps);
});

test('offline API smoke returns mock analysis with deterministic llmDraft when key is disabled', async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = '';

  const server = app.listen(0);
  await once(server, 'listening');
  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'mock',
        query: 'AI 图片工具出海日本，订阅制，通过 YouTube Shorts 获客',
      }),
    });
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.mode, 'mock');
    assert.equal(payload.llmDraft.status, 'not_configured');
    assertPresentationComplete(payload.llmDraft);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
});
