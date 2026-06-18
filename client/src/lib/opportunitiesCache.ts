import type { HotItem, ProviderStats } from '../types/hot';
import { resolveOpportunityDataTier, type OpportunityDataTier } from '../types/opportunityDetail';

export type OpportunitiesDataSource = OpportunityDataTier;

export interface OpportunitiesCacheEntry {
  source: OpportunitiesDataSource;
  opportunities: HotItem[];
  providerStats?: ProviderStats;
  generatedAt?: string;
  retrievedAt: string;
}

export type OpportunitiesCacheStore = Partial<Record<OpportunitiesDataSource, OpportunitiesCacheEntry>>;

function isHotItemArray(value: unknown): value is HotItem[] {
  return Array.isArray(value) && value.every((item) => (
    item
    && typeof item === 'object'
    && typeof (item as { id?: unknown }).id === 'string'
    && typeof (item as { title?: unknown }).title === 'string'
  ));
}

function withBatchDataTier(items: HotItem[], dataTier: OpportunitiesDataSource): HotItem[] {
  return items.map((item) => ({
    ...item,
    dataTier,
  }));
}

/**
 * Cache source is the single authority for the cached batch.
 * Item-level dataTier is always overwritten from cache.source.
 */
export function normalizeCachedOpportunitiesEntry(
  cached: unknown,
  expectedSource: OpportunitiesDataSource,
): OpportunitiesCacheEntry | null {
  if (!cached || typeof cached !== 'object') return null;
  const candidate = cached as Partial<OpportunitiesCacheEntry> & { source?: unknown; opportunities?: unknown };
  if (typeof candidate.source !== 'string') return null;
  if (typeof candidate.retrievedAt !== 'string') return null;
  if (!isHotItemArray(candidate.opportunities)) return null;

  const resolvedTier = resolveOpportunityDataTier(candidate.source);
  if (!resolvedTier) return null;
  if (resolvedTier !== expectedSource) return null;

  return {
    source: resolvedTier,
    opportunities: withBatchDataTier(candidate.opportunities, resolvedTier),
    providerStats: candidate.providerStats,
    generatedAt: candidate.generatedAt,
    retrievedAt: candidate.retrievedAt,
  };
}

