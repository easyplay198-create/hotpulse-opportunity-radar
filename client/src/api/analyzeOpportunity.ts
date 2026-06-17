import type { AnalyzeRequest, AnalyzeResponse } from '../types/analyze';
import type { AnalyzeDoneEvent, AnalyzeErrorEvent, AnalyzeProgressEvent, AnalyzeProviderEvent } from '../types/analyzeStream';

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function normalizeAnalyzeResponse(raw: unknown): AnalyzeResponse {
  const data = (raw && typeof raw === 'object' ? raw : {}) as Partial<AnalyzeResponse> & Record<string, unknown>;
  const recommendation = data.recommendation && typeof data.recommendation === 'object' ? data.recommendation as AnalyzeResponse['recommendation'] : {
    title: '分析完成',
    verdict: '持续观察' as const,
    matchScore: 0,
    targetMarket: '未明确',
    evidenceStrength: 'low' as const,
    summary: '当前结果缺少足够信息。',
    nextStep: '请继续补充输入后重试。',
  };
  const relevanceScoresRaw = data.relevanceScores && typeof data.relevanceScores === 'object' ? (data.relevanceScores as unknown) : null;

  const passthrough = {
    mode: data.mode,
    input: data.input,
    assumptions: data.assumptions,
    missingInfo: data.missingInfo,
    verdict: data.verdict,
    hypotheses: data.hypotheses,
    evidence: data.evidence,
    actionPlan: data.actionPlan,
    firstPartyKnowledge: data.firstPartyKnowledge,
    judgment: data.judgment,
  };

  return {
    version: typeof data.version === 'string' ? data.version : '2.0',
    analysisId: typeof data.analysisId === 'string' ? data.analysisId : `analysis-${Date.now()}`,
    source: data.source === 'real' || data.source === 'fallback' ? data.source : 'mock',
    generatedAt: typeof data.generatedAt === 'string' ? data.generatedAt : new Date().toISOString(),
    steps: asArray(data.steps),
    parsedIntent: data.parsedIntent && typeof data.parsedIntent === 'object' ? data.parsedIntent as AnalyzeResponse['parsedIntent'] : undefined,
    clarifyingQuestions: asArray(data.clarifyingQuestions),
    evidenceGaps: asArray<string>(data.evidenceGaps),
    relevanceScores: relevanceScoresRaw
      ? {
          topSignalScores: asArray((relevanceScoresRaw as { topSignalScores?: unknown }).topSignalScores),
          rejectedSignals: asArray((relevanceScoresRaw as { rejectedSignals?: unknown }).rejectedSignals),
        }
      : { topSignalScores: [], rejectedSignals: [] },
    warnings: asArray<string>(data.warnings),
    projectUnderstanding: data.projectUnderstanding && typeof data.projectUnderstanding === 'object' ? data.projectUnderstanding as AnalyzeResponse['projectUnderstanding'] : undefined,
    analysisTrace: asArray(data.analysisTrace),
    evidenceBoard: asArray(data.evidenceBoard),
    projectEvaluation: asArray(data.projectEvaluation),
    riskBottlenecks: asArray(data.riskBottlenecks),
    mvpValidationPlan: asArray(data.mvpValidationPlan),
    matchedSignals: asArray(data.matchedSignals),
    matchedOpportunities: asArray(data.matchedOpportunities),
    recommendation,
    riskMatrix: asArray(data.riskMatrix),
    sevenDayPlan: asArray<string>(data.sevenDayPlan),
    ...passthrough,
  } as AnalyzeResponse;
}

export async function analyzeOpportunity(input: AnalyzeRequest, signal?: AbortSignal): Promise<AnalyzeResponse> {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal,
  });

  if (!response.ok) {
    console.warn('Analyze API failed', response.status);
    throw new Error(`Analyze API failed: ${response.status}`);
  }

  return normalizeAnalyzeResponse(await response.json());
}

type AnalyzeStreamHandlers = {
  onProgress?: (event: AnalyzeProgressEvent) => void;
  onProvider?: (event: AnalyzeProviderEvent) => void;
  onDone?: (event: AnalyzeDoneEvent) => void;
  onError?: (event: AnalyzeErrorEvent) => void;
  onCompatibilityFallback?: () => void;
};

class AnalyzeStreamProtocolError extends Error {}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}

function parseSseMessage(chunk: string) {
  const lines = chunk.split(/\r?\n/);
  let event = '';
  let data = '';
  for (const line of lines) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    if (line.startsWith('data:')) data += line.slice(5).trim();
  }
  if (!event || !data) return null;
  try {
    return { event, data: JSON.parse(data) as Record<string, unknown> };
  } catch {
    return null;
  }
}

export async function analyzeOpportunityStream(
  input: AnalyzeRequest,
  handlers: AnalyzeStreamHandlers,
  signal?: AbortSignal,
): Promise<AnalyzeResponse> {
  let fallbackUsed = false;
  let doneDelivered = false;
  const compatibilityRunId = `compat-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const deliverDone = (event: AnalyzeDoneEvent) => {
    if (doneDelivered) return;
    doneDelivered = true;
    handlers.onDone?.(event);
  };
  const fallbackToCompatible = async () => {
    if (fallbackUsed) throw new Error('Analyze stream fallback already used');
    fallbackUsed = true;
    handlers.onCompatibilityFallback?.();
    const normalizedResult = await analyzeOpportunity(input, signal);
    deliverDone({
      runId: compatibilityRunId,
      timestamp: new Date().toISOString(),
      result: normalizedResult,
    });
    return normalizedResult;
  };

  let response: Response;
  try {
    response = await fetch('/api/analyze/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal,
    });
  } catch (error) {
    if (isAbortError(error)) throw error;
    return fallbackToCompatible();
  }
  if (!response.ok || !response.body) {
    return fallbackToCompatible();
  }

  try {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split('\n\n');
      buffer = chunks.pop() || '';
      for (const rawChunk of chunks) {
        const parsed = parseSseMessage(rawChunk);
        if (!parsed) continue;
        if (parsed.event === 'progress') handlers.onProgress?.(parsed.data as unknown as AnalyzeProgressEvent);
        if (parsed.event === 'provider') handlers.onProvider?.(parsed.data as unknown as AnalyzeProviderEvent);
        if (parsed.event === 'error') {
          const errorEvent = parsed.data as unknown as AnalyzeErrorEvent;
          handlers.onError?.(errorEvent);
          throw new AnalyzeStreamProtocolError(errorEvent.message || 'Analyze stream failed');
        }
        if (parsed.event === 'done') {
          const doneEvent = parsed.data as unknown as AnalyzeDoneEvent;
          const normalizedResult = normalizeAnalyzeResponse(doneEvent.result);
          deliverDone({ ...doneEvent, result: normalizedResult });
          return normalizedResult;
        }
      }
    }
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (error instanceof AnalyzeStreamProtocolError) throw error;
    return fallbackToCompatible();
  }
  return fallbackToCompatible();
}
