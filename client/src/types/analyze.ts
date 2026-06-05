import type { EvidenceStrength, HotItem } from './hot';

export interface AnalyzeProfile {
  productStage?: string;
  targetMarket?: string;
  budgetRange?: string;
  validationGoal?: string;
  assets?: string[];
  capabilities?: string[];
  avoidDirections?: string[];
}

export interface AnalyzeRequest {
  query: string;
  source?: 'real' | 'mock' | 'fallback';
  profile?: AnalyzeProfile;
}

export interface AnalyzeStep {
  id: string;
  label: string;
  status: 'done';
  summary: string;
}

export interface ParsedIntent {
  productType: string;
  targetMarket: string;
  userType: string;
  stage: string;
  rawQuery: string;
}

export interface MatchedOpportunity {
  id: string;
  title: string;
  sourceItemId: string;
  fitScore: number;
  reason: string;
  firstStep: string;
  riskWarning: string;
}

export interface AnalyzeRecommendation {
  title: string;
  verdict: '优先验证' | '持续观察' | '暂不进入';
  matchScore: number;
  targetMarket: string;
  evidenceStrength: EvidenceStrength;
  summary: string;
  nextStep: string;
  reportItemId?: string;
}

export interface AnalyzeRiskItem {
  label: string;
  value: number;
  level: '低' | '中' | '高';
}

export interface AnalyzeResponse {
  analysisId: string;
  source: 'real' | 'mock' | 'fallback';
  generatedAt: string;
  steps: AnalyzeStep[];
  parsedIntent: ParsedIntent;
  matchedSignals: HotItem[];
  matchedOpportunities: MatchedOpportunity[];
  recommendation: AnalyzeRecommendation;
  riskMatrix: AnalyzeRiskItem[];
  sevenDayPlan: string[];
}
