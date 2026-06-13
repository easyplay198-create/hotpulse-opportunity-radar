import { LLM_DRAFT_OUTPUT_SCHEMA } from './llmDraftSchema.js';

const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_OPENAI_TIMEOUT_MS = 45000;
const MIN_OPENAI_TIMEOUT_MS = 5000;
const MAX_OPENAI_TIMEOUT_MS = 120000;

export function normalizeOpenAIBaseUrl(baseUrl) {
  return String(baseUrl || DEFAULT_OPENAI_BASE_URL).replace(/\/+$/, '');
}

export function openAIBaseUrlHost(baseUrl) {
  try {
    return new URL(normalizeOpenAIBaseUrl(baseUrl)).host;
  } catch {
    return 'invalid-host';
  }
}

export function normalizeOpenAITimeoutMs(timeoutMs) {
  if (timeoutMs === undefined || timeoutMs === null || timeoutMs === '') {
    return DEFAULT_OPENAI_TIMEOUT_MS;
  }

  const numeric = Number(timeoutMs);
  if (!Number.isFinite(numeric)) {
    return DEFAULT_OPENAI_TIMEOUT_MS;
  }

  const integer = Math.trunc(numeric);
  return Math.min(MAX_OPENAI_TIMEOUT_MS, Math.max(MIN_OPENAI_TIMEOUT_MS, integer));
}

function truncate(value, max = 300) {
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

export function sanitizeErrorText(value) {
  return truncate(String(value || '')
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, 'Bearer [redacted]')
    .replace(/sk-[A-Za-z0-9._~-]+/gi, '[redacted-key]')
    .replace(/[A-Za-z0-9._~-]{48,}/g, '[redacted-token]')
    .replace(/\s+/g, ' ')
    .trim());
}

export async function buildSafeHttpErrorWarning(response, label) {
  const bodyText = await response.text().catch(() => '');
  let type = '';
  let code = '';
  let message = '';

  if (bodyText) {
    try {
      const parsed = JSON.parse(bodyText);
      const error = parsed?.error && typeof parsed.error === 'object' ? parsed.error : parsed;
      type = sanitizeErrorText(error?.type || '');
      code = sanitizeErrorText(error?.code || '');
      message = sanitizeErrorText(error?.message || parsed?.message || '');
    } catch {
      message = sanitizeErrorText(bodyText);
    }
  }

  const meta = [
    type ? `type=${type}` : '',
    code ? `code=${code}` : '',
  ].filter(Boolean).join(' ');
  const warning = `${label} failed: HTTP ${response.status}${meta ? ` (${meta})` : ''}${message ? ` - ${message}` : ''}`;
  console.warn(warning);
  return warning;
}

export function buildSafeNetworkErrorWarning(error, label) {
  const message = sanitizeErrorText(error?.message || 'request failed');
  const causeCode = sanitizeErrorText(error?.cause?.code || '');
  const causeMessage = sanitizeErrorText(error?.cause?.message || '');
  const cause = [causeCode, causeMessage].filter(Boolean).join(' - ');
  return `${label} failed: ${message}${cause ? ` (${cause})` : ''}`;
}

function extractOutputText(payload) {
  if (typeof payload?.output_text === 'string') return { text: payload.output_text };

  for (const output of payload?.output || []) {
    for (const content of output?.content || []) {
      if (content?.type === 'refusal') return { refusal: content.refusal || 'refused' };
      if (content?.type === 'output_text' && typeof content.text === 'string') return { text: content.text };
    }
  }

  return { text: '' };
}

export async function callOpenAIResponsesDraft({
  apiKey,
  baseUrl = DEFAULT_OPENAI_BASE_URL,
  model = 'gpt-4o-mini',
  systemPrompt,
  userPrompt,
  timeoutMs = DEFAULT_OPENAI_TIMEOUT_MS,
}) {
  if (!apiKey) {
    return { status: 'not_configured', model: null, draft: null, warnings: [] };
  }

  const selectedTimeoutMs = normalizeOpenAITimeoutMs(timeoutMs);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), selectedTimeoutMs);
  const requestUrl = `${normalizeOpenAIBaseUrl(baseUrl)}/responses`;

  try {
    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        input: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'hotpulse_llm_draft',
            schema: LLM_DRAFT_OUTPUT_SCHEMA,
            strict: true,
          },
        },
      }),
    });

    if (!response.ok) {
      const warning = await buildSafeHttpErrorWarning(response, 'OpenAI Responses draft request');
      return { status: 'error', model, draft: null, warnings: [warning] };
    }

    const payload = await response.json();
    const extracted = extractOutputText(payload);
    if (extracted.refusal) {
      return { status: 'refused', model: payload.model || model, draft: null, warnings: ['OpenAI refused the draft request.'] };
    }

    if (!extracted.text) {
      return { status: 'malformed', model: payload.model || model, draft: null, warnings: ['OpenAI response did not include structured output text.'] };
    }

    try {
      return {
        status: 'success',
        model: payload.model || model,
        draft: JSON.parse(extracted.text),
        warnings: [],
      };
    } catch {
      return { status: 'malformed', model: payload.model || model, draft: null, warnings: ['OpenAI structured output could not be parsed as JSON.'] };
    }
  } catch (error) {
    if (error?.name === 'AbortError') {
      return {
        status: 'timeout',
        model,
        draft: null,
        warnings: [`Responses draft request timed out after ${selectedTimeoutMs}ms.`],
      };
    }
    const warning = buildSafeNetworkErrorWarning(error, 'OpenAI Responses draft request');
    console.warn(warning);
    return { status: 'error', model, draft: null, warnings: [warning] };
  } finally {
    clearTimeout(timeout);
  }
}
