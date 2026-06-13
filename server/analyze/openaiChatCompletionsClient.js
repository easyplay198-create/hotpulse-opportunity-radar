import { LLM_DRAFT_OUTPUT_SCHEMA } from './llmDraftSchema.js';
import {
  buildSafeHttpErrorWarning,
  buildSafeNetworkErrorWarning,
  normalizeOpenAIBaseUrl,
  normalizeOpenAITimeoutMs,
} from './openaiResponsesClient.js';

function extractMessageContent(payload) {
  const message = payload?.choices?.[0]?.message;
  if (message?.refusal) return { refusal: message.refusal };
  if (typeof message?.content === 'string') return { text: message.content };
  if (Array.isArray(message?.content)) {
    const text = message.content
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .filter(Boolean)
      .join('');
    return { text };
  }
  return { text: '' };
}

export async function callOpenAIChatCompletionsDraft({
  apiKey,
  baseUrl,
  model = 'gpt-4o-mini',
  systemPrompt,
  userPrompt,
  timeoutMs,
}) {
  if (!apiKey) {
    return { status: 'not_configured', model: null, draft: null, warnings: [] };
  }

  const selectedTimeoutMs = normalizeOpenAITimeoutMs(timeoutMs);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), selectedTimeoutMs);
  const requestUrl = `${normalizeOpenAIBaseUrl(baseUrl)}/chat/completions`;

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
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'hotpulse_llm_draft',
            strict: true,
            schema: LLM_DRAFT_OUTPUT_SCHEMA,
          },
        },
      }),
    });

    if (!response.ok) {
      const warning = await buildSafeHttpErrorWarning(response, 'Chat Completions draft request');
      return { status: 'error', model, draft: null, warnings: [warning] };
    }

    const payload = await response.json();
    const extracted = extractMessageContent(payload);
    if (extracted.refusal) {
      return { status: 'refused', model: payload.model || model, draft: null, warnings: ['Chat Completions refused the draft request.'] };
    }

    if (!extracted.text) {
      return { status: 'malformed', model: payload.model || model, draft: null, warnings: ['Chat Completions response did not include structured output text.'] };
    }

    try {
      return {
        status: 'success',
        model: payload.model || model,
        draft: JSON.parse(extracted.text),
        warnings: [],
      };
    } catch {
      return { status: 'malformed', model: payload.model || model, draft: null, warnings: ['Chat Completions structured output could not be parsed as JSON.'] };
    }
  } catch (error) {
    if (error?.name === 'AbortError') {
      return {
        status: 'timeout',
        model,
        draft: null,
        warnings: [`Chat Completions draft request timed out after ${selectedTimeoutMs}ms.`],
      };
    }
    const warning = buildSafeNetworkErrorWarning(error, 'Chat Completions draft request');
    console.warn(warning);
    return { status: 'error', model, draft: null, warnings: [warning] };
  } finally {
    clearTimeout(timeout);
  }
}
