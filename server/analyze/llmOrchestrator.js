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

function compactActionPlan(actionPlan = {}) {
  return {
    twentyFourHours: {
      title: actionPlan.twentyFourHours?.title,
      steps: actionPlan.twentyFourHours?.steps || [],
      triggeredItems: (actionPlan.twentyFourHours?.triggeredItems || []).map((item) => ({
        title: item.title,
        trigger: item.trigger,
        provenance: item.provenance,
      })),
    },
    sevenDays: {
      title: actionPlan.sevenDays?.title,
      steps: actionPlan.sevenDays?.steps || [],
      triggeredItems: (actionPlan.sevenDays?.triggeredItems || []).map((item) => ({
        title: item.title,
        trigger: item.trigger,
        provenance: item.provenance,
      })),
    },
    stopGate: {
      title: actionPlan.stopGate?.title,
      steps: actionPlan.stopGate?.steps || [],
      triggeredItems: (actionPlan.stopGate?.triggeredItems || []).map((item) => ({
        title: item.title,
        trigger: item.trigger,
        provenance: item.provenance,
      })),
    },
  };
}

function buildCorePayload(canonicalResponse) {
  return {
    assumptions: {
      productType: canonicalResponse.assumptions?.productType,
      targetMarket: canonicalResponse.assumptions?.targetMarket,
      targetUser: canonicalResponse.assumptions?.targetUser,
      painPoint: canonicalResponse.assumptions?.painPoint,
      businessModel: canonicalResponse.assumptions?.businessModel,
      acquisitionChannel: canonicalResponse.assumptions?.acquisitionChannel,
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
    hypotheses: canonicalResponse.hypotheses || [],
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
