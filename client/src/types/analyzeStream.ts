import type { AnalyzeResponse } from './analyze';

export type AnalyzeWorkflowStage =
  | 'input_received'
  | 'brief_parsed'
  | 'conditions_checked'
  | 'providers_started'
  | 'evidence_normalized'
  | 'canonical_judgment'
  | 'explanation_generation'
  | 'report_assembled';

export type AnalyzeStreamStatus = 'waiting' | 'running' | 'completed' | 'partial' | 'failed' | 'skipped';
export type AnalyzeUiStageKey =
  | 'goal_understanding'
  | 'condition_check'
  | 'signal_collection'
  | 'evidence_building'
  | 'canonical_judgment'
  | 'report_generation';

export type AnalyzeProgressEvent = {
  runId: string;
  stage: AnalyzeWorkflowStage;
  status: 'running' | 'completed' | 'partial' | 'failed';
  message: string;
  metrics?: Record<string, unknown>;
  timestamp: string;
};

export type AnalyzeProviderEvent = {
  runId: string;
  provider: string;
  stage: 'provider_completed' | 'provider_failed' | 'provider_skipped';
  status: 'completed' | 'failed' | 'skipped';
  message: string;
  metrics?: Record<string, unknown>;
  skippedReason?: string;
  error?: string;
  timestamp: string;
};

export type AnalyzeDoneEvent = {
  runId: string;
  timestamp: string;
  result: AnalyzeResponse;
};

export type AnalyzeErrorEvent = {
  runId: string;
  stage?: AnalyzeWorkflowStage | string;
  code?: string;
  message: string;
  timestamp: string;
};
