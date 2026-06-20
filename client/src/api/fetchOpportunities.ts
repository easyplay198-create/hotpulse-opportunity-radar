import type { HotspotItem } from '../types/hotspot';

export interface ProviderStatItem {
  ok: boolean;
  configured?: boolean;
  count?: number;
  fetchedCount?: number;
  returnedCount?: number;
  requestedCount?: number;
  rawCount?: number;
  mappedCount?: number;
  validCount?: number;
  selectedCount?: number;
  finalCount?: number;
  droppedCount?: number;
  dropReasons?: Record<string, number>;
  latencyMs?: number;
  httpStatus?: number;
  errorClass?: string;
  rateLimited?: boolean;
  cacheHit?: boolean;
  lastSuccessAt?: string;
  message?: string;
  error?: string;
  skippedReason?: string;
}

export interface PoolStats {
  hardLimit: number;
  rawCount: number;
  mappedCount: number;
  validCount: number;
  deduplicatedCount: number;
  primarySelectedCount: number;
  finalCount: number;
}

export interface OpportunitiesResponse {
  /**
   * Raw transport source marker from API.
   * Keep as string because backend/runtime may return extra provider modes.
   * Must be normalized before business usage.
   */
  source: string;
  generatedAt?: string;
  count: number;
  items: HotspotItem[];
  poolStats?: PoolStats;
  providerStats?: {
    hackerNews?: ProviderStatItem;
    appStore?: ProviderStatItem;
    github?: ProviderStatItem;
    productHunt?: ProviderStatItem;
    gdelt?: ProviderStatItem;
  };
}

const REAL_SOURCE_TIMEOUT_MS = 70_000;
const DEFAULT_TIMEOUT_MS = 20_000;

function getApiBase() {
  const base = import.meta.env.VITE_API_BASE?.trim();
  if (!base) return '';
  return base.replace(/\/$/, '');
}

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function fetchOpportunities(source?: 'hn' | 'real'): Promise<OpportunitiesResponse> {
  const query = source === 'hn' ? '?source=hn' : source === 'real' ? '?source=real' : '';
  const base = getApiBase();
  const timeoutMs = source === 'real' ? REAL_SOURCE_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;
  const response = await fetchWithTimeout(`${base}/api/opportunities${query}`, timeoutMs);

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
