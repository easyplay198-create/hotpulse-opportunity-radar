import type { HotItem } from '../types/hot';
import { buildOpportunityWedge } from './buildOpportunityWedge';

export interface SmallTeamOpportunity {
  id: string;
  title: string;
  targetMarket: string;
  targetCustomer: string;
  painPoint: string;
  wedge: string;
  validationAngle: string;
  evidenceSources: string[];
  benchmarkNames: string[];
  wedgeScore: number;
  riskSummary: string;
  sourceItemId: string;
}

const BENCHMARK_KEYWORDS = ['chatgpt', 'meta ai', 'deepseek', 'perplexity', 'grok', 'gemini', 'claude'];

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function includesBenchmarkName(text: string) {
  const lower = text.toLowerCase();
  return BENCHMARK_KEYWORDS.some((name) => lower.includes(name));
}

function getBenchmarkNames(item: HotItem) {
  return BENCHMARK_KEYWORDS
    .filter((name) => item.title.toLowerCase().includes(name))
    .map((name) => name.replace(/\b\w/g, (char) => char.toUpperCase()));
}

function getTextBag(item: HotItem) {
  return [item.title, item.summary, item.category, item.productType, item.targetMarket, ...(item.tags ?? []), ...(item.marketEntryNotes ?? [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function calculateWedgeScore(item: HotItem) {
  const bag = getTextBag(item);
  let score = 50;
  if (item.targetMarket && item.targetMarket !== 'Global') score += 8;
  if (item.paymentFit === 'medium' || item.paymentFit === 'high') score += 8;
  if (/(本地化|支付|开发者|工作流|低价|订阅|localization|payment|developer|workflow|subscription)/.test(bag)) score += 10;
  if (item.evidence?.some((ev) => ev.evidenceStrength === 'high')) score += 6;
  if ((item.competitionRisk ?? 0) >= 80) score -= 15;
  if ((item.acquisitionRisk ?? 0) >= 70) score -= 10;
  if ((item.complianceRisk ?? 0) >= 75) score -= 8;
  return clamp(score);
}

function buildFromItem(item: HotItem): SmallTeamOpportunity {
  const wedgeInfo = buildOpportunityWedge(item);
  const targetMarket = item.targetMarket ?? 'Global';
  const productType = item.productType ?? 'AI 工具';
  const evidenceSources = [...new Set((item.evidence ?? []).map((ev) => ev.source).filter(Boolean))];
  const benchmarkNames = getBenchmarkNames(item);
  const bag = getTextBag(item);
  const isGitHub = item.platformId === 'github' || item.title.toLowerCase().includes('github') || evidenceSources.includes('GitHub');
  const hasLocalization = targetMarket !== 'Global' || (item.localizationRisk ?? 0) >= 60;
  const hasPayment = item.paymentFit || (item.paymentRisk ?? 0) >= 50;

  let title = '垂直场景 AI 助手轻量化验证';
  let targetCustomer = '特定行业小团队 / 独立创作者 / 本地化用户';
  let painPoint = '通用 AI 助手覆盖面广，但细分行业、语种、工作流仍可能存在未满足需求';
  let wedge = '不做通用 AI 助手，优先验证某个垂直场景、特定语种或低价订阅切口';
  let validationAngle = '用 landing page、waitlist 或小样本访谈验证具体场景的付费意愿';

  if (isGitHub) {
    title = '开发者工作流自动化插件验证';
    targetCustomer = '开发者 / 小型技术团队';
    painPoint = '开源热度说明开发者需求存在，但商业化需要验证付费意愿和工作流刚需';
    wedge = '围绕高频开发者工作流做轻量插件或自动化工具，而不是复制完整开源项目';
    validationAngle = '通过 GitHub 受众、开发者社区和 waitlist 验证是否愿意为省时能力付费';
  } else if (hasLocalization) {
    title = `${targetMarket} ${productType} 本地化 MVP 验证`;
    targetCustomer = `${targetMarket} 本地用户 / 小团队 / 垂直场景用户`;
    painPoint = '可验证痛点：通用产品不一定覆盖本地语言、支付、客服和使用习惯';
    wedge = '优先验证本地化文案、支付路径和目标场景，而不是正面复制头部产品';
    validationAngle = '用本地化落地页、关键词素材或竞品页对比验证转化信号';
  } else if (hasPayment) {
    title = `${targetMarket} ${productType} 支付与订阅转化验证`;
    targetCustomer = '愿意为效率提升或内容结果付费的早期用户';
    painPoint = '可验证痛点：真实需求存在时，支付链路和订阅价格会直接影响转化';
    wedge = '先验证低价订阅、试用门槛和支付适配，再决定是否开发完整产品';
    validationAngle = '用定价页、waitlist 和支付意向表单测试转化率';
  } else if (/(developer|api|workflow|开发者|工作流)/.test(bag)) {
    title = '开发者工作流自动化插件验证';
    targetCustomer = '开发者 / 小型技术团队';
    painPoint = '可验证痛点：开发者愿意采用能嵌入现有流程并节省时间的轻量工具';
    wedge = '围绕单一高频工作流做插件化验证，避免做完整平台';
    validationAngle = '用技术社区发布、Demo 和 waitlist 验证开发者关注信号';
  }

  if (wedgeInfo.opportunityRole === 'benchmark_competitor' || includesBenchmarkName(item.title)) {
    benchmarkNames.push(item.title);
  }

  if (includesBenchmarkName(title)) title = '垂直场景 AI 助手轻量化验证';

  return {
    id: `small-${item.id}`,
    title,
    targetMarket,
    targetCustomer,
    painPoint,
    wedge,
    validationAngle,
    evidenceSources: evidenceSources.length > 0 ? evidenceSources : [item.platformId],
    benchmarkNames: [...new Set(benchmarkNames)].slice(0, 3),
    wedgeScore: calculateWedgeScore(item),
    riskSummary: (item.acquisitionRisk ?? 0) >= 70 || (item.complianceRisk ?? 0) >= 75
      ? '获客或合规风险偏高，建议只做小预算验证。'
      : '适合先用低成本方式验证需求强度。',
    sourceItemId: item.id,
  };
}

export function buildSmallTeamOpportunities(items: HotItem[]): SmallTeamOpportunity[] {
  const dedup = new Map<string, SmallTeamOpportunity>();

  for (const item of items) {
    const opportunity = buildFromItem(item);
    if (includesBenchmarkName(opportunity.title)) continue;
    const existing = dedup.get(opportunity.title);
    if (!existing || opportunity.wedgeScore > existing.wedgeScore) {
      dedup.set(opportunity.title, opportunity);
    }
  }

  return [...dedup.values()]
    .sort((a, b) => b.wedgeScore - a.wedgeScore)
    .slice(0, 5);
}
