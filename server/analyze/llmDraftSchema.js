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
  required: ['title', 'copy'],
  properties: {
    title: { type: 'string' },
    copy: { type: 'string' },
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
      required: ['verdictNarrative', 'reportTeaser', 'userFacingSummary'],
      properties: {
        verdictNarrative: { type: 'string' },
        reportTeaser: { type: 'string' },
        userFacingSummary: { type: 'string' },
      },
    },
    hypothesesCopy: {
      type: 'array',
      maxItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'description', 'whyItMatters'],
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
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
          maxItems: 4,
          items: copyItemSchema,
        },
        sevenDays: {
          type: 'array',
          maxItems: 4,
          items: copyItemSchema,
        },
        stopGate: {
          type: 'array',
          maxItems: 4,
          items: copyItemSchema,
        },
      },
    },
  },
};
