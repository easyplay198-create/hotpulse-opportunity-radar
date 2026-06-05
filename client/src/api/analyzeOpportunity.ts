import type { AnalyzeRequest, AnalyzeResponse } from '../types/analyze';

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
  };
}

export async function analyzeOpportunity(input: AnalyzeRequest): Promise<AnalyzeResponse> {
  const response = await fetch('http://localhost:3001/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`Analyze API failed: ${response.status}`);
  }

  return normalizeAnalyzeResponse(await response.json());
}
