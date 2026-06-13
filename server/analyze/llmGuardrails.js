import { LLM_DRAFT_SCHEMA_VERSION, PROTECTED_LLM_KEYS } from './llmDraftSchema.js';

const URL_PATTERN = /(https?:\/\/|www\.|[\w-]+\.(?:com|ai|io|co|net|org)\b)/i;
const DIRECT_PUSH_PATTERN = /(建议直接进入|可以立即上线|强烈建议推进|go now|validate now)/i;
const UNKNOWN_CHANNEL_PATTERN = /(未明确|渠道未知|尚未确定渠道|待补充渠道)/;
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
    .replace(/\s+([，。！？；：、,.!?;:])/g, '$1');
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

  const channelWarning = validateChannelCopy(normalizedDraft, canonicalPayload);
  if (channelWarning) {
    return createEmptyLlmDraft('rejected', { warnings: [channelWarning] });
  }

  const stopGateNumbersWarning = validateStopGateNumbers(normalizedDraft, canonicalPayload);
  if (stopGateNumbersWarning) {
    return createEmptyLlmDraft('rejected', { warnings: [stopGateNumbersWarning] });
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
