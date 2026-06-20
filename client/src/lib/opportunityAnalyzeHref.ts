import type { EvidenceItem, EvidenceStrength } from '../types/hot';
import type { OpportunityDataTier } from '../types/opportunityDetail';

export interface OpportunityAnalyzeHrefInput {
  id: string;
  title: string;
  productType?: string;
  targetMarket?: string;
  primarySource?: string;
  evidence?: EvidenceItem[];
  risks?: unknown;
  summary?: string;
  evidenceStrength?: EvidenceStrength | 'unknown' | 'insufficient';
  riskHint?: string;
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function mapEvidenceStrengthLabel(
  strength: EvidenceStrength | 'unknown' | 'insufficient' | undefined,
): string {
  if (strength === 'high') return '强证据';
  if (strength === 'medium') return '中等证据';
  if (strength === 'low') return '弱证据';
  return '证据不足';
}

function sanitizeScoreDerivedTerms(text: string): string {
  return text
    .replace(/综合评分\s*\d+/gi, '')
    .replace(/综合分\s*\d+/gi, '')
    .replace(/机会分\s*\d+/gi, '')
    .replace(/\b(valueScore|score|verdict|do_now|watch|skip)\b/gi, '')
    .replace(/[，,]\s*[，,]/g, '，')
    .replace(/^[，,\s]+|[，,\s]+$/g, '')
    .trim();
}

export function buildPublicAnalyzeQuery(input: OpportunityAnalyzeHrefInput): string {
  const productType = asNonEmptyString(input.productType) ?? '';
  const targetMarket = asNonEmptyString(input.targetMarket);
  const summary = asNonEmptyString(input.summary) ?? '';
  const riskHint = asNonEmptyString(input.riskHint) ?? '主要风险待验证';

  const raw = [
    input.title,
    productType,
    targetMarket ? `目标市场：${targetMarket}` : '',
    summary,
    `证据强度：${mapEvidenceStrengthLabel(input.evidenceStrength)}`,
    `风险提示：${riskHint}`,
  ].filter(Boolean).join('，').slice(0, 600);

  return sanitizeScoreDerivedTerms(raw);
}

export function buildAnalyzeHrefFromOpportunity(input: OpportunityAnalyzeHrefInput): string {
  const params = new URLSearchParams();
  params.set('source', 'real');
  params.set('auto', '1');
  params.set('opportunityId', input.id);
  params.set('q', buildPublicAnalyzeQuery(input));

  const targetMarket = asNonEmptyString(input.targetMarket);
  const productType = asNonEmptyString(input.productType);
  if (targetMarket) params.set('targetMarket', targetMarket);
  if (productType) params.set('productType', productType);

  return `/analyze?${params.toString()}`;
}

export function buildAnalyzeHrefBySource(source: OpportunityDataTier = 'mock'): string {
  return `/analyze?source=${encodeURIComponent(source)}`;
}
