export const LLM_DRAFT_SCHEMA_VERSION = '2026-06-12';

export const PROTECTED_LLM_KEYS = [
  'firstPartyKnowledge',
  'provenance',
  'evidenceStrength',
  'confidence',
  'blocked',
  'targetMarket',
  'verdict',
  'sourceUrl',
  'citation',
  'evidenceUrl',
];

const copyItemSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'title'],
  properties: {
    id: { type: 'string', pattern: '^(twentyFourHours|sevenDays|stopGate)-\\d+$' },
    title: { type: 'string' },
  },
};

export const LLM_DRAFT_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['narrative', 'hypothesesCopy', 'actionPlanCopy'],
  properties: {
    narrative: {
      type: 'object',
      additionalProperties: false,
      required: ['verdictNarrative', 'userFacingSummary'],
      properties: {
        verdictNarrative: { type: 'string' },
        userFacingSummary: { type: 'string' },
      },
    },
    hypothesesCopy: {
      type: 'array',
      maxItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'whyItMatters'],
        properties: {
          id: { type: 'string', enum: ['demand', 'payment', 'channel'] },
          whyItMatters: { type: 'string' },
        },
      },
    },
    actionPlanCopy: {
      type: 'object',
      additionalProperties: false,
      required: ['twentyFourHours', 'sevenDays', 'stopGate'],
      properties: {
        twentyFourHours: {
          type: 'array',
          maxItems: 6,
          items: copyItemSchema,
        },
        sevenDays: {
          type: 'array',
          maxItems: 6,
          items: copyItemSchema,
        },
        stopGate: {
          type: 'array',
          maxItems: 6,
          items: copyItemSchema,
        },
      },
    },
  },
};
