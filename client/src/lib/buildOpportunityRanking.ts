interface RankingInput {
  id?: string;
  title?: string;
  source?: string;
  platformId?: string;
  category?: string;
  discoveryScore?: number;
  valueScore?: number;
  score?: number;
  heat?: number;
  interaction?: number;
  evidence?: unknown[];
  tags?: unknown[];
  riskFlags?: unknown[];
}

interface RankingResult {
  rank: number;
  rankingScore: number;
  similarSignalCount: number;
  sourceCoverage: string[];
  recommendationReasons: string[];
  rankingReason: string;
}

function toScore(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function extractEvidenceSource(item: unknown): string | null {
  if (!item || typeof item !== 'object') return null;

  const record = item as Record<string, unknown>;
  const source = record.source;

  return typeof source === 'string' && source.trim() ? source : null;
}

function buildSourceCoverage(item: RankingInput): string[] {
  const sources = new Set<string>();

  if (item.source) sources.add(item.source);
  if (item.platformId) sources.add(item.platformId);

  toArray(item.evidence).forEach((evidenceItem) => {
    const evidenceSource = extractEvidenceSource(evidenceItem);
    if (evidenceSource) sources.add(evidenceSource);
  });

  return sources.size > 0 ? Array.from(sources) : ['待补充'];
}

function buildReasons(
  item: RankingInput,
  evidenceCount: number,
  sourceCoverage: string[],
  riskCount: number,
): string[] {
  const reasons: string[] = [];

  if (toScore(item.discoveryScore ?? item.valueScore ?? item.score) >= 75) {
    reasons.push('综合机会分较高');
  }

  if (evidenceCount > 0) {
    reasons.push('已有可追溯信号');
  }

  if (sourceCoverage.length >= 2) {
    reasons.push('来源覆盖较好');
  }

  if (riskCount > 0) {
    reasons.push('已识别进入风险');
  }

  return reasons.length > 0 ? reasons : ['建议先做小样本验证'];
}

export function buildOpportunityRanking<T extends RankingInput>(items: T[] = []): Map<string, RankingResult> {
  const sorted = [...items].sort((a, b) => {
    const scoreA = toScore(a.discoveryScore ?? a.valueScore ?? a.score);
    const scoreB = toScore(b.discoveryScore ?? b.valueScore ?? b.score);
    return scoreB - scoreA;
  });

  const ranking = new Map<string, RankingResult>();

  sorted.forEach((item, index) => {
    if (!item.id) return;

    const baseScore = toScore(item.discoveryScore ?? item.valueScore ?? item.score);
    const evidenceCount = toArray(item.evidence).length;
    const tagCount = toArray(item.tags).length;
    const riskCount = toArray(item.riskFlags).length;
    const sourceCoverage = buildSourceCoverage(item);
    const similarSignalCount = Math.max(1, evidenceCount + tagCount);
    const recommendationReasons = buildReasons(item, evidenceCount, sourceCoverage, riskCount);

    ranking.set(item.id, {
      rank: index + 1,
      rankingScore: Math.max(0, Math.min(100, baseScore)),
      similarSignalCount,
      sourceCoverage,
      recommendationReasons,
      rankingReason: recommendationReasons.join(' / '),
    });
  });

  return ranking;
}
