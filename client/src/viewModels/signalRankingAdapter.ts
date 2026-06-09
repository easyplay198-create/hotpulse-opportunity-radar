import type { DailyIntelligenceBriefItem } from '../lib/buildDailyIntelligenceBrief';
import type { EvidenceItem } from '../types/hot';
import { safeText, type SignalRankingVM } from './decisionViewModels';

function evidenceStrengthFromItem(evidence: EvidenceItem) {
  return evidence.evidenceStrength ?? 'unknown';
}

function buildDerivedChange(evidence: EvidenceItem, index?: number) {
  return safeText(evidence.title, `信号 ${typeof index === 'number' ? index + 1 : 1}`);
}

function buildDerivedImpact(evidence: EvidenceItem) {
  return `该信号提示 ${safeText(evidence.source, '来源')} 方向可能继续升温。`;
}

export function buildSignalRankingVMFromEvidence(evidence: EvidenceItem, index?: number): SignalRankingVM {
  return {
    id: `signal-${index ?? 0}-${evidence.source}`,
    title: safeText(evidence.title, '市场信号'),
    source: safeText(evidence.source, 'unknown'),
    sourceType: undefined,
    market: 'Global',
    signalType: String(evidence.type || 'signal'),
    change: buildDerivedChange(evidence, index),
    impact: buildDerivedImpact(evidence),
    evidenceStrength: evidenceStrengthFromItem(evidence),
    relatedOpportunity: undefined,
    nextAction: '继续观察并补充证据。',
    score: undefined,
    riskFlags: [],
    isDerived: true,
    updatedAt: evidence.retrievedAt,
  };
}

export function buildSignalRankingVMsFromEvidence(evidence: EvidenceItem[]): SignalRankingVM[] {
  return evidence.map((item, index) => buildSignalRankingVMFromEvidence(item, index));
}

export function buildSignalRankingVMFromBriefItem(item: DailyIntelligenceBriefItem): SignalRankingVM {
  return {
    id: item.id,
    title: safeText(item.title, '市场信号'),
    source: safeText(item.source, 'unknown'),
    sourceType: item.sourceType,
    market: item.category,
    signalType: item.signalType,
    change: safeText(item.summary, '信号变化待补充'),
    impact: safeText(item.opportunityInsight, '影响待补充'),
    evidenceStrength: item.evidenceStrength ?? 'unknown',
    relatedOpportunity: undefined,
    nextAction: safeText(item.validationDirection, '继续观察'),
    score: undefined,
    riskFlags: [],
    isDerived: true,
    updatedAt: undefined,
  };
}
