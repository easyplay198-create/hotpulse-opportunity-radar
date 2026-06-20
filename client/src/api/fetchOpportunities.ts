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
  candidatePoolCount?: number;
  pageCount?: number;
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
  mode?: 'legacy' | 'cursor_v1';
  candidatePoolCount?: number;
  pageCount?: number;
  pageOffset?: number;
}

export interface PageInfo {
  mode: 'cursor_v1';
  pageSize: number;
  returnedCount: number;
  totalCount: number;
  offset: number;
  hasMore: boolean;
  nextCursor: string | null;
  snapshotId: string;
  generatedAt: string;
  expiresAt: string;
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
  pageInfo?: PageInfo;
  providerStats?: {
    hackerNews?: ProviderStatItem;
    appStore?: ProviderStatItem;
    github?: ProviderStatItem;
    productHunt?: ProviderStatItem;
    gdelt?: ProviderStatItem;
  };
}

export interface FetchOpportunitiesOptions {
  source?: 'hn' | 'real';
  limit?: number;
  cursor?: string;
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

function buildOpportunitiesQuery(input?: 'hn' | 'real' | FetchOpportunitiesOptions) {
  const options = typeof input === 'string' ? { source: input } : input || {};
  const params = new URLSearchParams();
  if (options.source) params.set('source', options.source);
  if (typeof options.limit === 'number') params.set('limit', String(options.limit));
  if (options.cursor) params.set('cursor', options.cursor);
  const query = params.toString();
  return query ? `?${query}` : '';
}

function resolveSource(input?: 'hn' | 'real' | FetchOpportunitiesOptions) {
  return typeof input === 'string' ? input : input?.source;
}

export async function fetchOpportunities(input?: 'hn' | 'real' | FetchOpportunitiesOptions): Promise<OpportunitiesResponse> {
  const query = buildOpportunitiesQuery(input);
  const source = resolveSource(input);
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
