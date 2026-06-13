import { callOpenAIResponsesDraft } from './openaiResponsesClient.js';
import { callOpenAIChatCompletionsDraft } from './openaiChatCompletionsClient.js';
import { createEmptyLlmDraft, guardLlmDraft } from './llmGuardrails.js';
import { normalizeOpenAIBaseUrl, normalizeOpenAITimeoutMs, openAIBaseUrlHost } from './openaiResponsesClient.js';

function systemPrompt() {
  return [
    '你是 HotPulse 的 LLM draft writer，不是最终裁判。',
    '目标用户是中国 AI / SaaS / App 出海小团队。',
    'canonical verdict、confidence、firstPartyKnowledge、provenance、evidenceStrength 已由系统计算完成。',
    '你只能根据输入的可信 core payload 写解释性草稿。',
    '不要编造 URL、政策条款、竞品数据、价格、下载量、评分。',
    '不要改变目标市场。',
    '不要写任何 JSON schema 之外的字段。',
    '不要输出 evidence。',
    '不要声称某个 unknown 已经 resolved。',
    '不要给出与 canonical verdict 相反的建议。',
    '如果 core verdict 是 hold / stop / insufficient，文案不能写成“建议直接推进”。',
    '只能使用 corePayload 中已有的事实、假设和判断。',
    'unknown 只能表示信息确实未知，不能覆盖已知字段。',
    '不要新增受众、渠道、国家、平台、数字和风险。',
    'hypothesesCopy 只输出 id 和 whyItMatters，id、数量和顺序必须与 corePayload.hypotheses 完全一致。',
    '不要输出 hypothesis title 或 description，它们由 deterministic core 注入。',
    'actionPlanCopy 每项只输出 id 和 title，id、数量和顺序必须与 corePayload.actionPlan 各阶段 items 完全一致。',
    '不要输出 action copy，动作内容和停止门槛由 deterministic core 注入。',
    '同一阶段内 action title 必须表达各自任务目的，不得全部相同。',
    'reportTeaser 不需要输出，它由 deterministic core 生成。',
    'userFacingSummary 只说明已经明确什么、仍缺什么、接下来最需要补什么证据，不要重复 verdict。',
    'verdictNarrative 只说明当前能不能做进入决策、为什么、建议停留在哪个验证阶段。',
    'verdictNarrative 必须包含“证据不足”或同义表达，必须说明“不能作为真实进入结论”或同义表达，必须说明仍处于“低成本验证”或“预验证”阶段。',
    'hypothesesCopy 每项只写 whyItMatters，不要复述 description。',
    'actionPlanCopy 每项 title 要短且具体，只概括对应 id 的动作目的。',
    '用户可见文案禁止出现 mock、fallback、API、schema、数据源切换、工程调试推演。',
    '证据不足和不能作为真实进入结论的含义必须保留。',
  ].join('\n');
}

function compactFirstPartyKnowledge(knowledge = {}) {
  return Object.fromEntries(Object.entries(knowledge).map(([key, value]) => [
    key,
    {
      level: value?.level,
      summary: value?.summary,
      provenance: value?.provenance,
    },
  ]));
}

function actionStageItems(stageKey, stage = {}) {
  const steps = Array.isArray(stage.steps) ? stage.steps : [];
  return steps.map((step, index) => ({
    id: `${stageKey}-${index}`,
    title: step,
    sourceText: step,
  }));
}

function compactActionPlan(actionPlan = {}) {
  return {
    twentyFourHours: {
      title: actionPlan.twentyFourHours?.title,
      stopCondition: actionPlan.twentyFourHours?.stopCondition,
      successMetric: actionPlan.twentyFourHours?.successMetric,
      items: actionStageItems('twentyFourHours', actionPlan.twentyFourHours),
      triggeredItems: (actionPlan.twentyFourHours?.triggeredItems || []).map((item) => ({
        title: item.title,
        trigger: item.trigger,
        provenance: item.provenance,
      })),
    },
    sevenDays: {
      title: actionPlan.sevenDays?.title,
      stopCondition: actionPlan.sevenDays?.stopCondition,
      successMetric: actionPlan.sevenDays?.successMetric,
      items: actionStageItems('sevenDays', actionPlan.sevenDays),
      triggeredItems: (actionPlan.sevenDays?.triggeredItems || []).map((item) => ({
        title: item.title,
        trigger: item.trigger,
        provenance: item.provenance,
      })),
    },
    stopGate: {
      title: actionPlan.stopGate?.title,
      stopCondition: actionPlan.stopGate?.stopCondition,
      successMetric: actionPlan.stopGate?.successMetric,
      items: actionStageItems('stopGate', actionPlan.stopGate),
      triggeredItems: (actionPlan.stopGate?.triggeredItems || []).map((item) => ({
        title: item.title,
        trigger: item.trigger,
        provenance: item.provenance,
      })),
    },
  };
}

function compactHypotheses(hypotheses = []) {
  return hypotheses.map((item) => ({
    id: item.id,
    title: item.title,
    statement: item.statement,
    status: item.status,
  }));
}

function buildCorePayload(canonicalResponse) {
  return {
    assumptions: {
      productType: canonicalResponse.assumptions?.productType,
      targetMarket: canonicalResponse.assumptions?.targetMarket,
      targetUser: canonicalResponse.assumptions?.targetUser,
      audienceStatus: 'inferred_hypothesis',
      painPoint: canonicalResponse.assumptions?.painPoint,
      businessModel: canonicalResponse.assumptions?.businessModel,
      acquisitionChannel: canonicalResponse.assumptions?.acquisitionChannel,
      acquisitionChannelDetail: canonicalResponse.assumptions?.acquisitionChannelDetail || null,
      platformForm: canonicalResponse.assumptions?.platformForm,
    },
    missingInfo: canonicalResponse.missingInfo || [],
    verdict: {
      level: canonicalResponse.verdict?.level,
      title: canonicalResponse.verdict?.title,
      nextMove: canonicalResponse.verdict?.nextMove,
      mainRisk: canonicalResponse.verdict?.mainRisk,
      reason: canonicalResponse.verdict?.reason,
    },
    firstPartyKnowledge: compactFirstPartyKnowledge(canonicalResponse.firstPartyKnowledge),
    hypotheses: compactHypotheses(canonicalResponse.hypotheses || []),
    actionPlan: compactActionPlan(canonicalResponse.actionPlan),
  };
}

function businessModelForCopy(value) {
  if (!value || value === '未明确') return '';
  return value === '订阅' ? '订阅制' : value;
}

function acquisitionForCopy(value) {
  if (!value) return '';
  return /[A-Za-z]/.test(value) ? `${value} 获客路径` : `${value}获客路径`;
}

function buildReportTeaser(corePayload) {
  const assumptions = corePayload.assumptions || {};
  const productType = assumptions.productType && assumptions.productType !== '未明确'
    ? assumptions.productType
    : '当前项目';
  const targetMarket = assumptions.targetMarket && assumptions.targetMarket !== '未明确'
    ? assumptions.targetMarket
    : '目标市场';
  const businessModel = businessModelForCopy(assumptions.businessModel);
  const acquisition = assumptions.acquisitionChannelDetail
    || (assumptions.acquisitionChannel && assumptions.acquisitionChannel !== '未明确' ? assumptions.acquisitionChannel : '');
  const focus = [
    businessModel,
    acquisitionForCopy(acquisition),
  ].filter(Boolean).join('与');

  if (focus) {
    return `本次预判聚焦于 ${productType}进入${targetMarket}市场时，${focus}是否值得继续验证。`;
  }
  return `本次预判聚焦于 ${productType}进入${targetMarket}市场时，核心进入假设是否值得继续验证。`;
}

function sameOrderedIds(left = [], right = []) {
  return left.length === right.length && left.every((item, index) => item?.id === right[index]?.id);
}

function validateInternalDraftAlignment(modelDraft, corePayload) {
  if (!sameOrderedIds(modelDraft?.hypothesesCopy || [], corePayload.hypotheses || [])) {
    return 'LLM draft hypotheses did not match canonical id order.';
  }

  for (const stage of ['twentyFourHours', 'sevenDays', 'stopGate']) {
    if (!sameOrderedIds(modelDraft?.actionPlanCopy?.[stage] || [], corePayload.actionPlan?.[stage]?.items || [])) {
      return `LLM draft action plan did not match canonical ${stage} id order.`;
    }
  }
  return null;
}

function assembleFinalDraft(modelDraft, corePayload) {
  const modelHypotheses = new Map((modelDraft.hypothesesCopy || []).map((item) => [item.id, item]));
  const actionPlanCopy = {};

  for (const stage of ['twentyFourHours', 'sevenDays', 'stopGate']) {
    const modelItems = new Map((modelDraft.actionPlanCopy?.[stage] || []).map((item) => [item.id, item]));
    actionPlanCopy[stage] = (corePayload.actionPlan?.[stage]?.items || []).map((item) => ({
      id: item.id,
      title: modelItems.get(item.id)?.title || '',
      copy: item.sourceText,
    }));
  }

  return {
    narrative: {
      reportTeaser: buildReportTeaser(corePayload),
      userFacingSummary: modelDraft.narrative?.userFacingSummary || '',
      verdictNarrative: modelDraft.narrative?.verdictNarrative || '',
    },
    hypothesesCopy: (corePayload.hypotheses || []).map((item) => ({
      id: item.id,
      title: item.title,
      description: item.statement,
      whyItMatters: modelHypotheses.get(item.id)?.whyItMatters || '',
    })),
    actionPlanCopy,
  };
}

function normalizeEndpointStyle(style) {
  return style === 'chat_completions' ? 'chat_completions' : 'responses';
}

export async function buildLlmDraftForAnalyze({ canonicalResponse, apiKey, model, baseUrl, endpointStyle, timeoutMs }) {
  if (!apiKey) return createEmptyLlmDraft('not_configured', { model: null });

  const selectedModel = model || 'gpt-4o-mini';
  const selectedBaseUrl = normalizeOpenAIBaseUrl(baseUrl);
  const selectedEndpointStyle = normalizeEndpointStyle(endpointStyle);
  const selectedTimeoutMs = normalizeOpenAITimeoutMs(timeoutMs);
  const corePayload = buildCorePayload(canonicalResponse);
  const draftClient = selectedEndpointStyle === 'chat_completions'
    ? callOpenAIChatCompletionsDraft
    : callOpenAIResponsesDraft;
  const startedAt = Date.now();
  const result = await draftClient({
    apiKey,
    baseUrl: selectedBaseUrl,
    model: selectedModel,
    systemPrompt: systemPrompt(),
    userPrompt: JSON.stringify({
      instruction: 'Write draft-only copy for the Analyze result. Do not modify or restate protected canonical fields outside the allowed schema.',
      corePayload,
    }),
    timeoutMs: selectedTimeoutMs,
  });
  const elapsedMs = Date.now() - startedAt;
  console.info(`HotPulse llmDraft endpoint=${selectedEndpointStyle} host=${openAIBaseUrlHost(selectedBaseUrl)} model=${selectedModel} timeoutMs=${selectedTimeoutMs} status=${result.status} elapsedMs=${elapsedMs}`);

  if (result.status !== 'success') {
    return createEmptyLlmDraft(result.status, { model: result.model || selectedModel, warnings: result.warnings || [] });
  }

  const alignmentWarning = validateInternalDraftAlignment(result.draft, corePayload);
  if (alignmentWarning) {
    return createEmptyLlmDraft('rejected', { model: result.model || selectedModel, warnings: [alignmentWarning] });
  }

  const finalDraft = assembleFinalDraft(result.draft, corePayload);
  const guarded = guardLlmDraft(finalDraft, corePayload);
  return {
    ...guarded,
    model: result.model || selectedModel,
  };
}
