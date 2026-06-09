import type { HotItem } from '../types/hot';
import { confidenceFromEvidence, defaultRisk, evidenceFromHotItem, makeAction24hFallback, makeAction7dFallback, safeText, toScoreBand, verdictFromHotVerdict, type OpportunityDecisionVM, type StandardEvidenceItem, type StandardRiskItem } from './decisionViewModels';

function gatherSources(item: HotItem): string[] {
  const sources = new Set<string>();
  if (item.platformId) sources.add(item.platformId);
  (item.evidence ?? []).forEach((evidence) => {
    if (evidence.source) sources.add(evidence.source);
  });
  return [...sources];
}

function gatherTopRisks(item: HotItem): StandardRiskItem[] {
  const risks: StandardRiskItem[] = [];
  const pushRisk = (label: string, score?: number, summary?: string) => {
    if (typeof score !== 'number' && !summary) return;
    risks.push(defaultRisk(label, score, summary));
  };

  pushRisk('Payment', item.paymentRisk, '支付适配风险');
  pushRisk('Localization', item.localizationRisk, '本地化适配风险');
  pushRisk('Compliance', item.complianceRisk, '合规风险');
  pushRisk('Acquisition', item.acquisitionRisk, '获客成本风险');
  pushRisk('AI Cost', item.aiCostRisk, 'AI 成本风险');
  pushRisk('Competition', item.competitionRisk, '竞争压力风险');

  (item.riskFlags ?? []).forEach((flag) => {
    risks.push(defaultRisk(String(flag), undefined, '显式风险标签', 'derived'));
  });

  return risks.slice(0, 6);
}

function buildEvidenceTimeline(item: HotItem): StandardEvidenceItem[] {
  return (item.evidence ?? []).map((_, index) => evidenceFromHotItem(item, index)).slice(0, 5);
}

function buildEvidenceSummary(item: HotItem, evidenceCount: number, sources: string[]): string {
  const title = safeText(item.summary, item.title);
  const sourceText = sources.length > 0 ? `${sources.length} 个来源` : '来源待补充';
  return `${title} · ${sourceText} · ${evidenceCount} 条证据`;
}

function buildAction24h(item: HotItem) {
  const title = item.entryFocus?.[0] || '24 小时内先验证最小切口';
  return makeAction24hFallback(title, 'derived');
}

function buildAction7d(item: HotItem) {
  const title = item.marketEntryNotes?.[0] || '7 天内完成小样本验证';
  return makeAction7dFallback(title, 'derived');
}

function buildStopCondition(item: HotItem): string {
  if ((item.acquisitionRisk ?? 0) >= 70) return '获客成本过高且反馈不足时暂停。';
  if ((item.competitionRisk ?? 0) >= 75) return '竞争压力过高且差异化不清时暂停。';
  if ((item.paymentRisk ?? 0) >= 70) return '支付链路无法跑通时暂停。';
  if ((item.localizationRisk ?? 0) >= 70) return '本地化成本过高时暂停。';
  return '连续 7 天无有效信号时暂停。';
}

export function buildOpportunityDecisionVM(item: HotItem): OpportunityDecisionVM {
  const score = item.valueScore ?? 0;
  const evidenceCount = item.evidence?.length ?? 0;
  const sources = gatherSources(item);
  const verdict = verdictFromHotVerdict(item.verdict);
  const confidence = confidenceFromEvidence(item.evidence?.[0]?.evidenceStrength, evidenceCount, score);
  const topRisks = gatherTopRisks(item);
  const evidenceTimeline = buildEvidenceTimeline(item);
  const action24h = buildAction24h(item);
  const action7d = buildAction7d(item);
  const stopCondition = buildStopCondition(item);

  return {
    id: item.id,
    title: safeText(item.title, '未命名机会'),
    category: safeText(item.category || item.productType, '机会'),
    targetMarket: safeText(item.targetMarket, 'Global'),
    score,
    scoreBand: toScoreBand(score),
    verdict,
    verdictLabel: verdict === 'validate_now' ? '立即验证' : verdict === 'watch' ? '持续观察' : verdict === 'no_go' ? '暂不进入' : '证据不足',
    confidence,
    evidenceCount,
    sources,
    evidenceSummary: buildEvidenceSummary(item, evidenceCount, sources),
    topRisks,
    evidenceTimeline,
    action24h,
    action7d,
    stopCondition,
    updatedAt: item.publishedAt || '',
    sourceItemId: item.id,
    isDerived: true,
    decision: {
      score,
      scoreBand: toScoreBand(score),
      verdict,
      verdictLabel: verdict === 'validate_now' ? '立即验证' : verdict === 'watch' ? '持续观察' : verdict === 'no_go' ? '暂不进入' : '证据不足',
      confidence,
      confidenceLabel: confidence === 'high' ? '高' : confidence === 'medium' ? '中' : confidence === 'low' ? '低' : '未知',
      summary: buildEvidenceSummary(item, evidenceCount, sources),
      topRisk: topRisks[0]?.label,
      nextAction: action24h.title,
    },
  };
}

export function buildOpportunityDecisionVMs(items: HotItem[]): OpportunityDecisionVM[] {
  return items.map((item) => buildOpportunityDecisionVM(item));
}
