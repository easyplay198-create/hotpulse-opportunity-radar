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

export interface ParsedIntent {
  productCategory: string;
  targetMarket: string;
  audience: string;
  businessModel: string;
  sensitivityFlags: string[];
  confidence: number;
  interpretationNote: string;
  rawQuery: string;
}

export interface ClarifyingQuestion {
  id: string;
  text: string;
  options: string[];
}

export interface RejectedSignal {
  id?: string;
  title: string;
  finalRelevanceScore: number;
  rejectionReason: string;
}

export interface RelevanceScoreSummary {
  topSignalScores: unknown[];
  rejectedSignals: RejectedSignal[];
}

export interface ProjectUnderstanding {
  productCategory: string;
  targetAudience: string;
  targetMarket: string;
  businessModel: string;
  knownConditions: string[];
  missingConditions: string[];
  confidence: number;
}

export interface AnalysisTraceItem {
  step: string;
  status: 'done' | 'active' | 'waiting';
  action: string;
  finding: string;
  uncertainty: string;
}

export interface EvidenceBoardItem {
  title: string;
  source: string;
  sourceType: 'real_signal' | 'mock_signal' | 'market_knowledge' | 'system_inference' | 'user_input';
  evidenceStrength?: EvidenceStrength;
  supports: string;
  url?: string;
  sourceItemId?: string;
  note?: string;
}

export interface ProjectEvaluationItem {
  label: string;
  score: number;
  explanation: string;
}

export interface RiskBottleneck {
  title: string;
  level: '高' | '中高' | '中' | '低';
  why: string;
  impact: string;
  validationAction: string;
  stopOrAdjust: string;
}

export interface MvpValidationStep {
  day: string;
  goal: string;
  action: string;
  successMetric: string;
  stopCondition: string;
  requiredResource: string;
}

export interface AnalyzeStep {
  id: string;
  label: string;
  status: 'done';
  summary: string;
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
  version?: string;
  analysisId: string;
  source: 'real' | 'mock' | 'fallback';
  generatedAt: string;
  steps: AnalyzeStep[];
  parsedIntent?: ParsedIntent;
  clarifyingQuestions?: ClarifyingQuestion[];
  evidenceGaps?: string[];
  relevanceScores?: RelevanceScoreSummary;
  warnings?: string[];
  projectUnderstanding?: ProjectUnderstanding;
  analysisTrace?: AnalysisTraceItem[];
  evidenceBoard?: EvidenceBoardItem[];
  projectEvaluation?: ProjectEvaluationItem[];
  riskBottlenecks?: RiskBottleneck[];
  mvpValidationPlan?: MvpValidationStep[];
  matchedSignals: Array<HotItem & { relevanceScore?: number; relevanceLabel?: string }>;
  matchedOpportunities: MatchedOpportunity[];
  recommendation: AnalyzeRecommendation;
  riskMatrix: AnalyzeRiskItem[];
  sevenDayPlan: string[];
}
