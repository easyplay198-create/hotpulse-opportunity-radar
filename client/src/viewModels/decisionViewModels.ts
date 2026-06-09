import type { EvidenceStrength, EvidenceType, HotVerdict, HotItem } from '../types/hot';
import type { AnalyzeStep, AnalyzeRiskItem, AnalyzeRecommendation, EvidenceBoardItem, MvpValidationStep, RiskBottleneck, MatchedOpportunity } from '../types/analyze';

export type ScoreBand = 'strong' | 'testing' | 'watch' | 'nogo';

export type StandardVerdict = 'validate_now' | 'watch' | 'no_go' | 'insufficient_evidence';

export type StandardConfidence = 'high' | 'medium' | 'low' | 'unknown';

export type RiskType =
  | 'payment'
  | 'localization'
  | 'compliance'
  | 'acquisition'
  | 'competition'
  | 'ai_cost'
  | 'evidence'
  | 'unknown';

export interface StandardRiskItem {
  id: string;
  type: RiskType;
  label: string;
  level: 'high' | 'medium' | 'low';
  score?: number;
  summary: string;
  source?: 'derived' | 'reported' | 'sample';
}

export interface StandardEvidenceItem {
  id: string;
  source: string;
  title: string;
  fact: string;
  strength: 'high' | 'medium' | 'low' | 'unknown';
  url?: string;
  time?: string;
  type?: EvidenceType | string;
  isDerived?: boolean;
}

export interface StandardActionItem {
  id: string;
  title: string;
  timeBox: string;
  successMetric: string;
  stopCondition: string;
  relatedRisk?: RiskType;
  source?: 'derived' | 'reported' | 'sample';
}

export interface DecisionSummaryVM {
  score: number;
  scoreBand: ScoreBand;
  verdict: StandardVerdict;
  verdictLabel: string;
  confidence: StandardConfidence;
  confidenceLabel: string;
  summary: string;
  topRisk?: string;
  nextAction: string;
}

export interface OpportunityDecisionVM {
  id: string;
  title: string;
  category: string;
  targetMarket: string;
  score: number;
  scoreBand: ScoreBand;
  verdict: StandardVerdict;
  verdictLabel: string;
  confidence: StandardConfidence;
  evidenceCount: number;
  sources: string[];
  evidenceSummary: string;
  topRisks: StandardRiskItem[];
  evidenceTimeline: StandardEvidenceItem[];
  action24h: StandardActionItem;
  action7d: StandardActionItem;
  stopCondition: string;
  updatedAt: string;
  sourceItemId?: string;
  isDerived: boolean;
  decision: DecisionSummaryVM;
}

export interface SignalRankingVM {
  id: string;
  title: string;
  source: string;
  sourceType?: string;
  market: string;
  signalType: string;
  change: string;
  impact: string;
  evidenceStrength: 'high' | 'medium' | 'low' | 'unknown';
  relatedOpportunity?: string;
  nextAction: string;
  score?: number;
  riskFlags: string[];
  isDerived: boolean;
  updatedAt?: string;
}

export interface AnalyzeDecisionVM {
  decision: DecisionSummaryVM;
  opportunityOverview: string[];
  marketSignals: string[];
  evidenceTimeline: StandardEvidenceItem[];
  riskItems: StandardRiskItem[];
  actionPlaybook: StandardActionItem[];
  openQuestions: string[];
  assumptions: string[];
  traceSteps: string[];
}

export interface ReportDecisionVM {
  id: string;
  title: string;
  targetMarket: string;
  generatedAt?: string;
  decision: DecisionSummaryVM;
  keyMetrics: string[];
  evidenceTimeline: StandardEvidenceItem[];
  riskItems: StandardRiskItem[];
  actionPlaybook: StandardActionItem[];
  openQuestions: string[];
  source: string;
}

export interface ProviderStatusVM {
  id: string;
  label: string;
  status: 'connected' | 'sample' | 'pending' | 'missing_config' | 'cache' | 'unknown';
  statusLabel: string;
  count?: number;
  note: string;
}

export function safeText(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export function toScoreBand(score: number): ScoreBand {
  if (score >= 80) return 'strong';
  if (score >= 60) return 'testing';
  if (score >= 40) return 'watch';
  return 'nogo';
}

export function normalizeVerdict(input: unknown): StandardVerdict {
  const text = String(input ?? '').trim().toLowerCase();
  if (['do_now', 'validate', 'validate_now', '立即验证', '值得验证', '优先验证'].includes(text)) return 'validate_now';
  if (['watch', '持续观察', '观察'].includes(text)) return 'watch';
  if (['skip', 'no_go', 'no-go', '暂不进入', '不建议'].includes(text)) return 'no_go';
  return 'insufficient_evidence';
}

export function getVerdictLabel(verdict: StandardVerdict): string {
  if (verdict === 'validate_now') return '立即验证';
  if (verdict === 'watch') return '持续观察';
  if (verdict === 'no_go') return '暂不进入';
  return '证据不足';
}

export function normalizeConfidence(input: unknown): StandardConfidence {
  const text = String(input ?? '').trim().toLowerCase();
  if (['high', '高', 'strong'].includes(text)) return 'high';
  if (['medium', '中'].includes(text)) return 'medium';
  if (['low', '低'].includes(text)) return 'low';
  return 'unknown';
}

export function getConfidenceLabel(confidence: StandardConfidence): string {
  if (confidence === 'high') return '高';
  if (confidence === 'medium') return '中';
  if (confidence === 'low') return '低';
  return '未知';
}

export function riskLevelFromScore(score?: number): 'high' | 'medium' | 'low' {
  if (typeof score !== 'number' || !Number.isFinite(score)) return 'low';
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

export function standardRiskTypeFromLabel(label: string): RiskType {
  const text = label.toLowerCase();
  if (text.includes('pay')) return 'payment';
  if (text.includes('本地') || text.includes('local')) return 'localization';
  if (text.includes('合规') || text.includes('compliance')) return 'compliance';
  if (text.includes('获客') || text.includes('acquisition') || text.includes('投放')) return 'acquisition';
  if (text.includes('竞争') || text.includes('competition')) return 'competition';
  if (text.includes('ai') || text.includes('token') || text.includes('cost')) return 'ai_cost';
  if (text.includes('证据') || text.includes('evidence')) return 'evidence';
  return 'unknown';
}

export function standardActionFromText(id: string, title: string, timeBox: string, successMetric: string, stopCondition: string, source?: 'derived' | 'reported' | 'sample', relatedRisk?: RiskType): StandardActionItem {
  return { id, title, timeBox, successMetric, stopCondition, source, relatedRisk };
}

export function verdictFromHotVerdict(verdict: HotVerdict): StandardVerdict {
  if (verdict === 'do_now') return 'validate_now';
  if (verdict === 'watch') return 'watch';
  if (verdict === 'skip') return 'no_go';
  return 'insufficient_evidence';
}

export function confidenceFromEvidence(evidenceStrength: EvidenceStrength | undefined, evidenceCount: number, score: number): StandardConfidence {
  if (evidenceStrength === 'high' || evidenceCount >= 3 || score >= 80) return 'high';
  if (evidenceStrength === 'medium' || evidenceCount >= 2 || score >= 60) return 'medium';
  if (evidenceStrength === 'low' || evidenceCount >= 1) return 'low';
  return 'unknown';
}

export function textFromAnalyzeStep(step: AnalyzeStep | undefined): string {
  if (!step) return '';
  return [step.label, step.summary].filter(Boolean).join(' · ');
}

export function riskItemFromAnalyzeRisk(item: AnalyzeRiskItem, index: number): StandardRiskItem {
  return {
    id: `analyze-risk-${index}`,
    type: standardRiskTypeFromLabel(item.label),
    label: item.label,
    level: item.level === '高' ? 'high' : item.level === '中' ? 'medium' : 'low',
    score: item.value,
    summary: item.label,
    source: 'reported',
  };
}

export function riskItemFromBottleneck(item: RiskBottleneck, index: number): StandardRiskItem {
  return {
    id: `bottleneck-${index}`,
    type: standardRiskTypeFromLabel(item.title || item.why),
    label: item.title,
    level: item.level === '高' || item.level === '中高' ? 'high' : item.level === '中' ? 'medium' : 'low',
    summary: item.why || item.impact || item.validationAction || '风险待确认',
    source: 'reported',
  };
}

export function evidenceFromBoardItem(item: EvidenceBoardItem, index: number): StandardEvidenceItem {
  return {
    id: `evidence-board-${index}`,
    source: safeText(item.source, 'unknown'),
    title: safeText(item.title, '证据'),
    fact: safeText(item.supports || item.note, '证据摘要'),
    strength: item.evidenceStrength ?? 'unknown',
    url: item.url,
    type: item.sourceType,
    isDerived: false,
  };
}

export function evidenceFromHotItem(item: HotItem, index: number): StandardEvidenceItem {
  return {
    id: `hot-evidence-${item.id}-${index}`,
    source: safeText(item.platformId, 'unknown'),
    title: safeText(item.title, '证据'),
    fact: safeText(item.summary, '证据摘要'),
    strength: item.evidence?.[index]?.evidenceStrength ?? 'unknown',
    time: item.evidence?.[index]?.retrievedAt ?? item.publishedAt,
    url: item.evidence?.[index]?.url,
    type: item.evidence?.[index]?.type,
    isDerived: true,
  };
}

export function actionFromMvpStep(step: MvpValidationStep, index: number): StandardActionItem {
  return {
    id: `mvp-step-${index}`,
    title: step.action,
    timeBox: step.day,
    successMetric: step.successMetric,
    stopCondition: step.stopCondition,
    source: 'reported',
  };
}

export function actionFromString(step: string, index: number): StandardActionItem {
  const day = `Day ${index + 1}`;
  const text = safeText(step, '执行验证动作');
  return {
    id: `derived-action-${index}`,
    title: text,
    timeBox: day,
    successMetric: '完成对应验证并记录结果',
    stopCondition: '连续无有效反馈时暂停',
    source: 'derived',
  };
}

export function summarizeRecommendation(recommendation: AnalyzeRecommendation | undefined, fallbackScore = 0): DecisionSummaryVM {
  const score = recommendation?.matchScore ?? fallbackScore;
  const verdict = normalizeVerdict(recommendation?.verdict);
  const confidence = normalizeConfidence(recommendation?.evidenceStrength);
  return {
    score,
    scoreBand: toScoreBand(score),
    verdict,
    verdictLabel: getVerdictLabel(verdict),
    confidence,
    confidenceLabel: getConfidenceLabel(confidence),
    summary: safeText(recommendation?.summary, '证据不足，建议先验证。'),
    topRisk: undefined,
    nextAction: safeText(recommendation?.nextStep, '先补证据，再做验证。'),
  };
}

export function summarizeProviderStatusLabel(status: ProviderStatusVM['status']): string {
  if (status === 'connected') return '已连接';
  if (status === 'sample') return '样本信号';
  if (status === 'pending') return '待接入';
  if (status === 'missing_config') return '缺少配置';
  if (status === 'cache') return '使用缓存';
  return '未知';
}

export function makeAction24hFallback(title: string, source: 'derived' | 'reported' | 'sample' = 'derived'): StandardActionItem {
  return {
    id: `${source}-action-24h`,
    title,
    timeBox: '24h',
    successMetric: '得到首批反馈或确认阻断点',
    stopCondition: '无反馈或风险过高时暂停',
    source,
  };
}

export function makeAction7dFallback(title: string, source: 'derived' | 'reported' | 'sample' = 'derived'): StandardActionItem {
  return {
    id: `${source}-action-7d`,
    title,
    timeBox: '7d',
    successMetric: '形成清晰继续/暂停判断',
    stopCondition: '连续 7 天没有有效信号时暂停',
    source,
  };
}

export function defaultRisk(label: string, score?: number, summary?: string, source: 'derived' | 'reported' | 'sample' = 'derived'): StandardRiskItem {
  return {
    id: `${source}-risk-${label}`,
    type: standardRiskTypeFromLabel(label),
    label,
    level: riskLevelFromScore(score),
    score,
    summary: summary || label,
    source,
  };
}

export function buildRiskSummaryLabel(risks: StandardRiskItem[]): string {
  return risks[0]?.label || '风险待确认';
}

export function actionsFromPlan(plan: Array<MvpValidationStep | string>): StandardActionItem[] {
  return plan.map((step, index) => {
    if (typeof step === 'string') return actionFromString(step, index);
    return actionFromMvpStep(step, index);
  });
}

export function evidenceFromMatchedOpportunity(item: MatchedOpportunity, index: number): StandardEvidenceItem {
  return {
    id: `matched-opportunity-${index}`,
    source: 'matched_opportunity',
    title: item.title,
    fact: item.reason,
    strength: 'medium',
    isDerived: true,
  };
}
