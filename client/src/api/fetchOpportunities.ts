import type { HotspotItem } from '../types/hotspot';

export interface ProviderStatItem {
  ok: boolean;
  count?: number;
  fetchedCount?: number;
  returnedCount?: number;
  error?: string;
  skippedReason?: string;
}

export interface OpportunitiesResponse {
  source: 'mock' | 'hacker-news' | 'real' | 'fallback';
  generatedAt?: string;
  count: number;
  items: HotspotItem[];
  providerStats?: {
    hackerNews?: ProviderStatItem;
    appStore?: ProviderStatItem;
    github?: ProviderStatItem;
    productHunt?: ProviderStatItem;
  };
}

function getApiBase() {
  const base = import.meta.env.VITE_API_BASE?.trim();
  if (!base) return '';
  return base.replace(/\/$/, '');
}

export async function fetchOpportunities(source?: 'hn' | 'real'): Promise<OpportunitiesResponse> {
  const query = source === 'hn' ? '?source=hn' : source === 'real' ? '?source=real' : '';
  const base = getApiBase();
  const response = await fetch(`${base}/api/opportunities${query}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch opportunities: ${response.status}`);
  }

  const data = (await response.json()) as OpportunitiesResponse;

  if (!data || !Array.isArray(data.items)) {
    throw new Error('Invalid opportunities payload: items must be an array');
  }

  if (typeof data.count !== 'number') {
    throw new Error('Invalid opportunities payload: count must be a number');
  }

  if (data.count !== data.items.length) {
    throw new Error('Invalid opportunities payload: count does not match items length');
  }

  return data;
}
