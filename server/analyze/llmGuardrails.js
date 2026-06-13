import { LLM_DRAFT_SCHEMA_VERSION, PROTECTED_LLM_KEYS } from './llmDraftSchema.js';

const URL_PATTERN = /(https?:\/\/|www\.|[\w-]+\.(?:com|ai|io|co|net|org)\b)/i;
const DIRECT_PUSH_PATTERN = /(建议直接进入|可以立即上线|强烈建议推进|go now|validate now)/i;
const UNKNOWN_CHANNEL_PATTERN = /(未明确|渠道未知|尚未确定渠道|待补充渠道)/;
const INFERRED_AUDIENCE_PATTERN = /(初步假设|暂定目标用户|待验证目标用户|可能存在需求|仍需验证|待验证|可能)/;
const CONFIRMED_AUDIENCE_PATTERN = /(对该痛点有明确需求|就是目标用户|已确认有需求|确定愿意使用)/;
const ENGINEERING_TERMS_PATTERN = /\b(mock|fallback|API|schema)\b|数据源切换/i;
const EVIDENCE_GAP_PATTERN = /(证据不足|证据仍不足|证据不充分|缺少真实验证|真实验证数据不足|信息和证据还不够)/;
const ENTRY_DECISION_PATTERN = /((不能|不可|无法).{0,10}(真实)?进入(决策|结论))|不能作为真实进入结论|不可直接作为进入决策/;
const VALIDATION_STAGE_PATTERN = /(低成本验证|预验证|真实验证数据|真实访谈|小样本验证)/;
const CONTROLLED_TERMS = [
  'YouTube Shorts',
  'TikTok',
  '小红书',
  'Product Hunt',
  'App Store',
  'Google Play',
  'Stripe',
  'IAP',
  '日本',
  '东南亚',
  '美国',
  '欧美',
  '欧洲',
];
const MARKET_TERMS = {
  日本: ['东南亚', 'SEA', 'Southeast Asia', '美国', '欧美', '欧洲'],
  东南亚: ['日本', 'Japan', '美国', '欧美', '欧洲'],
  美国: ['日本', '东南亚', 'SEA'],
};

export function createEmptyLlmDraft(status, { model = null, warnings = [] } = {}) {
  return {
    status,
    source: 'llm_draft',
    model,
    schemaVersion: LLM_DRAFT_SCHEMA_VERSION,
    narrative: {
      verdictNarrative: '',
      reportTeaser: '',
      userFacingSummary: '',
    },
    hypothesesCopy: [],
    actionPlanCopy: {
      twentyFourHours: [],
      sevenDays: [],
      stopGate: [],
    },
    warnings,
  };
}

function walkObject(value, visitor, path = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkObject(item, visitor, [...path, String(index)]));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    visitor(key, child, path);
    walkObject(child, visitor, [...path, key]);
  }
}

function collectStrings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => collectStrings(item, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((item) => collectStrings(item, out));
  return out;
}

function hasProtectedKeys(value) {
  const protectedSet = new Set(PROTECTED_LLM_KEYS.map((key) => key.toLowerCase()));
  const hits = [];
  walkObject(value, (key) => {
    if (protectedSet.has(key.toLowerCase())) hits.push(key);
  });
  return hits;
}

function hasCopyItemShape(item) {
  return Boolean(
    item
    && typeof item.id === 'string'
    && typeof item.title === 'string'
    && typeof item.copy === 'string',
  );
}

function hasHypothesisCopyShape(item) {
  return Boolean(
    item
    && typeof item.id === 'string'
    && typeof item.title === 'string'
    && typeof item.description === 'string'
    && typeof item.whyItMatters === 'string',
  );
}

function hasDraftShape(value) {
  if (!value || typeof value !== 'object') return false;
  const narrative = value.narrative;
  const action = value.actionPlanCopy;
  return Boolean(
    narrative
    && typeof narrative.verdictNarrative === 'string'
    && typeof narrative.reportTeaser === 'string'
    && typeof narrative.userFacingSummary === 'string'
    && Array.isArray(value.hypothesesCopy)
    && value.hypothesesCopy.every(hasHypothesisCopyShape)
    && action
    && Array.isArray(action.twentyFourHours)
    && action.twentyFourHours.every(hasCopyItemShape)
    && Array.isArray(action.sevenDays)
    && action.sevenDays.every(hasCopyItemShape)
    && Array.isArray(action.stopGate)
    && action.stopGate.every(hasCopyItemShape)
  );
}

function normalizeVisibleText(value) {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/([\u3400-\u9fff])\s+([\u3400-\u9fff])/g, '$1$2')
    .replace(/\s+([，。！？；：、,.!?;:])/g, '$1')
    .replace(/([，。！？；：、])\s+/g, '$1')
    .replace(/([。！？；：、,.!?;:])\1+/g, '$1');
}

function normalizeDraftStrings(value, key = '') {
  if (typeof value === 'string') {
    return key === 'id' ? value : normalizeVisibleText(value);
  }
  if (Array.isArray(value)) return value.map((item) => normalizeDraftStrings(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [
      childKey,
      normalizeDraftStrings(childValue, childKey),
    ]));
  }
  return value;
}

function findUnsupportedNumbers(draft, canonical) {
  const draftNumbers = new Set(collectStrings(draft).join(' ').match(/\d+(?:\.\d+)?%?|\$\d+(?:-\$?\d+)?/g) || []);
  if (draftNumbers.size === 0) return [];
  const canonicalNumbers = new Set(JSON.stringify(canonical || {}).match(/\d+(?:\.\d+)?%?|\$\d+(?:-\$?\d+)?/g) || []);
  return [...draftNumbers].filter((item) => !canonicalNumbers.has(item));
}

function mentionsDifferentMarket(text, targetMarket) {
  const terms = MARKET_TERMS[targetMarket] || [];
  return terms.some((term) => new RegExp(term, 'i').test(text));
}

function idsFor(items = []) {
  return items.map((item) => item.id);
}

function sameOrderedIds(left = [], right = []) {
  const leftIds = idsFor(left);
  const rightIds = idsFor(right);
  return leftIds.length === rightIds.length && leftIds.every((id, index) => id === rightIds[index]);
}

function validateHypothesesAlignment(draft, canonicalPayload) {
  const canonicalHypotheses = canonicalPayload?.hypotheses || [];
  if (!sameOrderedIds(draft.hypothesesCopy, canonicalHypotheses)) {
    return 'LLM draft hypotheses did not match canonical id order.';
  }
  return null;
}

function validateActionPlanAlignment(draft, canonicalPayload) {
  const stages = ['twentyFourHours', 'sevenDays', 'stopGate'];
  for (const stage of stages) {
    const draftItems = draft.actionPlanCopy?.[stage] || [];
    const canonicalItems = canonicalPayload?.actionPlan?.[stage]?.items || [];
    if (!sameOrderedIds(draftItems, canonicalItems)) {
      return `LLM draft action plan did not match canonical ${stage} id order.`;
    }
  }
  return null;
}

function validateNonEmptyCopyFields(draft) {
  for (const item of draft.hypothesesCopy || []) {
    if (!item.whyItMatters.trim()) return 'LLM draft hypothesis whyItMatters was empty.';
  }

  for (const stage of ['twentyFourHours', 'sevenDays', 'stopGate']) {
    const items = draft.actionPlanCopy?.[stage] || [];
    if (items.some((item) => !item.title.trim())) {
      return `LLM draft ${stage} action title was empty.`;
    }
    if (items.length > 1 && items.every((item) => item.title === items[0].title)) {
      return `LLM draft ${stage} action titles were all identical.`;
    }
  }
  return null;
}

function validateActionCopyOwnership(draft, canonicalPayload) {
  for (const stage of ['twentyFourHours', 'sevenDays', 'stopGate']) {
    const draftItems = draft.actionPlanCopy?.[stage] || [];
    const canonicalItems = canonicalPayload?.actionPlan?.[stage]?.items || [];
    for (let index = 0; index < canonicalItems.length; index += 1) {
      const expected = normalizeVisibleText(canonicalItems[index]?.sourceText || '');
      if (draftItems[index]?.copy !== expected) {
        return `LLM draft ${stage} action copy changed canonical source text.`;
      }
    }
  }
  return null;
}

function validateChannelCopy(draft, canonicalPayload) {
  const detail = canonicalPayload?.assumptions?.acquisitionChannelDetail;
  if (!detail) return null;

  const channelCopy = draft.hypothesesCopy.find((item) => item.id === 'channel');
  if (!channelCopy) return 'LLM draft channel hypothesis was missing.';

  const channelText = [channelCopy.title, channelCopy.description, channelCopy.whyItMatters].join(' ');
  if (!channelText.includes(detail)) {
    return 'LLM draft channel hypothesis lost the known acquisition channel detail.';
  }
  if (UNKNOWN_CHANNEL_PATTERN.test(channelText)) {
    return 'LLM draft channel hypothesis marked a known acquisition channel as unknown.';
  }
  return null;
}

function validateReportTeaser(draft, canonicalPayload) {
  const teaser = draft.narrative?.reportTeaser || '';
  const assumptions = canonicalPayload?.assumptions || {};
  const expectedTerms = [
    assumptions.targetMarket && assumptions.targetMarket !== '未明确' ? assumptions.targetMarket : '',
    assumptions.businessModel && assumptions.businessModel !== '未明确' ? assumptions.businessModel : '',
    assumptions.acquisitionChannelDetail || '',
  ].filter(Boolean);
  const missing = expectedTerms.filter((term) => !teaser.includes(term));
  if (missing.length > 0) {
    return `Deterministic reportTeaser missed known fields: ${missing.join(', ')}`;
  }
  return null;
}

function validateInferredAudienceCopy(draft, canonicalPayload) {
  if (canonicalPayload?.assumptions?.audienceStatus !== 'inferred_hypothesis') return null;

  const demandCopy = draft.hypothesesCopy.find((item) => item.id === 'demand');
  if (!demandCopy) return 'Inferred audience was written as a confirmed fact.';

  const demandText = [demandCopy.title, demandCopy.description, demandCopy.whyItMatters].join(' ');
  if (!INFERRED_AUDIENCE_PATTERN.test(demandText) || CONFIRMED_AUDIENCE_PATTERN.test(demandText)) {
    return 'Inferred audience was written as a confirmed fact.';
  }
  return null;
}

function numbersInText(value) {
  return String(value || '').match(/\d+(?:\.\d+)?%?|\$\d+(?:-\$?\d+)?/g) || [];
}

function validateStopGateNumbers(draft, canonicalPayload) {
  const draftItems = draft.actionPlanCopy?.stopGate || [];
  const canonicalItems = canonicalPayload?.actionPlan?.stopGate?.items || [];
  for (let index = 0; index < canonicalItems.length; index += 1) {
    const requiredNumbers = numbersInText(canonicalItems[index]?.sourceText || canonicalItems[index]?.title);
    if (requiredNumbers.length === 0) continue;
    const draftText = `${draftItems[index]?.title || ''} ${draftItems[index]?.copy || ''}`;
    const missing = requiredNumbers.filter((number) => !draftText.includes(number));
    if (missing.length > 0) {
      return `LLM draft stopGate copy omitted canonical threshold numbers: ${missing.join(', ')}`;
    }
  }
  return null;
}

function validateNarrativeOwnership(draft) {
  const text = [
    draft.narrative?.reportTeaser || '',
    draft.narrative?.userFacingSummary || '',
    draft.narrative?.verdictNarrative || '',
  ].join(' ');
  if (ENGINEERING_TERMS_PATTERN.test(text)) {
    return 'LLM draft included engineering-only terms in user-facing copy.';
  }

  const verdictNarrative = draft.narrative?.verdictNarrative || '';
  if (!EVIDENCE_GAP_PATTERN.test(verdictNarrative)
    || !ENTRY_DECISION_PATTERN.test(verdictNarrative)
    || !VALIDATION_STAGE_PATTERN.test(verdictNarrative)) {
    return 'LLM draft verdict narrative did not preserve evidence and decision limits.';
  }
  return null;
}

function validateControlledTerms(draft, canonicalPayload) {
  const draftText = collectStrings(draft).join(' ');
  const canonicalText = JSON.stringify(canonicalPayload || {});
  const unsupported = CONTROLLED_TERMS.filter((term) => draftText.includes(term) && !canonicalText.includes(term));
  if (unsupported.length > 0) {
    return `LLM draft introduced unsupported controlled terms: ${unsupported.join(', ')}`;
  }
  return null;
}

export function guardLlmDraft(rawDraft, canonicalPayload) {
  const normalizedDraft = normalizeDraftStrings(rawDraft);

  if (!hasDraftShape(normalizedDraft)) {
    return createEmptyLlmDraft('malformed', { warnings: ['LLM draft did not match the expected namespace shape.'] });
  }

  const protectedHits = hasProtectedKeys(normalizedDraft);
  if (protectedHits.length > 0) {
    return createEmptyLlmDraft('rejected', { warnings: [`LLM draft attempted to write protected keys: ${protectedHits.join(', ')}`] });
  }

  const hypothesesAlignmentWarning = validateHypothesesAlignment(normalizedDraft, canonicalPayload);
  if (hypothesesAlignmentWarning) {
    return createEmptyLlmDraft('rejected', { warnings: [hypothesesAlignmentWarning] });
  }

  const actionPlanAlignmentWarning = validateActionPlanAlignment(normalizedDraft, canonicalPayload);
  if (actionPlanAlignmentWarning) {
    return createEmptyLlmDraft('rejected', { warnings: [actionPlanAlignmentWarning] });
  }

  const nonEmptyWarning = validateNonEmptyCopyFields(normalizedDraft);
  if (nonEmptyWarning) {
    return createEmptyLlmDraft('rejected', { warnings: [nonEmptyWarning] });
  }

  const actionCopyWarning = validateActionCopyOwnership(normalizedDraft, canonicalPayload);
  if (actionCopyWarning) {
    return createEmptyLlmDraft('rejected', { warnings: [actionCopyWarning] });
  }

  const channelWarning = validateChannelCopy(normalizedDraft, canonicalPayload);
  if (channelWarning) {
    return createEmptyLlmDraft('rejected', { warnings: [channelWarning] });
  }

  const reportTeaserWarning = validateReportTeaser(normalizedDraft, canonicalPayload);
  if (reportTeaserWarning) {
    return createEmptyLlmDraft('rejected', { warnings: [reportTeaserWarning] });
  }

  const inferredAudienceWarning = validateInferredAudienceCopy(normalizedDraft, canonicalPayload);
  if (inferredAudienceWarning) {
    return createEmptyLlmDraft('rejected', { warnings: [inferredAudienceWarning] });
  }

  const stopGateNumbersWarning = validateStopGateNumbers(normalizedDraft, canonicalPayload);
  if (stopGateNumbersWarning) {
    return createEmptyLlmDraft('rejected', { warnings: [stopGateNumbersWarning] });
  }

  const narrativeWarning = validateNarrativeOwnership(normalizedDraft);
  if (narrativeWarning) {
    return createEmptyLlmDraft('rejected', { warnings: [narrativeWarning] });
  }

  const controlledTermsWarning = validateControlledTerms(normalizedDraft, canonicalPayload);
  if (controlledTermsWarning) {
    return createEmptyLlmDraft('rejected', { warnings: [controlledTermsWarning] });
  }

  const text = collectStrings(normalizedDraft).join('\n');
  if (URL_PATTERN.test(text)) {
    return createEmptyLlmDraft('rejected', { warnings: ['LLM draft included URL-like or citation-like content.'] });
  }

  const verdictLevel = canonicalPayload?.verdict?.level || canonicalPayload?.verdict?.code;
  if (['stop', 'hold', 'insufficient'].includes(verdictLevel) && DIRECT_PUSH_PATTERN.test(normalizedDraft.narrative.verdictNarrative)) {
    return createEmptyLlmDraft('rejected', { warnings: ['LLM draft contradicted the canonical verdict.'] });
  }

  const targetMarket = canonicalPayload?.assumptions?.targetMarket;
  if (targetMarket && mentionsDifferentMarket(text, targetMarket)) {
    return createEmptyLlmDraft('rejected', { warnings: ['LLM draft changed or confused the target market.'] });
  }

  const unsupportedNumbers = findUnsupportedNumbers(normalizedDraft, canonicalPayload);
  if (unsupportedNumbers.length > 0) {
    return createEmptyLlmDraft('rejected', { warnings: [`LLM draft introduced unsupported numbers: ${unsupportedNumbers.join(', ')}`] });
  }

  return {
    status: 'success',
    source: 'llm_draft',
    model: null,
    schemaVersion: LLM_DRAFT_SCHEMA_VERSION,
    narrative: normalizedDraft.narrative,
    hypothesesCopy: normalizedDraft.hypothesesCopy,
    actionPlanCopy: normalizedDraft.actionPlanCopy,
    warnings: [],
  };
}

export function createCanonicalInvariantSnapshot(response) {
  const triggeredItems = [
    ...(response?.actionPlan?.twentyFourHours?.triggeredItems || []),
    ...(response?.actionPlan?.sevenDays?.triggeredItems || []),
    ...(response?.actionPlan?.stopGate?.triggeredItems || []),
  ].map((item) => ({ trigger: item.trigger, provenance: item.provenance }));

  return {
    assumptions: response?.assumptions,
    targetMarket: response?.assumptions?.targetMarket,
    firstPartyKnowledge: response?.firstPartyKnowledge,
    verdictLevel: response?.judgment?.verdict?.level || response?.verdict?.level,
    verdictConfidence: response?.judgment?.verdict?.confidence || response?.verdict?.confidence,
    evidence: (response?.evidence || []).map((item) => ({
      title: item.title,
      sourceType: item.sourceType,
      strength: item.strength,
      url: item.url || null,
      provenance: item.metadata?.provenance || null,
    })),
    actionPlanTriggers: triggeredItems,
  };
}

export function canonicalSnapshotsEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}
