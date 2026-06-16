import type { HotItem } from '../types/hot';
import { buildOpportunityDecisionVM } from './opportunityDecisionAdapter';
import { defaultRisk, makeAction24hFallback, safeText, type ReportDecisionVM } from './decisionViewModels';

function buildEvidenceTimeline(item: HotItem) {
  return (item.evidence ?? []).map((evidence, index) => ({
    id: `report-evidence-${index}`,
    source: safeText(evidence.source, 'unknown'),
    title: safeText(evidence.title, '证据'),
    fact: safeText(evidence.title, '证据摘要'),
    strength: evidence.evidenceStrength ?? 'unknown',
    url: evidence.url ?? undefined,
    time: evidence.retrievedAt,
    type: evidence.type,
    isDerived: true,
  }));
}

function buildRiskItems(item: HotItem) {
  return [
    defaultRisk('Payment', item.paymentRisk, '支付适配风险'),
    defaultRisk('Localization', item.localizationRisk, '本地化适配风险'),
    defaultRisk('Compliance', item.complianceRisk, '合规风险'),
    defaultRisk('Acquisition', item.acquisitionRisk, '获客成本风险'),
    defaultRisk('AI Cost', item.aiCostRisk, 'AI 成本风险'),
    defaultRisk('Competition', item.competitionRisk, '竞争压力风险'),
  ].filter((risk) => typeof risk.score === 'number' || risk.summary);
}

export function buildReportDecisionVMFromHotItem(item: HotItem): ReportDecisionVM {
  const opportunity = buildOpportunityDecisionVM(item);

  return {
    id: item.id,
    title: opportunity.title,
    targetMarket: opportunity.targetMarket,
    generatedAt: item.publishedAt || undefined,
    decision: opportunity.decision,
    keyMetrics: [
      `Score ${opportunity.score}`,
      `Verdict ${opportunity.decision.verdictLabel}`,
      `Confidence ${opportunity.decision.confidenceLabel}`,
    ],
    evidenceTimeline: buildEvidenceTimeline(item),
    riskItems: buildRiskItems(item),
    actionPlaybook: [
      opportunity.action24h,
      opportunity.action7d,
      makeAction24hFallback(opportunity.stopCondition, 'derived'),
    ],
    openQuestions: [safeText(item.summary, '关键问题待确认')],
    source: 'hot_item_derived',
  };
}
