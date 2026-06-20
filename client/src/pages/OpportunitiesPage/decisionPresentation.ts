import type { HotItem } from '../../types/hot';
import type {
  DecisionLimitation,
  DecisionObservation,
  DecisionRisk,
  OpportunityDecisionV1,
} from '../../types/opportunityDecision';
import { buildOpportunityDecisionV1 } from '../../viewModels/opportunityDecisionAdapter';
import { shouldShowMarket } from './presentation';

export { shouldShowMarket } from './presentation';

export interface DecisionMetricStrip {
  primary: string;
  secondary?: string;
  isWeak: boolean;
  sourceName: string;
}

export interface DecisionCardView {
  decision: OpportunityDecisionV1;
  primarySource: string;
  metrics: DecisionMetricStrip[];
  confirmText: string;
  cannotConfirmText: string;
  keyUnknownText: string;
  weakIndicators: string[];
  analyzeHref?: string;
  showMarket: boolean;
  showProductType: boolean;
}

const LIMITATION_PRIORITY: DecisionLimitation['category'][] = [
  'metric_scope',
  'sampling_bias',
  'weak_signal',
  'cross_source_incompatibility',
  'knowledge_base_only',
  'missing_data',
  'data_age',
  'unknown',
];

export function buildDecisionFromItem(item: HotItem): OpportunityDecisionV1 {
  return buildOpportunityDecisionV1(item);
}

export function splitObservationMetrics(obs: DecisionObservation): { primary: string; secondary?: string } {
  if (!obs.valueLabel) return { primary: obs.title };
  const parts = obs.valueLabel.split(' · ').map((part) => part.trim()).filter(Boolean);
  return {
    primary: parts[0] ?? obs.valueLabel,
    secondary: parts[1],
  };
}

export function isWeakObservation(obs: DecisionObservation): boolean {
  if (obs.sourceType !== 'hacker_news') return false;
  const match = obs.valueLabel?.match(/(\d+)\s*points/i);
  return match ? Number(match[1]) < 10 : false;
}

export function getObservedMetricsFromDecision(decision: OpportunityDecisionV1, limit = 2): DecisionMetricStrip[] {
  return decision.observations
    .filter((observation) => observation.provenance === 'observed')
    .slice(0, limit)
    .map((observation) => {
      const metrics = splitObservationMetrics(observation);
      return {
        primary: metrics.primary,
        secondary: metrics.secondary,
        isWeak: isWeakObservation(observation),
        sourceName: observation.sourceName,
      };
    });
}

export function getDecisionWeakIndicators(decision: OpportunityDecisionV1): string[] {
  const indicators: string[] = [];
  const observed = decision.observations.filter((observation) => observation.provenance === 'observed');

  for (const observation of observed) {
    if (isWeakObservation(observation)) indicators.push('弱互动信号');
    if (!observation.sourceUrl) indicators.push('不可直接追溯');
    if (!observation.retrievedAt) indicators.push('采集时间缺失');
  }

  if (decision.identity.dataTier === 'mock') indicators.push('演示样本');
  if (decision.identity.dataTier === 'fallback') indicators.push('降级样本');

  if (decision.dataNotes.externalSourceCount === 0 && decision.dataNotes.knowledgeBaseEntryCount > 0) {
    indicators.push('暂无独立外部证据');
  }

  return [...new Set(indicators)];
}

export function pickFirstSupportClaim(decision: OpportunityDecisionV1): string | null {
  return decision.supportsClaims[0]?.statement ?? null;
}

export function pickKeyLimitation(decision: OpportunityDecisionV1): string | null {
  for (const category of LIMITATION_PRIORITY) {
    const found = decision.limitations.find((limitation) => limitation.category === category);
    if (found) return found.statement;
  }
  return decision.limitations[0]?.statement ?? null;
}

export function buildCardBoundaryTexts(decision: OpportunityDecisionV1): { confirmText: string; cannotConfirmText: string } {
  const firstClaim = pickFirstSupportClaim(decision);
  const firstLimitation = decision.validationHandoff.keyQuestions[0] ?? pickKeyLimitation(decision);
  const hasObserved = decision.observations.some((observation) => observation.provenance === 'observed');

  return {
    confirmText: firstClaim ?? (hasObserved
      ? '截至采集时间，该平台存在对应的公开指标。'
      : '当前没有具备原始链接和有效采集时间的外部观测，因此无法形成可追溯陈述。'),
    cannotConfirmText: firstLimitation ?? '该指标不能直接证明市场需求或付费意愿。',
  };
}

export function buildDecisionCardView(item: HotItem): DecisionCardView {
  const decision = buildOpportunityDecisionV1(item);
  const productType = decision.identity.productType?.trim();
  const boundary = buildCardBoundaryTexts(decision);
  const keyUnknownText = decision.validationHandoff.keyQuestions[0] ?? boundary.cannotConfirmText;

  return {
    decision,
    primarySource: decision.identity.primarySource ?? '来源待确认',
    metrics: getObservedMetricsFromDecision(decision),
    confirmText: boundary.confirmText,
    cannotConfirmText: keyUnknownText,
    keyUnknownText,
    weakIndicators: getDecisionWeakIndicators(decision),
    analyzeHref: decision.validationHandoff.analyzeHref,
    showMarket: shouldShowMarket(decision.identity.targetMarket),
    showProductType: Boolean(productType && productType !== '产品类型待确认'),
  };
}

const RISK_CATEGORY_LABELS: Record<string, string> = {
  payment: '支付路径',
  localization: '本地化',
  distribution: '平台分发',
  compliance: '合规',
  ai_cost: 'AI 成本',
  competition: '竞争替代',
};

export interface RiskReferenceItem {
  id: string;
  categoryLabel: string;
  level: DecisionRisk['level'];
  statement: string;
}

export function mapRiskCategoryLabel(category: string): string {
  return RISK_CATEGORY_LABELS[category] ?? '通用核查项';
}

export function buildRiskReferenceItems(risks: DecisionRisk[], limit = 2): RiskReferenceItem[] {
  const seen = new Set<string>();
  const items: RiskReferenceItem[] = [];

  for (const risk of risks) {
    if (risk.category === 'rule_flag') continue;
    if (seen.has(risk.category)) continue;
    seen.add(risk.category);
    items.push({
      id: risk.id,
      categoryLabel: mapRiskCategoryLabel(risk.category),
      level: risk.level,
      statement: risk.statement,
    });
    if (items.length >= limit) break;
  }

  return items;
}

export function mapLimitationCategoryLabel(category: DecisionLimitation['category']): string {
  const labels: Record<DecisionLimitation['category'], string> = {
    sampling_bias: '样本偏差',
    weak_signal: '弱信号',
    missing_data: '数据缺失',
    data_age: '时效限制',
    metric_scope: '指标口径',
    cross_source_incompatibility: '跨来源限制',
    knowledge_base_only: '知识库边界',
    unknown: '其他限制',
  };
  return labels[category] ?? category;
}

export function mapRiskLevelLabel(level: string): string {
  if (level === 'high') return '高';
  if (level === 'medium') return '中';
  if (level === 'low') return '低';
  return '待确认';
}

export function mapDecisionProvenanceLabel(provenance: string): string {
  if (provenance === 'observed') return '外部观测';
  if (provenance === 'rule_derived') return '规则推导';
  if (provenance === 'knowledge_base') return '内部知识库';
  return '未知来源';
}

export function getWhyNowSectionTitle(decision: OpportunityDecisionV1): string {
  if (decision.whyNow.status === 'available') return '信号时效';
  return '为什么现在仍不足以下结论';
}

export function groupLimitationsByCategory(limitations: DecisionLimitation[]): Array<{ category: string; items: DecisionLimitation[] }> {
  const groups = new Map<string, DecisionLimitation[]>();
  for (const limitation of limitations) {
    const key = limitation.category;
    const current = groups.get(key) ?? [];
    current.push(limitation);
    groups.set(key, current);
  }
  return [...groups.entries()].map(([category, items]) => ({ category, items }));
}

export function formatDecisionTime(value?: string): string {
  if (!value) return '采集时间待确认';
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return '采集时间待确认';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(time));
}

export function cardViewExcludesForbiddenTerms(view: DecisionCardView): boolean {
  const text = JSON.stringify(view);
  const blocked = ['valueScore', 'verdict', 'do_now', 'watch', 'skip', '适合进入', '需求旺盛', '趋势上升'];
  return !blocked.some((term) => text.includes(term));
}
