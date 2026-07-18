import type { AnalyzeProfile, AnalyzeResponse } from '../types/analyze';
import {
  readMigratedStorageItem,
  STORAGE_KEY_MIGRATIONS,
  writeCurrentStorageItem,
} from './storageMigration';

export const SAVED_REPORTS_KEY = STORAGE_KEY_MIGRATIONS.savedReports.currentKey;
const MAX_SAVED_REPORTS = 20;

type SourceMode = 'real' | 'mock' | 'fallback';

type BackendVerdict = {
  title?: string;
  confidence?: string;
  confidenceLevel?: string;
  nextMove?: string;
  mainRisk?: string;
  reason?: string;
  scorePreview?: number;
  code?: string;
};

type AnalyzeResponseSnapshot = AnalyzeResponse & {
  mode?: SourceMode;
  input?: unknown;
  assumptions?: Record<string, unknown>;
  missingInfo?: unknown[];
  verdict?: BackendVerdict;
  hypotheses?: unknown[];
  evidence?: unknown[];
  actionPlan?: unknown;
  firstPartyKnowledge?: Record<string, unknown>;
  judgment?: {
    mode?: SourceMode;
    assumptions?: Record<string, unknown>;
    missingInfo?: unknown[];
    verdict?: BackendVerdict;
    hypotheses?: unknown[];
    evidence?: unknown[];
    actionPlan?: unknown;
    firstPartyKnowledge?: Record<string, unknown>;
  };
  llmDraft?: {
    narrative?: {
      reportTeaser?: string;
      userFacingSummary?: string;
      verdictNarrative?: string;
    };
  };
};

export type SavedReportV1 = {
  schemaVersion: 1;
  id: string;
  createdAt: string;
  updatedAt: string;
  input: {
    projectDescription: string;
    targetMarket?: string;
    productType?: string;
  };
  summary: {
    title: string;
    verdict: string;
    score?: number;
    confidence?: string;
    targetMarket?: string;
    productType?: string;
    evidenceCount: number;
  };
  snapshot: {
    analysisId?: string;
    source?: SourceMode;
    mode?: SourceMode;
    generatedAt?: string;
    recommendation?: AnalyzeResponse['recommendation'];
    parsedIntent?: AnalyzeResponse['parsedIntent'];
    projectUnderstanding?: AnalyzeResponse['projectUnderstanding'];
    evidenceBoard?: AnalyzeResponse['evidenceBoard'];
    riskMatrix?: AnalyzeResponse['riskMatrix'];
    riskBottlenecks?: AnalyzeResponse['riskBottlenecks'];
    mvpValidationPlan?: AnalyzeResponse['mvpValidationPlan'];
    sevenDayPlan?: AnalyzeResponse['sevenDayPlan'];
    assumptions?: Record<string, unknown>;
    missingInfo?: unknown[];
    verdict?: BackendVerdict;
    hypotheses?: unknown[];
    evidence?: unknown[];
    actionPlan?: unknown;
    firstPartyKnowledge?: Record<string, unknown>;
    llmDraftNarrative?: {
      reportTeaser?: string;
      userFacingSummary?: string;
      verdictNarrative?: string;
    };
  };
};

type SaveReportInput = {
  existingId?: string | null;
  projectDescription: string;
  targetMarket?: string;
  productType?: string;
  result: AnalyzeResponse;
};

type SaveReportResult = {
  ok: boolean;
  report?: SavedReportV1;
  error?: string;
};

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    const storage = window.localStorage;
    const probeKey = `${SAVED_REPORTS_KEY}.probe`;
    storage.setItem(probeKey, '1');
    storage.removeItem(probeKey);
    return storage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function getNestedString(source: Record<string, unknown> | undefined, key: string) {
  return source ? stringValue(source[key]) : undefined;
}

function getJudgment(result: AnalyzeResponseSnapshot) {
  return isRecord(result.judgment) ? result.judgment : undefined;
}

function getAssumptions(result: AnalyzeResponseSnapshot) {
  const judgment = getJudgment(result);
  if (isRecord(judgment?.assumptions)) return judgment.assumptions;
  if (isRecord(result.assumptions)) return result.assumptions;
  return undefined;
}

function getVerdict(result: AnalyzeResponseSnapshot) {
  const judgment = getJudgment(result);
  if (isRecord(judgment?.verdict)) return judgment.verdict as BackendVerdict;
  if (isRecord(result.verdict)) return result.verdict as BackendVerdict;
  return undefined;
}

function getEvidenceCount(result: AnalyzeResponseSnapshot) {
  const judgment = getJudgment(result);
  if (Array.isArray(judgment?.evidence)) return judgment.evidence.length;
  if (Array.isArray(result.evidence)) return result.evidence.length;
  if (Array.isArray(result.evidenceBoard)) return result.evidenceBoard.length;
  return 0;
}

function compactText(value: string, max = 54) {
  const text = value.replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
}

function fallbackId() {
  const cryptoApi = typeof crypto !== 'undefined' ? crypto : undefined;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
  if (cryptoApi?.getRandomValues) {
    const bytes = new Uint32Array(4);
    cryptoApi.getRandomValues(bytes);
    return `local-${Array.from(bytes).map((item) => item.toString(16)).join('-')}`;
  }
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function withoutUndefined<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isSavedReport(value: unknown): value is SavedReportV1 {
  if (!isRecord(value)) return false;
  if (value.schemaVersion !== 1) return false;
  if (!stringValue(value.id) || !stringValue(value.createdAt) || !stringValue(value.updatedAt)) return false;
  if (!isRecord(value.input) || !isRecord(value.summary) || !isRecord(value.snapshot)) return false;
  if (!stringValue(value.input.projectDescription)) return false;
  if (!stringValue(value.summary.title) || !stringValue(value.summary.verdict)) return false;
  return typeof value.summary.evidenceCount === 'number';
}

function readReports(): SavedReportV1[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = readMigratedStorageItem(storage, STORAGE_KEY_MIGRATIONS.savedReports, (value) => {
      try {
        return Array.isArray(JSON.parse(value));
      } catch {
        return false;
      }
    });
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isSavedReport)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, MAX_SAVED_REPORTS);
  } catch {
    return [];
  }
}

function writeReports(reports: SavedReportV1[]) {
  const storage = getStorage();
  if (!storage) return false;
  try {
    const normalized = reports
      .filter(isSavedReport)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, MAX_SAVED_REPORTS);
    return writeCurrentStorageItem(
      storage,
      STORAGE_KEY_MIGRATIONS.savedReports,
      JSON.stringify(normalized),
    );
  } catch {
    return false;
  }
}

export function listSavedReports() {
  return readReports();
}

export function getSavedReport(id: string | null | undefined) {
  const reportId = stringValue(id);
  if (!reportId) return null;
  return readReports().find((report) => report.id === reportId) ?? null;
}

export function deleteReport(id: string) {
  const reportId = stringValue(id);
  if (!reportId) return false;
  const reports = readReports();
  const nextReports = reports.filter((report) => report.id !== reportId);
  if (nextReports.length === reports.length) return true;
  return writeReports(nextReports);
}

export function buildReportInputFromProfile(
  projectDescription: string,
  profile: AnalyzeProfile,
  result: AnalyzeResponse,
) {
  const snapshot = result as AnalyzeResponseSnapshot;
  const assumptions = getAssumptions(snapshot);
  const profileMarket = profile.targetMarket && profile.targetMarket !== 'Global' ? profile.targetMarket : undefined;
  return {
    projectDescription,
    targetMarket:
      getNestedString(assumptions, 'targetMarket') ||
      stringValue(result.recommendation?.targetMarket) ||
      stringValue(result.parsedIntent?.targetMarket) ||
      profileMarket,
    productType:
      getNestedString(assumptions, 'productType') ||
      stringValue(result.parsedIntent?.productCategory) ||
      stringValue(result.projectUnderstanding?.productCategory),
  };
}

function resolveTargetMarket(result: AnalyzeResponseSnapshot, assumptions: Record<string, unknown> | undefined, inputMarket?: string) {
  const profileMarket = inputMarket && inputMarket !== 'Global' ? inputMarket : undefined;
  return (
    getNestedString(assumptions, 'targetMarket') ||
      stringValue(result.recommendation?.targetMarket) ||
    stringValue(result.parsedIntent?.targetMarket) ||
    profileMarket
  );
}

export function saveReport(input: SaveReportInput): SaveReportResult {
  const projectDescription = stringValue(input.projectDescription);
  if (!projectDescription) {
    return { ok: false, error: '请先输入项目方向后再保存报告。' };
  }

  const storage = getStorage();
  if (!storage) {
    return { ok: false, error: '当前浏览器无法写入本地报告，请检查隐私模式或存储权限。' };
  }

  const result = input.result as AnalyzeResponseSnapshot;
  const now = new Date().toISOString();
  const existingReports = readReports();
  const existing = input.existingId ? existingReports.find((report) => report.id === input.existingId) : undefined;
  const assumptions = getAssumptions(result);
  const judgment = getJudgment(result);
  const verdict = getVerdict(result);
  const targetMarket = resolveTargetMarket(result, assumptions, input.targetMarket);
  const productType =
    input.productType ||
    getNestedString(assumptions, 'productType') ||
    stringValue(result.parsedIntent?.productCategory) ||
    stringValue(result.projectUnderstanding?.productCategory);
  const score =
    numberValue(verdict?.scorePreview) ??
    numberValue(result.recommendation?.matchScore);
  const confidence =
    stringValue(verdict?.confidence) ||
    stringValue(verdict?.confidenceLevel) ||
    stringValue(result.recommendation?.evidenceStrength);
  const title =
    stringValue(verdict?.title) ||
    stringValue(result.recommendation?.title) ||
    productType ||
    compactText(projectDescription);

  const report: SavedReportV1 = withoutUndefined({
    schemaVersion: 1,
    id: existing?.id ?? fallbackId(),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    input: {
      projectDescription,
      targetMarket,
      productType,
    },
    summary: {
      title: compactText(title, 64),
      verdict: stringValue(verdict?.title) || result.recommendation?.verdict || '持续观察',
      score,
      confidence,
      targetMarket,
      productType,
      evidenceCount: getEvidenceCount(result),
    },
    snapshot: {
      analysisId: result.analysisId,
      source: result.source,
      mode: judgment?.mode ?? result.mode,
      generatedAt: result.generatedAt,
      recommendation: result.recommendation,
      parsedIntent: result.parsedIntent,
      projectUnderstanding: result.projectUnderstanding,
      evidenceBoard: result.evidenceBoard,
      riskMatrix: result.riskMatrix,
      riskBottlenecks: result.riskBottlenecks,
      mvpValidationPlan: result.mvpValidationPlan,
      sevenDayPlan: result.sevenDayPlan,
      assumptions,
      missingInfo: judgment?.missingInfo ?? result.missingInfo,
      verdict,
      hypotheses: judgment?.hypotheses ?? result.hypotheses,
      evidence: judgment?.evidence ?? result.evidence,
      actionPlan: judgment?.actionPlan ?? result.actionPlan,
      firstPartyKnowledge: judgment?.firstPartyKnowledge ?? result.firstPartyKnowledge,
      llmDraftNarrative: result.llmDraft?.narrative,
    },
  });

  const nextReports = [report, ...existingReports.filter((item) => item.id !== report.id)]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, MAX_SAVED_REPORTS);

  if (!writeReports(nextReports)) {
    return { ok: false, error: '报告保存失败，请确认当前浏览器允许本地存储。' };
  }

  return { ok: true, report };
}
