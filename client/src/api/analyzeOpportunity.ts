import type { AnalyzeRequest, AnalyzeResponse } from '../types/analyze';

export async function analyzeOpportunity(input: AnalyzeRequest): Promise<AnalyzeResponse> {
  const response = await fetch('http://localhost:3001/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`Analyze API failed: ${response.status}`);
  }

  const data = await response.json() as AnalyzeResponse;

  if (!data || !data.analysisId || !data.recommendation || !Array.isArray(data.steps)) {
    throw new Error('Invalid analyze response');
  }

  return data;
}
