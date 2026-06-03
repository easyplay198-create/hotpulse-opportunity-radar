import { fetchOpportunities } from './fetchOpportunities';
import { buildHotspotListFromItems } from './getHotspotList';
import type { HotListResponse } from '../types/hot';

export async function getHotspotListFromApi(source?: 'hn' | 'real'): Promise<HotListResponse> {
  const response = await fetchOpportunities(source);

  if (!response || !Array.isArray(response.items)) {
    throw new Error('Invalid opportunities response');
  }

  return {
    ...buildHotspotListFromItems(response.items),
    providerStats: response.providerStats,
  };
}
