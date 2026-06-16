import type { EvidenceItem, HotItem } from '../types/hot';

export interface DiscoverableOpportunity {
  id: string;
  title: string;
  category: string;
  targetMarket: string;
  targetUser: string;
  inferredPainPoint: string;
  opportunityGap: string;
  whyNow: string;
  validationHypothesis: string;
  evidenceChain: {
    source: string;
    title: string;
    type: string;
    strength: string;
    url?: string;
  }[];
  benchmarkNames: string[];
  confidenceLevel: 'high' | 'medium' | 'low';
  discoveryScore: number;
  trendTag: '今日新增' | '持续升温' | '值得验证' | '仅观察';
  sourceItemId: string;
}

const BENCHMARK_KEYWORDS = ['chatgpt', 'meta ai', 'deepseek', 'perplexity', 'grok', 'gemini', 'claude'];

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function textBag(item: HotItem) {
  return [
    item.title,
    item.summary,
    item.category,
    item.productType,
    item.targetMarket,
    ...(item.tags ?? []),
    ...(item.entryFocus ?? []),
    ...(item.marketEntryNotes ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function hasBenchmarkName(text: string) {
  const lower = text.toLowerCase();
  return BENCHMARK_KEYWORDS.some((name) => lower.includes(name));
}

function benchmarkNames(item: HotItem) {
  const lower = item.title.toLowerCase();
  return BENCHMARK_KEYWORDS
    .filter((name) => lower.includes(name))
    .map((name) => name.replace(/\b\w/g, (char) => char.toUpperCase()));
}

function hasCutKeyword(item: HotItem) {
  return /(支付|本地化|开发者|低价|订阅|工作流|localization|payment|developer|subscription|workflow|plugin)/i.test(textBag(item));
}

function buildEvidenceChain(evidence: EvidenceItem[]) {
  return evidence.slice(0, 3).map((item) => ({
    source: item.source,
    title: item.title,
    type: item.type,
    strength: item.evidenceStrength,
    url: item.url ?? undefined,
  }));
}

function buildTitle(item: HotItem) {
  const bag = textBag(item);
  const market = item.targetMarket && item.targetMarket !== 'Global' ? item.targetMarket : '';
  const productType = item.productType || 'AI 工具';
  const prefix = market ? `${market} ` : '';

  if (item.evidence?.some((ev) => ev.source === 'GitHub') || /developer|github|api|plugin|workflow|开发者|工作流/.test(bag)) {
    return '开发者工作流自动化插件机会';
  }
  if (/search|搜索|资料库|knowledge|research/.test(bag)) {
    return 'AI 搜索在垂直行业资料库中的轻量化机会';
  }
  if (/content|内容|短剧|创作|creator|video/.test(bag)) {
    return `${prefix}小语种 AI 内容工具低价 MVP 测试`;
  }
  if (/支付|订阅|payment|subscription/.test(bag)) {
    return `${prefix}${productType} 支付与订阅转化机会`;
  }
  if (/本地化|localization|japan|indonesia|latin|middle east/.test(bag) || market) {
    return `${prefix}${productType} 本地化订阅机会`;
  }
  if (hasBenchmarkName(item.title)) {
    return '垂直场景 AI 助手轻量化机会';
  }
  return `${prefix}${productType} 低成本 MVP 验证机会`;
}

function discoveryScore(item: HotItem) {
  const evidenceSources = new Set((item.evidence ?? []).map((ev) => ev.source));
  let score = 50;
  if (item.evidence?.some((ev) => ev.evidenceStrength === 'high')) score += 10;
  if (evidenceSources.size > 1) score += 8;
  if (item.targetMarket && item.targetMarket !== 'Global') score += 6;
  if (hasCutKeyword(item)) score += 10;
  if ((item.competitionRisk ?? 0) >= 85) score -= 12;
  if ((item.acquisitionRisk ?? 0) >= 75) score -= 8;
  if ((item.complianceRisk ?? 0) >= 75) score -= 8;
  return clamp(score);
}

function isRecent(value?: string) {
  if (!value) return false;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return false;
  return Date.now() - time <= 1000 * 60 * 60 * 24 * 3;
}

function trendTag(item: HotItem, score: number): DiscoverableOpportunity['trendTag'] {
  if (item.evidence?.some((ev) => isRecent(ev.retrievedAt)) || isRecent(item.publishedAt)) return '今日新增';
  if (item.evidence?.some((ev) => ev.evidenceStrength === 'high') && item.valueScore >= 60) return '持续升温';
  if (score >= 75) return '值得验证';
  return '仅观察';
}

function confidenceLevel(item: HotItem, score: number): DiscoverableOpportunity['confidenceLevel'] {
  if (score >= 75 && (item.evidence?.length ?? 0) >= 2) return 'high';
  if (score >= 60) return 'medium';
  return 'low';
}

function buildOpportunity(item: HotItem): DiscoverableOpportunity | null {
  if (!item.evidence || item.evidence.length === 0) return null;

  const title = buildTitle(item);
  if (hasBenchmarkName(title)) return null;

  const score = discoveryScore(item);
  const bag = textBag(item);
  const targetMarket = item.targetMarket || 'Global';
  const productType = item.productType || 'AI 工具';

  const opportunityGap = /developer|github|api|plugin|workflow|开发者|工作流/.test(bag)
    ? '开发者插件 / 工作流自动化 / 轻量替代'
    : /支付|订阅|payment|subscription/.test(bag)
      ? '本地支付 / 低价订阅 / 转化路径'
      : /本地化|localization/.test(bag) || targetMarket !== 'Global'
        ? '本地语言 / 本地支付 / 本地内容形态'
        : '垂直行业 / 轻量替代 / 小样本验证切口';

  const whyNow = item.evidence.some((ev) => ev.source === 'GitHub')
    ? 'GitHub 热度说明开发者关注正在出现，适合验证商业化空间。'
    : item.evidence.some((ev) => ev.source === 'Apple App Store')
      ? 'App Store 信号说明同类应用需求存在，适合继续验证评分、评论和转化变量。'
      : '真实社区或市场信号正在出现，市场知识库也提示支付、本地化、获客等进入变量需要验证。';

  return {
    id: `discoverable-${item.id}`,
    title,
    category: item.category || productType,
    targetMarket,
    targetUser: /developer|github|api|plugin|workflow|开发者|工作流/.test(bag)
      ? '开发者 / 小型技术团队'
      : '特定行业用户 / 本地化用户 / 早期付费用户',
    inferredPainPoint: '推断痛点：通用产品或原始信号说明需求可能存在，但细分场景、语言、支付或工作流仍需验证。',
    opportunityGap,
    whyNow,
    validationHypothesis: `验证假设：围绕「${opportunityGap}」做 7 天小样本测试，观察点击、留资、试用或付费意愿。`,
    evidenceChain: buildEvidenceChain(item.evidence),
    benchmarkNames: benchmarkNames(item),
    confidenceLevel: confidenceLevel(item, score),
    discoveryScore: score,
    trendTag: trendTag(item, score),
    sourceItemId: item.id,
  };
}

export function buildDiscoverableOpportunities(items: HotItem[]): DiscoverableOpportunity[] {
  const dedup = new Map<string, DiscoverableOpportunity>();

  for (const item of items) {
    const opportunity = buildOpportunity(item);
    if (!opportunity) continue;
    const existing = dedup.get(opportunity.title);
    if (!existing || opportunity.discoveryScore > existing.discoveryScore) {
      dedup.set(opportunity.title, opportunity);
    }
  }

  return [...dedup.values()]
    .sort((a, b) => b.discoveryScore - a.discoveryScore)
    .slice(0, 10);
}
