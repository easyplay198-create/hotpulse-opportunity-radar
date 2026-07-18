import type { EvidenceItem, HotItem } from '../types/hot';
import type {
  EvidenceProvenance,
  EvidenceSourceCategory,
  NormalizedEvidence,
  OpportunityDetailRiskItem,
  OpportunityDetailViewModel,
} from '../types/opportunityDetail';
import { toPublicBrandText } from '../lib/publicBrand';

const EXTERNAL_PROVIDER_SOURCE_MAP: Array<{ pattern: RegExp; sourceType: EvidenceSourceCategory }> = [
  { pattern: /^apple app store$/i, sourceType: 'app_store' },
  { pattern: /^hacker news$/i, sourceType: 'community' },
  { pattern: /^github$/i, sourceType: 'developer' },
  { pattern: /^product hunt$/i, sourceType: 'product_launch' },
  { pattern: /^gdelt$/i, sourceType: 'news' },
];

const KNOWLEDGE_BASE_SOURCE_PATTERN = /^(?:hotpulse|praxon) market knowledge$/i;
const EVIDENCE_STRENGTH_RANK = {
  high: 3,
  medium: 2,
  low: 1,
} as const;

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function isValidHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const raw = value.trim();
  if (!raw) return false;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isValidIsoTime(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time);
}

function normalizeEvidenceStrength(value: unknown): 'high' | 'medium' | 'low' {
  if (value === 'high' || value === 'medium' || value === 'low') return value;
  return 'low';
}

export function mapEvidenceSourceCategory(sourceName: string): EvidenceSourceCategory {
  const source = sourceName.trim();
  if (!source) return 'unknown';
  if (KNOWLEDGE_BASE_SOURCE_PATTERN.test(source)) return 'knowledge_base';
  const mapped = EXTERNAL_PROVIDER_SOURCE_MAP.find((entry) => entry.pattern.test(source));
  return mapped?.sourceType ?? 'unknown';
}

export function mapEvidenceProvenance(evidence: EvidenceItem): EvidenceProvenance {
  const sourceName = asNonEmptyString(evidence.source) ?? '';
  if (!sourceName) return 'unknown';
  if (KNOWLEDGE_BASE_SOURCE_PATTERN.test(sourceName) || evidence.metadata?.knowledgeType === 'static_market_entry') {
    return 'knowledge_base';
  }
  const sourceCategory = mapEvidenceSourceCategory(sourceName);
  if (sourceCategory !== 'unknown' && sourceCategory !== 'knowledge_base') {
    return 'observed';
  }
  return 'unknown';
}

export function normalizeEvidence(evidence: EvidenceItem): NormalizedEvidence {
  const rawSourceName = asNonEmptyString(evidence.source) ?? 'Unknown Source';
  const sourceName = toPublicBrandText(rawSourceName);
  const sourceType = mapEvidenceSourceCategory(rawSourceName);
  const sourceUrl = isValidHttpUrl(evidence.url) ? evidence.url : undefined;
  const retrievedAt = isValidIsoTime(evidence.retrievedAt) ? evidence.retrievedAt : undefined;

  return {
    title: asNonEmptyString(evidence.title) ?? 'Untitled Evidence',
    sourceName,
    sourceType,
    sourceUrl,
    retrievedAt,
    strength: normalizeEvidenceStrength(evidence.evidenceStrength),
    provenance: mapEvidenceProvenance(evidence),
    metadata: evidence.metadata as Record<string, unknown> | undefined,
  };
}

export function computeEvidenceStrength(evidenceList: NormalizedEvidence[]): 'high' | 'medium' | 'low' | 'insufficient' {
  if (evidenceList.length === 0) return 'insufficient';
  const bestRank = evidenceList.reduce((max, evidence) => Math.max(max, EVIDENCE_STRENGTH_RANK[evidence.strength]), 0);
  if (bestRank >= EVIDENCE_STRENGTH_RANK.high) return 'high';
  if (bestRank >= EVIDENCE_STRENGTH_RANK.medium) return 'medium';
  return 'low';
}

export function riskLevelFromScore(score?: number): 'high' | 'medium' | 'low' | 'unknown' {
  if (typeof score !== 'number' || !Number.isFinite(score)) return 'unknown';
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

function normalizeRisks(item: HotItem): OpportunityDetailRiskItem[] {
  const risks: Array<{ category: string; score: number | undefined }> = [
    { category: 'payment', score: item.paymentRisk },
    { category: 'localization', score: item.localizationRisk },
    { category: 'competition', score: item.competitionRisk },
    { category: 'compliance', score: item.complianceRisk },
    { category: 'acquisition', score: item.acquisitionRisk },
    { category: 'ai_cost', score: item.aiCostRisk },
  ];

  return risks.map((risk) => ({
    category: risk.category,
    level: riskLevelFromScore(risk.score),
    score: typeof risk.score === 'number' && Number.isFinite(risk.score) ? risk.score : undefined,
    provenance: 'unknown',
  }));
}

function latestRetrievedAt(evidenceList: NormalizedEvidence[]): string | undefined {
  const times = evidenceList
    .map((evidence) => (evidence.retrievedAt ? new Date(evidence.retrievedAt).getTime() : NaN))
    .filter((time) => Number.isFinite(time));
  if (times.length === 0) return undefined;
  const latest = Math.max(...times);
  return new Date(latest).toISOString();
}

export function buildOpportunityDetailViewModel(item: HotItem): OpportunityDetailViewModel {
  const evidence = (item.evidence ?? []).map(normalizeEvidence);
  const sourceSet = new Set(evidence.map((entry) => entry.sourceName).filter(Boolean));
  const latestTime = latestRetrievedAt(evidence);

  const missingFields: string[] = [];
  if (!asNonEmptyString(item.productType)) missingFields.push('productType');
  if (!asNonEmptyString(item.targetMarket)) missingFields.push('targetMarket');
  if (evidence.length === 0) missingFields.push('evidence');
  if (evidence.length > 0 && evidence.some((entry) => !entry.sourceUrl)) missingFields.push('sourceUrl');
  if (!latestTime && evidence.length > 0) missingFields.push('retrievedAt');

  return {
    identity: {
      id: item.id,
      title: item.title,
      productType: asNonEmptyString(item.productType),
      targetMarket: asNonEmptyString(item.targetMarket),
      primarySource: asNonEmptyString(item.platformId) ?? evidence[0]?.sourceName,
      dataTier: item.dataTier,
      latestRetrievedAt: latestTime,
    },
    signal: {
      evidenceStrength: computeEvidenceStrength(evidence),
    },
    evidence,
    risks: normalizeRisks(item),
    dataNotes: {
      evidenceCount: evidence.length,
      sourceCount: sourceSet.size,
      missingFields,
    },
  };
}
