import type { HotItem } from '../types/hot';

export interface OpportunityWedge {
  opportunityRole: 'benchmark_competitor' | 'market_signal' | 'wedge_opportunity' | 'avoid_direct_entry';
  displaySummary: string;
  wedgeScore: number;
  painPointInsights: string[];
  wedgeSuggestions: string[];
}

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword.toLowerCase()));
}

function buildTextBag(item: HotItem) {
  return [
    item.title,
    item.summary,
    item.category,
    item.productType,
    item.targetMarket,
    ...(item.entryFocus ?? []),
    ...(item.riskFlags ?? []),
    ...(item.marketEntryNotes ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function getEvidenceStrengthBoost(item: HotItem) {
  const evidenceStrength = item.evidence?.[0]?.evidenceStrength;
  if (evidenceStrength === 'high') return 8;
  if (evidenceStrength === 'medium') return 4;
  return 0;
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}

function getDisplaySummary(role: OpportunityWedge['opportunityRole']) {
  if (role === 'benchmark_competitor') {
    return '该信号更适合作为市场需求证明和竞品参照，不建议小团队正面进入。';
  }
  if (role === 'wedge_opportunity') {
    return '该方向存在可验证切口，适合先做小样本 MVP 测试。';
  }
  if (role === 'avoid_direct_entry') {
    return '当前进入风险较高，建议先观察或寻找更细分切口。';
  }
  return '该方向有一定热度，但切入点仍需进一步验证。';
}

export function buildOpportunityWedge(item: HotItem): OpportunityWedge {
  const bag = buildTextBag(item);
  const competitionLevel = item.competitionRisk ?? 0;
  const acquisitionRisk = item.acquisitionRisk ?? 0;
  const complianceRisk = item.complianceRisk ?? 0;
  const aiCostRisk = item.aiCostRisk ?? 0;
  const paymentRisk = item.paymentRisk ?? 0;
  const paymentFit = item.paymentFit;
  const localizationRisk = item.localizationRisk ?? 0;
  const commercialValue = 40;

  const isBenchmarkCompeting =
    includesAny(bag, ['chatgpt', 'perplexity', 'grok', 'gemini', 'claude', 'autogpt', 'google', 'openai', 'xai']) ||
    (competitionLevel >= 85 && (item.valueScore ?? 0) >= 60);

  if (isBenchmarkCompeting) {
    return {
      opportunityRole: 'benchmark_competitor',
      displaySummary: getDisplaySummary('benchmark_competitor'),
      wedgeScore: clamp(
        35 - Math.max(0, competitionLevel - 70) - Math.max(0, acquisitionRisk - 50) + getEvidenceStrengthBoost(item),
      ),
      painPointInsights: [
        '通用 AI 助手或头部工具竞争强，不建议小团队正面进入。',
        '该信号更适合作为市场需求证明和竞品标杆，而不是直接进入对象。',
      ],
      wedgeSuggestions: [
        '优先寻找垂直行业、特定语种、特定工作流或低价轻量版本。',
        '先从现有竞品评论、社区讨论和小样本访谈中寻找未满足需求。',
      ],
    };
  }

  if (
    (competitionLevel >= 80 && acquisitionRisk >= 70) ||
    complianceRisk >= 80 ||
    (aiCostRisk >= 80 && commercialValue < 50)
  ) {
    return {
      opportunityRole: 'avoid_direct_entry',
      displaySummary: getDisplaySummary('avoid_direct_entry'),
      wedgeScore: clamp(20 + getEvidenceStrengthBoost(item) - Math.max(0, competitionLevel - 70) - Math.max(0, acquisitionRisk - 60)),
      painPointInsights: [
        '当前竞争或合规压力较高，不建议正面进入。',
        '更适合先做细分场景验证，避免直接消耗预算。',
      ],
      wedgeSuggestions: [
        '先缩小到更明确的人群或工作流切口。',
        '优先验证支付、合规或成本结构是否可承受。',
      ],
    };
  }

  const keywordHit = includesAny(bag, ['本地化', '支付', '垂直', '小样本', '开发者', '工作流', '订阅', '低价']);
  const wedgeOpportunity =
    competitionLevel <= 65 &&
    acquisitionRisk <= 70 &&
    (paymentFit === 'high' || paymentFit === 'medium' || localizationRisk >= 60 || paymentRisk >= 60 || keywordHit);

  if (wedgeOpportunity) {
    const base = 55;
    const score = clamp(
      base +
        (paymentFit === 'high' ? 10 : paymentFit === 'medium' ? 6 : 0) +
        (localizationRisk >= 60 ? 8 : 0) +
        (paymentRisk >= 60 ? 8 : 0) +
        (keywordHit ? 8 : 0) +
        getEvidenceStrengthBoost(item) -
        Math.max(0, competitionLevel - 50) / 2 -
        Math.max(0, acquisitionRisk - 50) / 2 -
        Math.max(0, complianceRisk - 50) / 3,
    );

    return {
      opportunityRole: 'wedge_opportunity',
      displaySummary: getDisplaySummary('wedge_opportunity'),
      wedgeScore: score,
      painPointInsights: [
        '可切入机会通常来自更细分的场景、地域或工作流。',
        '优先验证用户是否愿意为更具体的结果或更低的切换成本付费。',
      ],
      wedgeSuggestions: [
        '先做小样本验证，检查支付、留存和转化是否成立。',
        '用更细分的用户角色、语种或工作流描述切入。',
      ],
    };
  }

  const score = clamp(
    45 +
      (paymentFit === 'high' ? 8 : paymentFit === 'medium' ? 4 : 0) +
      getEvidenceStrengthBoost(item) -
      Math.max(0, competitionLevel - 55) / 2 -
      Math.max(0, acquisitionRisk - 55) / 2,
  );

  return {
    opportunityRole: 'market_signal',
    displaySummary: getDisplaySummary('market_signal'),
    wedgeScore: score,
    painPointInsights: [
      '当前信号能证明市场热度存在，但还不足以直接判断小团队切入点。',
      '建议结合竞品评论和本地化需求继续找细分痛点。',
    ],
    wedgeSuggestions: [
      '继续观察竞争格局，确认是否存在更窄的切口。',
      '优先收集真实用户反馈，再决定是否进入。',
    ],
  };
}
