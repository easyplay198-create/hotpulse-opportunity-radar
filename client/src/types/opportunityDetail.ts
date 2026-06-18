import type { EvidenceStrength } from './hot';

export type OpportunityDataTier = 'real' | 'mock' | 'fallback';

export type EvidenceProvenance =
  | 'observed'
  | 'calculated'
  | 'knowledge_base'
  | 'model_inference'
  | 'hypothesis'
  | 'unknown';

export type EvidenceSourceCategory =
  | 'app_store'
  | 'community'
  | 'developer'
  | 'product_launch'
  | 'news'
  | 'knowledge_base'
  | 'unknown';

export interface NormalizedEvidence {
  title: string;
  sourceName: string;
  sourceType: EvidenceSourceCategory;
  sourceUrl?: string;
  publishedAt?: string;
  retrievedAt?: string;
  strength: EvidenceStrength;
  provenance: EvidenceProvenance;
  metadata?: Record<string, unknown>;
}

export interface OpportunityDetailRiskItem {
  category: string;
  level: 'high' | 'medium' | 'low' | 'unknown';
  score?: number;
  statement?: string;
  provenance: EvidenceProvenance;
}

export interface OpportunityDetailViewModel {
  identity: {
    id: string;
    title: string;
    productType?: string;
    targetMarket?: string;
    primarySource?: string;
    dataTier: OpportunityDataTier;
    latestRetrievedAt?: string;
  };
  signal: {
    evidenceStrength: EvidenceStrength | 'insufficient';
  };
  evidence: NormalizedEvidence[];
  risks: OpportunityDetailRiskItem[];
  dataNotes: {
    evidenceCount: number;
    sourceCount: number;
    missingFields: string[];
  };
}

/**
 * dataTier describes the acquisition tier of the whole response batch.
 * It must not be inferred from individual item content.
 * A response must not mix real, mock, and fallback items.
 */
export function resolveOpportunityDataTier(source: unknown): OpportunityDataTier | null {
  if (typeof source !== 'string') return null;
  const normalized = source.trim().toLowerCase();
  if (normalized === 'real' || normalized === 'hacker-news' || normalized === 'hn') return 'real';
  if (normalized === 'mock') return 'mock';
  if (normalized === 'fallback') return 'fallback';
  return null;
}
