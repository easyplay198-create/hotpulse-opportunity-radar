import { LLM_DRAFT_SCHEMA_VERSION, PROTECTED_LLM_KEYS } from './llmDraftSchema.js';

const URL_PATTERN = /(https?:\/\/|www\.|[\w-]+\.(?:com|ai|io|co|net|org)\b)/i;
const DIRECT_PUSH_PATTERN = /(建议直接进入|可以立即上线|强烈建议推进|go now|validate now)/i;
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
    && action
    && Array.isArray(action.twentyFourHours)
    && Array.isArray(action.sevenDays)
    && Array.isArray(action.stopGate)
  );
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

export function guardLlmDraft(rawDraft, canonicalPayload) {
  if (!hasDraftShape(rawDraft)) {
    return createEmptyLlmDraft('malformed', { warnings: ['LLM draft did not match the expected namespace shape.'] });
  }

  const protectedHits = hasProtectedKeys(rawDraft);
  if (protectedHits.length > 0) {
    return createEmptyLlmDraft('rejected', { warnings: [`LLM draft attempted to write protected keys: ${protectedHits.join(', ')}`] });
  }

  const text = collectStrings(rawDraft).join('\n');
  if (URL_PATTERN.test(text)) {
    return createEmptyLlmDraft('rejected', { warnings: ['LLM draft included URL-like or citation-like content.'] });
  }

  const verdictLevel = canonicalPayload?.verdict?.level || canonicalPayload?.verdict?.code;
  if (['stop', 'hold', 'insufficient'].includes(verdictLevel) && DIRECT_PUSH_PATTERN.test(rawDraft.narrative.verdictNarrative)) {
    return createEmptyLlmDraft('rejected', { warnings: ['LLM draft contradicted the canonical verdict.'] });
  }

  const targetMarket = canonicalPayload?.assumptions?.targetMarket;
  if (targetMarket && mentionsDifferentMarket(text, targetMarket)) {
    return createEmptyLlmDraft('rejected', { warnings: ['LLM draft changed or confused the target market.'] });
  }

  const unsupportedNumbers = findUnsupportedNumbers(rawDraft, canonicalPayload);
  if (unsupportedNumbers.length > 0) {
    return createEmptyLlmDraft('rejected', { warnings: [`LLM draft introduced unsupported numbers: ${unsupportedNumbers.join(', ')}`] });
  }

  return {
    status: 'success',
    source: 'llm_draft',
    model: null,
    schemaVersion: LLM_DRAFT_SCHEMA_VERSION,
    narrative: rawDraft.narrative,
    hypothesesCopy: rawDraft.hypothesesCopy,
    actionPlanCopy: rawDraft.actionPlanCopy,
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
