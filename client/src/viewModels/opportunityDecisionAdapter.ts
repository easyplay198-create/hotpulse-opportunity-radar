import type { EvidenceItem, EvidenceStrength, HotItem } from '../types/hot';
import type {
  DecisionLimitation,
  DecisionObservation,
  DecisionProvenance,
  DecisionRisk,
  OpportunityDecisionV1,
  SupportedClaim,
} from '../types/opportunityDecision';
import {
  appStoreLimitations,
  buildRiskFlagRuleRisk,
  buildRiskFromRule,
  confidenceFromSourceType,
  DECISION_DISCLAIMERS,
  formatCompactCount,
  formatLocaleCount,
  githubLimitations,
  hackerNewsLimitations,
  inferObservationProvenance,
  inferDecisionSourceType,
  isValidHttpUrl,
  isValidIsoTime,
  knowledgeBaseLimitation,
  latestRetrievedAtFromValues,
  riskDedupKey,
  toDateLabel,
  uniqueLimitationCategoryKey,
} from '../lib/opportunityDecisionRules';
import { buildAnalyzeHrefFromOpportunity } from '../lib/opportunityAnalyzeHref';
import { toPublicBrandText } from '../lib/publicBrand';
import { buildKeyValidationQuestions, keyQuestionsAreSafe } from '../lib/opportunityValidationQuestions';
import { makeAction24hFallback, makeAction7dFallback, safeText, toScoreBand, verdictFromHotVerdict, type OpportunityDecisionVM, type StandardEvidenceItem, type StandardRiskItem } from './decisionViewModels';

interface ObservationRow {
  observation: DecisionObservation;
  sourceType: string;
  evidence: EvidenceItem;
}

interface AppStoreMetrics {
  rating?: number;
  ratingCount?: number;
}

interface GithubMetrics {
  stars?: number;
  forks?: number;
}

interface HackerNewsMetrics {
  points?: number;
  comments?: number;
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function parseAppStoreMetrics(evidence: EvidenceItem): AppStoreMetrics {
  const metadata = evidence.metadata ?? {};
  const rating = typeof metadata.rating === 'number' ? metadata.rating : undefined;
  const reviewCount = typeof metadata.reviewCount === 'number' ? metadata.reviewCount : undefined;
  const ratingCount = typeof metadata.ratingCount === 'number' ? metadata.ratingCount : undefined;
  return {
    rating,
    ratingCount: reviewCount ?? ratingCount,
  };
}

function parseGithubMetrics(evidence: EvidenceItem): GithubMetrics {
  const metadata = evidence.metadata ?? {};
  return {
    stars: typeof metadata.stars === 'number' ? metadata.stars : undefined,
    forks: typeof metadata.forks === 'number' ? metadata.forks : undefined,
  };
}

function parseHackerNewsMetrics(evidence: EvidenceItem): HackerNewsMetrics {
  const metadata = evidence.metadata ?? {};
  return {
    points: typeof metadata.points === 'number' ? metadata.points : undefined,
    comments: typeof metadata.commentsCount === 'number' ? metadata.commentsCount : undefined,
  };
}

function buildValueLabel(evidence: EvidenceItem, sourceType: string): string | undefined {
  if (sourceType === 'app_store') {
    const metrics = parseAppStoreMetrics(evidence);
    if (typeof metrics.rating === 'number' && metrics.rating > 0) {
      if (typeof metrics.ratingCount === 'number' && metrics.ratingCount > 0) {
        return `评分 ${metrics.rating.toFixed(2)} / 5 · ${formatLocaleCount(metrics.ratingCount)} 条评价`;
      }
      return `评分 ${metrics.rating.toFixed(2)} / 5`;
    }
    if (typeof metrics.ratingCount === 'number' && metrics.ratingCount > 0) {
      return `${formatLocaleCount(metrics.ratingCount)} 条评价`;
    }
  }
  if (sourceType === 'github') {
    const metrics = parseGithubMetrics(evidence);
    if (typeof metrics.stars === 'number' && metrics.stars > 0) {
      if (typeof metrics.forks === 'number' && metrics.forks > 0) {
        return `${formatCompactCount(metrics.stars)} Stars · ${formatCompactCount(metrics.forks)} Forks`;
      }
      return `${formatCompactCount(metrics.stars)} Stars`;
    }
    if (typeof metrics.forks === 'number' && metrics.forks > 0) {
      return `${formatCompactCount(metrics.forks)} Forks`;
    }
  }
  if (sourceType === 'hacker_news') {
    const metrics = parseHackerNewsMetrics(evidence);
    if (typeof metrics.points === 'number') {
      if (typeof metrics.comments === 'number' && metrics.comments >= 0) {
        return `${metrics.points} points · ${metrics.comments} comments`;
      }
      return `${metrics.points} points`;
    }
  }
  return undefined;
}

function buildObservationRows(item: HotItem): ObservationRow[] {
  return (item.evidence ?? []).map((evidence, index) => {
    const sourceName = toPublicBrandText(asNonEmptyString(evidence.source) ?? 'Unknown Source');
    const sourceType = inferDecisionSourceType(evidence);
    const provenance = inferObservationProvenance(evidence);
    const sourceUrl = isValidHttpUrl(evidence.url) ? evidence.url : undefined;
    const retrievedAt = isValidIsoTime(evidence.retrievedAt) ? evidence.retrievedAt : undefined;
    return {
      sourceType,
      evidence,
      observation: {
        id: `obs-${item.id}-${index + 1}`,
        sourceName,
        sourceType,
        title: asNonEmptyString(evidence.title) ?? `${sourceName} signal`,
        valueLabel: buildValueLabel(evidence, sourceType),
        sourceUrl,
        retrievedAt,
        provenance,
      },
    };
  });
}

function maxEvidenceStrength(item: HotItem): EvidenceStrength | 'insufficient' {
  const rank: Record<EvidenceStrength, number> = {
    high: 3,
    medium: 2,
    low: 1,
  };
  let result: EvidenceStrength | 'insufficient' = 'insufficient';
  let best = 0;
  for (const evidence of item.evidence ?? []) {
    const strength = evidence.evidenceStrength;
    if (strength && rank[strength] > best) {
      result = strength;
      best = rank[strength];
    }
  }
  return result;
}

function hasWeakHackerNewsSignal(item: HotItem): boolean {
  return (item.evidence ?? []).some((evidence) => {
    if (inferDecisionSourceType(evidence) !== 'hacker_news') return false;
    const points = parseHackerNewsMetrics(evidence).points;
    return typeof points === 'number' && points < 10;
  });
}

function isObservedExternalSource(sourceType: string, provenance: DecisionObservation['provenance']): boolean {
  return provenance === 'observed' && sourceType !== 'knowledge_base' && sourceType !== 'unknown';
}

export function buildDecisionObservations(item: HotItem): DecisionObservation[] {
  return buildObservationRows(item).map((row) => row.observation);
}

export function buildSignalSummary(item: HotItem, observations: DecisionObservation[]): OpportunityDecisionV1['signalSummary'] {
  const observedSources = [...new Set(
    observations
      .filter((observation) => observation.provenance === 'observed')
      .map((observation) => observation.sourceName),
  )];
  if (observedSources.length > 0) {
    return {
      statement: `该条信号标题为“${item.title}”，当前记录包含来自 ${observedSources.join('、')} 的观测数据。`,
      provenance: 'observed',
    };
  }
  if (observations.some((observation) => observation.provenance === 'knowledge_base')) {
    return {
      statement: `该条信号标题为“${item.title}”，当前仅包含内部知识库补充信息，尚缺外部可观测记录。`,
      provenance: 'knowledge_base',
    };
  }
  return {
    statement: `该条信号标题为“${item.title}”，当前没有足够数据形成市场机会判断。`,
    provenance: 'unknown',
  };
}

export function buildSupportsClaims(item: HotItem): SupportedClaim[] {
  const rows = buildObservationRows(item);
  const claims: SupportedClaim[] = [];
  for (const row of rows) {
    if (row.observation.provenance !== 'observed') continue;
    if (!row.observation.sourceUrl) continue;
    const dateLabel = toDateLabel(row.observation.retrievedAt);
    if (!dateLabel) continue;
    const evidenceRefs = [row.observation.id];
    const confidence = confidenceFromSourceType(row.sourceType as Parameters<typeof confidenceFromSourceType>[0]);
    if (row.sourceType === 'app_store') {
      const metrics = parseAppStoreMetrics(row.evidence);
      if (typeof metrics.rating === 'number' && metrics.rating > 0) {
        claims.push({
          id: `claim-${row.observation.id}-rating`,
          statement: `截至 ${dateLabel}，该应用在 Apple App Store 的评分为 ${metrics.rating.toFixed(2)}/5。`,
          evidenceRefs,
          provenance: 'observed',
          confidence,
        });
      }
      if (typeof metrics.ratingCount === 'number' && metrics.ratingCount > 0) {
        claims.push({
          id: `claim-${row.observation.id}-rating-count`,
          statement: `截至 ${dateLabel}，该应用存在 ${formatLocaleCount(metrics.ratingCount)} 条评分记录。`,
          evidenceRefs,
          provenance: 'observed',
          confidence,
        });
      }
    } else if (row.sourceType === 'github') {
      const metrics = parseGithubMetrics(row.evidence);
      if (typeof metrics.stars === 'number' && metrics.stars > 0) {
        claims.push({
          id: `claim-${row.observation.id}-stars`,
          statement: `截至 ${dateLabel}，该仓库有 ${formatCompactCount(metrics.stars)} Stars。`,
          evidenceRefs,
          provenance: 'observed',
          confidence,
        });
      }
      if (typeof metrics.forks === 'number' && metrics.forks > 0) {
        claims.push({
          id: `claim-${row.observation.id}-forks`,
          statement: `截至 ${dateLabel}，该仓库有 ${formatCompactCount(metrics.forks)} Forks。`,
          evidenceRefs,
          provenance: 'observed',
          confidence,
        });
      }
    } else if (row.sourceType === 'hacker_news') {
      const metrics = parseHackerNewsMetrics(row.evidence);
      if (typeof metrics.points === 'number') {
        claims.push({
          id: `claim-${row.observation.id}-points`,
          statement: `截至 ${dateLabel}，该帖子有 ${metrics.points} points。`,
          evidenceRefs,
          provenance: 'observed',
          confidence,
        });
      }
      if (typeof metrics.comments === 'number' && metrics.comments >= 0) {
        claims.push({
          id: `claim-${row.observation.id}-comments`,
          statement: `截至 ${dateLabel}，该帖子有 ${metrics.comments} comments。`,
          evidenceRefs,
          provenance: 'observed',
          confidence,
        });
      }
    }
  }
  return claims;
}

export function buildLimitations(item: HotItem, observations: DecisionObservation[]): DecisionLimitation[] {
  const limitations: DecisionLimitation[] = [];
  const observedSourceTypes = new Set(
    observations
      .filter((observation) => observation.provenance === 'observed')
      .map((observation) => observation.sourceType),
  );

  if (observedSourceTypes.has('app_store')) {
    limitations.push(...appStoreLimitations());
  }
  if (observedSourceTypes.has('github')) {
    limitations.push(...githubLimitations());
  }
  if (observedSourceTypes.has('hacker_news')) {
    limitations.push(...hackerNewsLimitations(hasWeakHackerNewsSignal(item)));
  }
  if (observations.some((observation) => observation.provenance === 'knowledge_base')) {
    limitations.push(knowledgeBaseLimitation());
  }
  if (!observations.some((observation) => observation.provenance === 'observed')) {
    limitations.push({
      id: 'lim-no-observed-evidence',
      statement: '当前缺少可引用的外部观测证据，无法形成更强判断。',
      affectedJudgment: '进入决策判断',
      category: 'missing_data',
      provenance: 'rule_derived',
    });
  }

  const seen = new Set<string>();
  return limitations.filter((limitation) => {
    const key = uniqueLimitationCategoryKey(limitation);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildWhyNow(item: HotItem, observations: DecisionObservation[]): OpportunityDecisionV1['whyNow'] {
  const latestRetrievedAt = latestRetrievedAtFromValues(observations.map((observation) => observation.retrievedAt));
  if (!latestRetrievedAt) {
    return {
      status: 'insufficient',
      statement: null,
      provenance: 'unknown',
    };
  }
  const observed = observations.filter((observation) => observation.provenance === 'observed');
  const onlyHackerNews = observed.length > 0 && observed.every((observation) => observation.sourceType === 'hacker_news');
  if (onlyHackerNews && hasWeakHackerNewsSignal(item)) {
    return {
      status: 'available',
      statement: '当前仅能确认该帖子在采集时存在，互动量不足以构成“为什么是现在”的判断依据。',
      provenance: 'rule_derived',
    };
  }
  const dateLabel = toDateLabel(latestRetrievedAt);
  if (!dateLabel) {
    return {
      status: 'insufficient',
      statement: null,
      provenance: 'unknown',
    };
  }
  return {
    status: 'available',
    statement: `该信号于 ${dateLabel} 获取；当前只能确认当时可追溯，验证前仍需确认其是否持续有效。`,
    provenance: 'observed',
  };
}

export function buildDecisionRisks(item: HotItem): DecisionRisk[] {
  const structuredRisks: DecisionRisk[] = [];
  const flagRisks: DecisionRisk[] = [];
  const mappedRiskDefs: Array<{
    id: string;
    category: string;
    statement: string;
    score?: number;
  }> = [
    {
      id: 'risk-payment',
      category: 'payment',
      statement: '支付路径待验证',
      score: item.paymentRisk,
    },
    {
      id: 'risk-localization',
      category: 'localization',
      statement: '本地化表达待验证',
      score: item.localizationRisk,
    },
    {
      id: 'risk-distribution',
      category: 'distribution',
      statement: '平台分发依赖',
      score: item.acquisitionRisk,
    },
    {
      id: 'risk-compliance',
      category: 'compliance',
      statement: '合规约束待确认',
      score: item.complianceRisk,
    },
    {
      id: 'risk-ai-cost',
      category: 'ai_cost',
      statement: 'AI 成本结构待测算',
      score: item.aiCostRisk,
    },
    {
      id: 'risk-competition',
      category: 'competition',
      statement: '竞争压力待验证',
      score: item.competitionRisk,
    },
  ];

  for (const riskDef of mappedRiskDefs) {
    const risk = buildRiskFromRule(riskDef);
    if (risk) structuredRisks.push(risk);
  }
  for (const [index, flag] of (item.riskFlags ?? []).entries()) {
    const risk = buildRiskFlagRuleRisk(flag, index);
    if (risk) flagRisks.push(risk);
  }
  const merged: DecisionRisk[] = [];
  const seen = new Map<string, DecisionRisk>();
  for (const risk of structuredRisks) {
    const key = riskDedupKey(risk);
    if (!seen.has(key)) {
      seen.set(key, risk);
      merged.push(risk);
    }
  }
  for (const risk of flagRisks) {
    const key = riskDedupKey(risk);
    if (!seen.has(key)) {
      seen.set(key, risk);
      merged.push(risk);
    }
  }
  return merged;
}

export function buildDecisionDataNotes(
  item: HotItem,
  observations: DecisionObservation[],
  risks: DecisionRisk[],
): OpportunityDecisionV1['dataNotes'] {
  const externalObservations = observations.filter((observation) =>
    isObservedExternalSource(observation.sourceType, observation.provenance));
  const externalSourceCount = new Set(externalObservations.map((observation) => observation.sourceName)).size;
  const knowledgeBaseEntryCount = observations.filter((observation) => observation.provenance === 'knowledge_base').length;
  const hasExternalSourceUrl = externalObservations.some((observation) => Boolean(observation.sourceUrl));
  const latestRetrievedAt = latestRetrievedAtFromValues(observations.map((observation) => observation.retrievedAt));

  const missingFields: string[] = [];
  if (!asNonEmptyString(item.productType)) missingFields.push('productType');
  if (!asNonEmptyString(item.targetMarket)) missingFields.push('targetMarket');
  if (externalObservations.length === 0) missingFields.push('observedEvidence');
  if (!hasExternalSourceUrl) missingFields.push('externalSourceUrl');
  if (!latestRetrievedAt) missingFields.push('retrievedAt');
  if (risks.length === 0) missingFields.push('riskSignals');

  return {
    externalSourceCount,
    knowledgeBaseEntryCount,
    hasExternalSourceUrl,
    latestRetrievedAt,
    missingFields: [...new Set(missingFields)],
    disclaimers: DECISION_DISCLAIMERS,
  };
}

export function buildValidationHandoff(
  item: HotItem,
  observations: DecisionObservation[] = buildDecisionObservations(item),
): OpportunityDecisionV1['validationHandoff'] {
  const productType = asNonEmptyString(item.productType) ?? asNonEmptyString(item.category);
  const targetMarket = asNonEmptyString(item.targetMarket);
  const analyzeHref = buildAnalyzeHrefFromOpportunity({
    id: item.id,
    title: item.title,
    productType,
    targetMarket,
    primarySource: asNonEmptyString(item.platformId),
    evidence: item.evidence ?? [],
    risks: item.riskFlags,
    summary: asNonEmptyString(item.summary),
    evidenceStrength: maxEvidenceStrength(item),
    riskHint: '主要风险待验证',
  });

  const keyQuestions = buildKeyValidationQuestions(observations, item.platformId).slice(0, 3);

  return {
    status: 'requires_user_context',
    statement: '需要结合目标用户、市场、预算、团队能力和资源条件，才能生成进入条件、停止条件与 24 小时/7 天验证方案。',
    analyzeHref: analyzeHref || undefined,
    keyQuestions: keyQuestionsAreSafe(keyQuestions) ? keyQuestions : [],
    questionsProvenance: 'rule_derived',
  };
}

export function buildOpportunityDecisionV1(item: HotItem): OpportunityDecisionV1 {
  const observations = buildDecisionObservations(item);
  const risks = buildDecisionRisks(item);
  const latestRetrievedAt = latestRetrievedAtFromValues(observations.map((observation) => observation.retrievedAt));
  const firstObserved = observations.find((observation) => observation.provenance === 'observed');
  const signalSummary = buildSignalSummary(item, observations);
  const signalProvenance: DecisionProvenance = signalSummary.provenance;

  return {
    schemaVersion: '1.0',
    identity: {
      id: item.id,
      signalTitle: item.title,
      primarySource: asNonEmptyString(item.platformId) ?? firstObserved?.sourceName,
      sourceUrl: firstObserved?.sourceUrl,
      retrievedAt: latestRetrievedAt,
      dataTier: item.dataTier,
      productType: asNonEmptyString(item.productType),
      targetMarket: asNonEmptyString(item.targetMarket),
    },
    signalSummary: {
      statement: signalSummary.statement,
      provenance: signalProvenance,
    },
    whyNow: buildWhyNow(item, observations),
    observations,
    supportsClaims: buildSupportsClaims(item),
    limitations: buildLimitations(item, observations),
    risks,
    validationHandoff: buildValidationHandoff(item, observations),
    dataNotes: buildDecisionDataNotes(item, observations, risks),
  };
}

// Legacy exports kept for compatibility with existing view-model consumers.
function buildLegacyEvidenceTimeline(item: HotItem): StandardEvidenceItem[] {
  return (item.evidence ?? []).slice(0, 5).map((evidence, index) => ({
    id: `legacy-evidence-${item.id}-${index + 1}`,
    source: safeText(evidence.source, 'unknown'),
    title: safeText(evidence.title, '证据'),
    fact: safeText(evidence.title, '证据摘要'),
    strength: evidence.evidenceStrength ?? 'unknown',
    url: isValidHttpUrl(evidence.url) ? evidence.url : undefined,
    time: isValidIsoTime(evidence.retrievedAt) ? evidence.retrievedAt : undefined,
    type: evidence.type,
    isDerived: true,
  }));
}

function buildLegacyRiskList(decision: OpportunityDecisionV1): StandardRiskItem[] {
  return decision.risks.slice(0, 6).map((risk) => ({
    id: risk.id,
    type: 'unknown',
    label: risk.category,
    level: risk.level === 'unknown' ? 'low' : risk.level,
    summary: risk.statement,
    source: 'derived',
  }));
}

export function buildOpportunityDecisionVM(item: HotItem): OpportunityDecisionVM {
  const decision = buildOpportunityDecisionV1(item);
  const score = item.valueScore ?? 0;
  const verdict = verdictFromHotVerdict(item.verdict);
  const confidence = decision.supportsClaims.length > 3
    ? 'high'
    : decision.supportsClaims.length > 1
    ? 'medium'
    : decision.supportsClaims.length > 0
    ? 'low'
    : 'unknown';
  const evidenceCount = decision.observations.length;
  const sources = [...new Set(
    decision.observations
      .filter((observation) => observation.provenance === 'observed')
      .map((observation) => observation.sourceName),
  )];
  const topRisks = buildLegacyRiskList(decision);
  const action24h = makeAction24hFallback('24 小时内先验证最小切口', 'derived');
  const action7d = makeAction7dFallback('7 天内完成小样本验证', 'derived');

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
    evidenceSummary: decision.signalSummary.statement,
    topRisks,
    evidenceTimeline: buildLegacyEvidenceTimeline(item),
    action24h,
    action7d,
    stopCondition: '连续 7 天无有效信号时暂停。',
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
      summary: decision.signalSummary.statement,
      topRisk: topRisks[0]?.label,
      nextAction: action24h.title,
    },
  };
}

export function buildOpportunityDecisionVMs(items: HotItem[]): OpportunityDecisionVM[] {
  return items.map((item) => buildOpportunityDecisionVM(item));
}
