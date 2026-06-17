export const STREAM_EVENTS = {
  PROGRESS: 'progress',
  PROVIDER: 'provider',
  DONE: 'done',
  ERROR: 'error',
};

export const STREAM_STAGES = {
  INPUT_RECEIVED: 'input_received',
  BRIEF_PARSED: 'brief_parsed',
  CONDITIONS_CHECKED: 'conditions_checked',
  PROVIDERS_STARTED: 'providers_started',
  EVIDENCE_NORMALIZED: 'evidence_normalized',
  CANONICAL_JUDGMENT: 'canonical_judgment',
  EXPLANATION_GENERATION: 'explanation_generation',
  REPORT_ASSEMBLED: 'report_assembled',
};

function safeText(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function sanitizeSecrets(value) {
  return value
    .replace(/sk-[A-Za-z0-9_\-]{10,}/g, '[redacted-key]')
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, 'Bearer [redacted]')
    .replace(/Authorization\s*[:=]\s*[^\s,;]+/gi, 'Authorization=[redacted]')
    .replace(/api[_-]?key\s*[:=]\s*[^\s,;]+/gi, 'api_key=[redacted]')
    .replace(/token=([^&\s]+)/gi, 'token=[redacted]');
}

export function summarizeProviderError(error) {
  const text = safeText(error, '').trim();
  if (!text) return 'provider failed';
  const sanitized = sanitizeSecrets(text);
  if (/token|not configured/i.test(sanitized)) return 'provider not configured';
  if (/timeout|timed out/i.test(sanitized)) return 'provider timeout';
  if (/rate limit/i.test(sanitized)) return 'provider rate limited';
  return sanitized.slice(0, 120);
}
