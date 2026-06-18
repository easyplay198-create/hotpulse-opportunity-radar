import { fetchOpportunities } from './fetchOpportunities';
import { buildHotspotListFromItems } from './getHotspotList';
import type { HotListResponse } from '../types/hot';
import { resolveOpportunityDataTier, type OpportunityDataTier } from '../types/opportunityDetail';

export function resolveResponseDataTierOrThrow(source: string): OpportunityDataTier {
  // Response source decides a single batch-level tier.
  // Unknown source must be rejected before any item mapping.
  const tier = resolveOpportunityDataTier(source);
  if (!tier) {
    throw new Error(`Unsupported opportunities source: ${source || '<empty>'}`);
  }
  return tier;
}

export async function getHotspotListFromApi(source?: 'hn' | 'real'): Promise<HotListResponse> {
  const response = await fetchOpportunities(source);

  if (!response || !Array.isArray(response.items)) {
    throw new Error('Invalid opportunities response');
  }

  const dataTier = resolveResponseDataTierOrThrow(response.source);

  return {
    ...buildHotspotListFromItems(response.items, {
      dataTier,
    }),
    providerStats: response.providerStats,
  };
}
