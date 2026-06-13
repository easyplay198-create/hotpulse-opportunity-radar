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
    '如果 corePayload.assumptions.acquisitionChannelDetail 已知，channel 假设文案必须原样包含该具体渠道。',
    'unknown 只能表示信息确实未知，不能覆盖已知字段。',
    '不要新增受众、渠道、国家、平台、数字和风险。',
    'hypothesesCopy 必须与 corePayload.hypotheses 的 id、数量和顺序完全一致。',
    'actionPlanCopy 必须与 corePayload.actionPlan 各阶段 items 的 id、数量和顺序完全一致。',
    'Action Plan 只能转写现有动作，不能改变动作含义、数字或停止门槛。',
    '同一阶段内 action title 必须表达各自任务目的，不得全部相同。',
    '如果 audienceStatus 是 inferred_hypothesis，demand hypothesis 必须写成初步假设、暂定目标用户、待验证目标用户、可能存在需求或仍需验证。',
    '如果 audienceStatus 是 inferred_hypothesis，不得写成“对该痛点有明确需求”“就是目标用户”“已确认有需求”或“确定愿意使用”。',
    'reportTeaser 只概括本次项目和本轮验证重点，必须优先使用 targetMarket、businessModel、acquisitionChannelDetail 等已知结构化字段。',
    'reportTeaser 不要写成“关注市场潜力和商业模式可行性”这类泛化句。',
    'userFacingSummary 只说明已经明确什么、仍缺什么、接下来最需要补什么证据，不要重复 verdict。',
    'verdictNarrative 只说明当前能不能做进入决策、为什么、建议停留在哪个验证阶段。',
    'verdictNarrative 必须保留证据不足、不能作为真实进入结论、需要补真实验证数据的含义。',
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

  const guarded = guardLlmDraft(result.draft, corePayload);
  return {
    ...guarded,
    model: result.model || selectedModel,
  };
}
