import type { EvidenceItem, EvidenceStrength, HotItem } from '../../types/hot';
import type { OpportunityDataTier } from '../../types/opportunityDetail';

export type PublicSortKey = 'score' | 'latest' | 'evidence' | 'heat';
export type PublicSignalPreset = 'composite' | 'strongEvidence' | 'latest' | 'heat';

export const PUBLIC_SORT_OPTIONS: Array<{ value: PublicSortKey; label: string }> = [
  { value: 'score', label: '默认顺序' },
  { value: 'latest', label: '最新采集时间' },
  { value: 'evidence', label: '证据强度排序' },
  { value: 'heat', label: '热度排序' },
];

export const PUBLIC_SIGNAL_PRESETS: Array<{ value: PublicSignalPreset; label: string }> = [
  { value: 'composite', label: '默认视角' },
  { value: 'strongEvidence', label: '证据较强榜' },
  { value: 'latest', label: '最新发现榜' },
  { value: 'heat', label: '热度榜' },
];

export function mapEvidenceStrengthLabel(
  strength: EvidenceStrength | 'unknown' | 'insufficient' | 'all',
): string {
  if (strength === 'high') return '强证据';
  if (strength === 'medium') return '中等证据';
  if (strength === 'low') return '弱证据';
  if (strength === 'insufficient' || strength === 'unknown') return '证据不足';
  return '全部证据';
}

export function mapDataTierLabel(dataTier: OpportunityDataTier): string {
  if (dataTier === 'real') return '真实信号';
  if (dataTier === 'mock') return '演示数据';
  return '降级样本';
}

export function sortByInternalScore<T extends Pick<HotItem, 'valueScore'>>(items: T[]): T[] {
  return [...items].sort((a, b) => b.valueScore - a.valueScore);
}

function sanitizeScoreDerivedTerms(text: string): string {
  return text
    .replace(/综合评分\s*\d+/gi, '')
    .replace(/综合分\s*\d+/gi, '')
    .replace(/机会分\s*\d+/gi, '')
    .replace(/\b(do_now|watch|skip)\b/gi, '')
    .replace(/[，,]\s*[，,]/g, '，')
    .replace(/^[，,\s]+|[，,\s]+$/g, '')
    .trim();
}

export function buildPublicAnalyzeQuery(options: {
  title: string;
  productType: string;
  targetMarket?: string;
  summary?: string;
  evidenceStrength: EvidenceStrength | 'unknown' | 'insufficient';
  riskHint: string;
}): string {
  const raw = [
    options.title,
    options.productType,
    options.targetMarket ? `目标市场：${options.targetMarket}` : '',
    options.summary ?? '',
    `证据强度：${mapEvidenceStrengthLabel(options.evidenceStrength)}`,
    `风险提示：${options.riskHint}`,
  ].filter(Boolean).join('，').slice(0, 600);
  return sanitizeScoreDerivedTerms(raw);
}

export interface PublicAnalyzeOpportunityInput {
  id: string;
  title: string;
  productType: string;
  hasKnownMarket: boolean;
  targetMarket: string;
  summary?: string;
  evidenceStrength: EvidenceStrength | 'unknown' | 'insufficient';
  riskHint: string;
}

export function buildAnalyzeHrefFromOpportunity(
  opportunity: PublicAnalyzeOpportunityInput | undefined,
  source: OpportunityDataTier = 'mock',
): string {
  const sourceQuery = `source=${encodeURIComponent(source)}`;
  if (!opportunity) return `/analyze?${sourceQuery}`;
  const market = opportunity.hasKnownMarket ? opportunity.targetMarket : '';
  const query = buildPublicAnalyzeQuery({
    title: opportunity.title,
    productType: opportunity.productType,
    targetMarket: market || undefined,
    summary: opportunity.summary,
    evidenceStrength: opportunity.evidenceStrength,
    riskHint: opportunity.riskHint,
  });
  const params = new URLSearchParams();
  params.set('source', 'real');
  params.set('auto', '1');
  params.set('opportunityId', opportunity.id);
  params.set('q', query);
  if (market) params.set('targetMarket', market);
  if (opportunity.productType) params.set('productType', opportunity.productType);
  return `/analyze?${params.toString()}`;
}

// ── Provenance-first display helpers ─────────────────────────────────────

/** Source names treated as internal knowledge base, never shown as external observed. */
export const KNOWLEDGE_BASE_SOURCE_NAMES: ReadonlySet<string> = new Set([
  'HotPulse Market Knowledge',
]);

/** The provenance label displayed alongside rule-derived risks on cards and drawer. */
export const RISK_PROVENANCE_LABEL = '规则推导';

/** Static disclaimer shown in the drawer risk zone. */
export const RISK_RULE_DISCLAIMER = '系统根据类目与现有字段自动推导，尚非外部验证事实';

type EvidenceLike = Pick<EvidenceItem, 'source' | 'metadata'>;
type EvidenceWithTitle = Pick<EvidenceItem, 'source' | 'metadata' | 'title'>;
type EvidenceWithUrl = Pick<EvidenceItem, 'source' | 'metadata' | 'title' | 'url'>;

export function isKnowledgeBaseEvidence(ev: EvidenceLike): boolean {
  const src = ev.source?.trim() ?? '';
  if (KNOWLEDGE_BASE_SOURCE_NAMES.has(src)) return true;
  const kt = ev.metadata?.['knowledgeType'];
  return typeof kt === 'string' && kt.length > 0;
}

/**
 * Returns the primary external source name for card display.
 * Filters out knowledge_base sources. Never returns "HotPulse Market Knowledge".
 */
export function pickCardPrimarySource(
  evidence: EvidenceLike[],
  platformId?: string,
): string {
  if (platformId?.trim()) return platformId.trim();
  for (const ev of evidence) {
    if (!isKnowledgeBaseEvidence(ev) && ev.source?.trim()) {
      return ev.source.trim();
    }
  }
  return '';
}

/**
 * Returns false for Global, unknown, empty, or placeholder market values.
 * Card and drawer should not display these.
 */
export function shouldShowMarket(market: string | undefined | null): boolean {
  if (!market?.trim()) return false;
  const m = market.trim();
  if (/^(global|unknown|n\/a|na)$/i.test(m)) return false;
  if (['未明确', '待确认', '市场待确认'].includes(m)) return false;
  return true;
}

export interface CardObservation {
  sourceName: string;
  /** Single compact line, e.g. "4.83/5 · 477,572 条评价" */
  metricsLine: string | null;
  /** Fallback: evidence title when no structured metadata */
  fallbackTitle: string | null;
}

export interface DrawerObsRow {
  sourceName: string;
  /** Large primary display value, e.g. "4.83 / 5" or "220 points" */
  primaryValue: string;
  secondaryValue?: string;
  isWeakSignal?: boolean;
  rawUrl?: string | null;
}

export interface KBEntry {
  source: string;
  title: string;
}

function fmtLocale(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return n.toLocaleString('en-US');
  return String(n);
}

function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 100) / 10}k`;
  return String(n);
}

function buildObsMetrics(
  ev: EvidenceLike,
): { primary: string; secondary?: string; isWeak?: boolean } | null {
  const meta = ev.metadata;
  if (!meta) return null;
  const rating = typeof meta['rating'] === 'number' ? meta['rating'] : null;
  // Accept both reviewCount and ratingCount (App Store API may use either field name)
  const reviewCount = typeof meta['reviewCount'] === 'number'
    ? meta['reviewCount']
    : typeof meta['ratingCount'] === 'number'
    ? meta['ratingCount']
    : null;
  const points = typeof meta['points'] === 'number' ? meta['points'] : null;
  const commentsCount = typeof meta['commentsCount'] === 'number' ? meta['commentsCount'] : null;
  const stars = typeof meta['stars'] === 'number' ? meta['stars'] : null;
  const forks = typeof meta['forks'] === 'number' ? meta['forks'] : null;

  if (rating !== null && rating > 0) {
    return {
      primary: `${rating.toFixed(2)} / 5`,
      secondary: reviewCount && reviewCount > 0 ? `${fmtLocale(reviewCount)} 条评价` : undefined,
    };
  }
  if (points !== null) {
    if (points <= 5) return { primary: `公开讨论较弱 · 当前 ${points} points`, isWeak: true };
    return {
      primary: `${points} points`,
      secondary: commentsCount && commentsCount > 0 ? `${commentsCount} comments` : undefined,
    };
  }
  if (stars !== null && stars > 0) {
    return {
      primary: `${fmtCompact(stars)} Stars`,
      secondary: forks && forks > 0 ? `${fmtCompact(forks)} Forks` : undefined,
    };
  }
  return null;
}

/**
 * Compact observation lines for card display (max 2, excludes knowledge_base).
 * Card shows a single combined metrics line per source.
 */
export function getCardObservations(evidence: EvidenceWithTitle[]): CardObservation[] {
  const seen = new Set<string>();
  const result: CardObservation[] = [];
  for (const ev of evidence) {
    if (isKnowledgeBaseEvidence(ev)) continue;
    const src = ev.source?.trim() ?? '';
    if (seen.has(src)) continue;
    seen.add(src);
    const m = buildObsMetrics(ev);
    const metricsLine = m
      ? m.secondary ? `${m.primary} · ${m.secondary}` : m.primary
      : null;
    result.push({
      sourceName: src || '外部来源',
      metricsLine,
      fallbackTitle: metricsLine ? null : (ev.title?.trim() || null),
    });
    if (result.length >= 2) break;
  }
  return result;
}

/**
 * Structured rows for the drawer's observed zone (one per unique external source).
 * Primary and secondary values are kept separate for larger display.
 */
export function getDrawerObservedRows(evidence: EvidenceWithUrl[]): DrawerObsRow[] {
  const seen = new Set<string>();
  const result: DrawerObsRow[] = [];
  for (const ev of evidence) {
    if (isKnowledgeBaseEvidence(ev)) continue;
    const src = ev.source?.trim() ?? '';
    if (seen.has(src)) continue;
    seen.add(src);
    const m = buildObsMetrics(ev);
    result.push({
      sourceName: src || '外部来源',
      primaryValue: m?.primary ?? ev.title?.trim() ?? '无指标数据',
      secondaryValue: m?.secondary,
      isWeakSignal: m?.isWeak,
      rawUrl: ev.url ?? null,
    });
  }
  return result;
}

/**
 * Returns knowledge_base entries for the drawer's internal supplement section.
 * These must never appear in card-level display as external sources.
 */
export function getKnowledgeBaseEntries(evidence: EvidenceWithTitle[]): KBEntry[] {
  return evidence
    .filter((ev) => isKnowledgeBaseEvidence(ev))
    .map((ev) => ({
      source: ev.source?.trim() || 'HotPulse Market Knowledge',
      title: ev.title?.trim() || '市场知识库',
    }));
}

