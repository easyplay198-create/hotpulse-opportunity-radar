import { LLM_DRAFT_OUTPUT_SCHEMA } from './llmDraftSchema.js';

const RESPONSES_URL = 'https://api.openai.com/v1/responses';

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
  model = 'gpt-4o-mini',
  systemPrompt,
  userPrompt,
  timeoutMs = 15000,
}) {
  if (!apiKey) {
    return { status: 'not_configured', model: null, draft: null, warnings: [] };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(RESPONSES_URL, {
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
      return { status: 'error', model, draft: null, warnings: [`OpenAI Responses API returned ${response.status}`] };
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
      return { status: 'timeout', model, draft: null, warnings: ['OpenAI draft request timed out.'] };
    }
    return { status: 'error', model, draft: null, warnings: ['OpenAI draft request failed.'] };
  } finally {
    clearTimeout(timeout);
  }
}
