export type DecisionProvenance =
  | 'observed'
  | 'rule_derived'
  | 'knowledge_base'
  | 'unknown';

export type DecisionConfidence =
  | 'high'
  | 'medium'
  | 'low'
  | 'insufficient';

export type LimitationCategory =
  | 'sampling_bias'
  | 'weak_signal'
  | 'missing_data'
  | 'data_age'
  | 'metric_scope'
  | 'cross_source_incompatibility'
  | 'knowledge_base_only'
  | 'unknown';

export interface DecisionObservation {
  id: string;
  sourceName: string;
  sourceType: string;
  title: string;
  valueLabel?: string;
  sourceUrl?: string;
  retrievedAt?: string;
  provenance: 'observed' | 'knowledge_base' | 'unknown';
}

export interface SupportedClaim {
  id: string;
  statement: string;
  evidenceRefs: string[];
  provenance: 'observed' | 'rule_derived';
  confidence: DecisionConfidence;
}

export interface DecisionLimitation {
  id: string;
  statement: string;
  affectedJudgment: string;
  category: LimitationCategory;
  provenance: 'rule_derived' | 'knowledge_base';
}

export interface DecisionRisk {
  id: string;
  category: string;
  level: 'high' | 'medium' | 'low' | 'unknown';
  statement: string;
  basis: string;
  provenance: 'rule_derived' | 'knowledge_base';
}

export interface OpportunityDecisionV1 {
  schemaVersion: '1.0';

  identity: {
    id: string;
    signalTitle: string;
    primarySource?: string;
    sourceUrl?: string;
    retrievedAt?: string;
    dataTier: 'real' | 'mock' | 'fallback';
    productType?: string;
    targetMarket?: string;
  };

  signalSummary: {
    statement: string;
    provenance: DecisionProvenance;
  };

  whyNow: {
    status: 'available' | 'insufficient';
    statement: string | null;
    provenance: 'observed' | 'rule_derived' | 'unknown';
  };

  observations: DecisionObservation[];

  supportsClaims: SupportedClaim[];

  limitations: DecisionLimitation[];

  risks: DecisionRisk[];

  validationHandoff: {
    status: 'requires_user_context';
    statement: string;
    analyzeHref?: string;
  };

  dataNotes: {
    externalSourceCount: number;
    knowledgeBaseEntryCount: number;
    hasExternalSourceUrl: boolean;
    latestRetrievedAt?: string;
    missingFields: string[];
    disclaimers: string[];
  };
}
