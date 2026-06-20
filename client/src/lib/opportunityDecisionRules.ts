import type { EvidenceItem } from '../types/hot';
import type { DecisionConfidence, DecisionLimitation, DecisionRisk, LimitationCategory } from '../types/opportunityDecision';

export type DecisionSourceType =
  | 'app_store'
  | 'github'
  | 'hacker_news'
  | 'product_hunt'
  | 'gdelt'
  | 'knowledge_base'
  | 'unknown';

const KNOWLEDGE_BASE_SOURCE_PATTERN = /^hotpulse market knowledge$/i;

const OBSERVED_SOURCE_PATTERNS: Array<{ pattern: RegExp; type: DecisionSourceType }> = [
  { pattern: /^apple app store$/i, type: 'app_store' },
  { pattern: /^app store$/i, type: 'app_store' },
  { pattern: /^github$/i, type: 'github' },
  { pattern: /^hacker news$/i, type: 'hacker_news' },
  { pattern: /^product hunt$/i, type: 'product_hunt' },
  { pattern: /^gdelt$/i, type: 'gdelt' },
];

const CLAIM_CONFIDENCE_BY_SOURCE: Record<DecisionSourceType, DecisionConfidence> = {
  app_store: 'medium',
  github: 'medium',
  hacker_news: 'low',
  product_hunt: 'low',
  gdelt: 'low',
  knowledge_base: 'insufficient',
  unknown: 'insufficient',
};

export const DECISION_DISCLAIMERS = [
  '原始平台指标不等于市场规模、活跃用户、收入、转化率或成功概率。',
  '规则推导和知识库内容不是独立外部验证事实。',
  '进入与停止条件需要结合用户自己的团队、预算和目标市场生成。',
];

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

export function isValidHttpUrl(value: unknown): value is string {
  const raw = asNonEmptyString(value);
  if (!raw) return false;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isValidIsoTime(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time);
}

export function toDateLabel(value?: string): string | null {
  if (!value || !isValidIsoTime(value)) return null;
  return new Date(value).toISOString().slice(0, 10);
}

export function formatLocaleCount(value: number): string {
  return value.toLocaleString('en-US');
}

export function formatCompactCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(Math.round((value / 1_000) * 10) / 10).toFixed(1)}k`;
  return String(value);
}

export function inferDecisionSourceType(evidence: Pick<EvidenceItem, 'source' | 'metadata'>): DecisionSourceType {
  const sourceName = asNonEmptyString(evidence.source) ?? '';
  if (
    KNOWLEDGE_BASE_SOURCE_PATTERN.test(sourceName)
    || typeof evidence.metadata?.knowledgeType === 'string'
  ) {
    return 'knowledge_base';
  }
  const mapped = OBSERVED_SOURCE_PATTERNS.find((entry) => entry.pattern.test(sourceName));
  return mapped?.type ?? 'unknown';
}

export function inferObservationProvenance(
  evidence: Pick<EvidenceItem, 'source' | 'metadata'>,
): 'observed' | 'knowledge_base' | 'unknown' {
  const sourceType = inferDecisionSourceType(evidence);
  if (sourceType === 'knowledge_base') return 'knowledge_base';
  if (sourceType === 'unknown') return 'unknown';
  return 'observed';
}

export function confidenceFromSourceType(sourceType: DecisionSourceType): DecisionConfidence {
  return CLAIM_CONFIDENCE_BY_SOURCE[sourceType];
}

export function riskLevelFromScore(score: unknown): 'high' | 'medium' | 'low' | 'unknown' {
  if (typeof score !== 'number' || !Number.isFinite(score)) return 'unknown';
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

export function latestRetrievedAtFromValues(values: Array<string | undefined>): string | undefined {
  let latestTime = 0;
  let latestValue: string | undefined;
  for (const value of values) {
    if (!value || !isValidIsoTime(value)) continue;
    const current = new Date(value).getTime();
    if (current > latestTime) {
      latestTime = current;
      latestValue = new Date(current).toISOString();
    }
  }
  return latestValue;
}

export function appStoreLimitations(): DecisionLimitation[] {
  return [
    {
      id: 'lim-app-store-feedback-scope',
      statement: '评分仅反映该平台已有评分用户的反馈，不能直接证明新市场需求。',
      affectedJudgment: '市场需求判断',
      category: 'sampling_bias',
      provenance: 'rule_derived',
    },
    {
      id: 'lim-app-store-count-scope',
      statement: '评价数量不等于活跃用户数、MAU、留存率或付费用户数。',
      affectedJudgment: '用户规模与留存判断',
      category: 'metric_scope',
      provenance: 'rule_derived',
    },
    {
      id: 'lim-app-store-cross-market',
      statement: '平台表现不能直接证明其他国家或渠道的获客可行性。',
      affectedJudgment: '跨市场获客可行性判断',
      category: 'cross_source_incompatibility',
      provenance: 'rule_derived',
    },
  ];
}

export function githubLimitations(): DecisionLimitation[] {
  return [
    {
      id: 'lim-github-stars-meaning',
      statement: 'Stars 属于关注或收藏行为，不等于商业使用、部署量或付费意愿。',
      affectedJudgment: '商业使用与付费意愿判断',
      category: 'metric_scope',
      provenance: 'rule_derived',
    },
    {
      id: 'lim-github-forks-customer',
      statement: 'Forks 不等于独立商业客户。',
      affectedJudgment: '客户数量判断',
      category: 'metric_scope',
      provenance: 'rule_derived',
    },
    {
      id: 'lim-github-heat-demand',
      statement: '仓库热度不能直接证明终端用户需求。',
      affectedJudgment: '终端需求判断',
      category: 'cross_source_incompatibility',
      provenance: 'rule_derived',
    },
  ];
}

export function hackerNewsLimitations(hasWeakSignal: boolean): DecisionLimitation[] {
  const limitations: DecisionLimitation[] = [
    {
      id: 'lim-hn-sampling-bias',
      statement: 'Hacker News 样本偏向英语科技和开发者社区，不能代表大众市场。',
      affectedJudgment: '大众市场代表性判断',
      category: 'sampling_bias',
      provenance: 'rule_derived',
    },
    {
      id: 'lim-hn-post-scope',
      statement: 'Points 和 comments 只能反映单条帖子的社区互动。',
      affectedJudgment: '需求强度与趋势判断',
      category: 'metric_scope',
      provenance: 'rule_derived',
    },
  ];
  if (hasWeakSignal) {
    limitations.push({
      id: 'lim-hn-weak-signal',
      statement: '当前讨论信号较弱，不足以支持需求强度或趋势判断。',
      affectedJudgment: '需求强度与趋势判断',
      category: 'weak_signal',
      provenance: 'rule_derived',
    });
  }
  return limitations;
}

export function knowledgeBaseLimitation(): DecisionLimitation {
  return {
    id: 'lim-knowledge-base-non-external',
    statement: 'HotPulse 内部知识库用于辅助解释，不属于独立外部市场证据。',
    affectedJudgment: '外部证据独立性判断',
    category: 'knowledge_base_only',
    provenance: 'knowledge_base',
  };
}

export function buildRiskFromRule(
  input: {
    id: string;
    category: string;
    statement: string;
    score?: number;
  },
): DecisionRisk | null {
  if (typeof input.score !== 'number' || !Number.isFinite(input.score)) return null;
  return {
    id: input.id,
    category: input.category,
    level: riskLevelFromScore(input.score),
    statement: input.statement,
    basis: '基于当前产品类型与现有风险规则生成，尚非外部验证事实。',
    provenance: 'rule_derived',
  };
}

export function buildRiskFlagRuleRisk(flag: string, index: number): DecisionRisk | null {
  const value = asNonEmptyString(flag);
  if (!value) return null;
  const category = inferRiskCategoryFromStatement(value) ?? 'rule_flag';
  return {
    id: `risk-flag-${index + 1}`,
    category,
    level: 'unknown',
    statement: value,
    basis: '基于现有风险标签字段整理，尚非外部验证事实。',
    provenance: 'rule_derived',
  };
}

export function normalizeRiskStatement(statement: string): string {
  return statement
    .trim()
    .toLowerCase()
    .replace(/[，,。；;:：\s]+/g, ' ')
    .trim();
}

export function inferRiskCategoryFromStatement(statement: string): string | null {
  const text = normalizeRiskStatement(statement);
  if (text.includes('支付')) return 'payment';
  if (text.includes('本地化')) return 'localization';
  if (text.includes('分发') || text.includes('获客')) return 'distribution';
  if (text.includes('合规') || text.includes('规则')) return 'compliance';
  if (text.includes('ai') || text.includes('成本')) return 'ai_cost';
  if (text.includes('竞争')) return 'competition';
  return null;
}

export function riskDedupKey(risk: Pick<DecisionRisk, 'category' | 'statement'>): string {
  return `${risk.category}::${normalizeRiskStatement(risk.statement)}`;
}

export function uniquePushById<T extends { id: string }>(target: T[], incoming: T[]) {
  const seen = new Set(target.map((item) => item.id));
  for (const item of incoming) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    target.push(item);
  }
}

export function uniqueLimitationCategoryKey(limitation: {
  category: LimitationCategory;
  statement: string;
}): string {
  return `${limitation.category}::${limitation.statement}`;
}
