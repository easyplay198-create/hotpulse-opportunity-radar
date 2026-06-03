import type { DiscoverableOpportunity } from './buildDiscoverableOpportunities';
import type { EvidenceStrength, HotItem } from '../types/hot';

export type DailyBriefSourceStatus = 'real' | 'mock' | 'fallback';

export type DailyBriefSourceType =
  | 'derived_from_real_signal'
  | 'derived_from_mock_signal'
  | 'derived_from_fallback_seed'
  | 'manual_seed';

export type DailyBriefSignalType =
  | 'product_signal'
  | 'community_signal'
  | 'developer_signal'
  | 'opportunity_signal'
  | 'risk_signal'
  | 'case_pattern';

export interface DailyIntelligenceBriefItem {
  id: string;
  title: string;
  source: string;
  sourceType: DailyBriefSourceType;
  category: string;
  summary: string;
  opportunityInsight: string;
  suitableFor: string;
  validationDirection: string;
  evidenceStrength: EvidenceStrength;
  signalType: DailyBriefSignalType;
  isSynthetic: boolean;
  isSeed: boolean;
  isDerived: boolean;
}

export interface DailyIntelligenceBrief {
  todayNew: DailyIntelligenceBriefItem[];
  rising: DailyIntelligenceBriefItem[];
  worthValidating: DailyIntelligenceBriefItem[];
  riskUp: DailyIntelligenceBriefItem[];
  caseOrPattern: DailyIntelligenceBriefItem[];
}

interface BuildDailyIntelligenceBriefInput {
  items: HotItem[];
  dataSource: DailyBriefSourceStatus;
  discoverableOpportunities: DiscoverableOpportunity[];
}

const MAX_ITEMS_PER_SECTION = 3;

function clampItems<T>(items: T[], limit = MAX_ITEMS_PER_SECTION) {
  return items.slice(0, limit);
}

function sourceTypeForStatus(dataSource: DailyBriefSourceStatus): DailyBriefSourceType {
  if (dataSource === 'real') return 'derived_from_real_signal';
  if (dataSource === 'fallback') return 'derived_from_fallback_seed';
  return 'derived_from_mock_signal';
}

function evidenceStrengthRank(strength?: EvidenceStrength) {
  if (strength === 'high') return 3;
  if (strength === 'medium') return 2;
  if (strength === 'low') return 1;
  return 0;
}

function strongestEvidence(item: HotItem): EvidenceStrength {
  const strongest = [...(item.evidence ?? [])].sort(
    (a, b) => evidenceStrengthRank(b.evidenceStrength) - evidenceStrengthRank(a.evidenceStrength),
  )[0]?.evidenceStrength;

  return strongest ?? 'low';
}

function newestTime(item: HotItem) {
  const values = [
    item.publishedAt,
    ...(item.evidence ?? []).map((evidence) => evidence.retrievedAt),
  ];

  return values.reduce((latest, value) => {
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? Math.max(latest, time) : latest;
  }, 0);
}

function primaryEvidenceSource(item: HotItem) {
  return item.evidence?.[0]?.source ?? item.platformId ?? 'unknown';
}

function signalTypeFromItem(item: HotItem): DailyBriefSignalType {
  const evidenceTypes = new Set((item.evidence ?? []).map((evidence) => evidence.type));
  if (evidenceTypes.has('developer_signal')) return 'developer_signal';
  if (evidenceTypes.has('app_store_signal')) return 'product_signal';
  if (evidenceTypes.has('community_signal')) return 'community_signal';
  return 'opportunity_signal';
}

function riskScore(item: HotItem) {
  return Math.max(
    item.paymentRisk ?? 0,
    item.localizationRisk ?? 0,
    item.complianceRisk ?? 0,
    item.acquisitionRisk ?? 0,
    item.aiCostRisk ?? 0,
    item.competitionRisk ?? 0,
  );
}

function riskNames(item: HotItem) {
  const risks: string[] = [];
  if ((item.paymentRisk ?? 0) >= 70) risks.push('支付适配');
  if ((item.localizationRisk ?? 0) >= 70) risks.push('本地化成本');
  if ((item.complianceRisk ?? 0) >= 70) risks.push('上架 / 合规');
  if ((item.acquisitionRisk ?? 0) >= 70) risks.push('获客成本');
  if ((item.aiCostRisk ?? 0) >= 70) risks.push('AI 成本结构');
  if ((item.competitionRisk ?? 0) >= 70) risks.push('竞争压力');
  return risks.length > 0 ? risks.join(' / ') : '进入风险';
}

function suitableForItem(item: HotItem) {
  if (/developer|github|api|plugin|workflow|开发者|工作流/i.test(`${item.title} ${item.summary} ${item.tags.join(' ')}`)) {
    return '开发者工具、Agent 工作流、效率工具团队';
  }
  if (/game|游戏|短剧|内容|creator|video/i.test(`${item.title} ${item.summary} ${item.tags.join(' ')}`)) {
    return '游戏、短剧、语聊、内容产品团队';
  }
  return `${item.productType ?? item.category ?? 'AI 应用'} 出海团队`;
}

function itemToBriefItem(
  item: HotItem,
  dataSource: DailyBriefSourceStatus,
  section: 'todayNew' | 'rising' | 'riskUp',
): DailyIntelligenceBriefItem {
  const sourceType = sourceTypeForStatus(dataSource);
  const source = primaryEvidenceSource(item);
  const category = item.category || item.productType || '市场信号';
  const evidenceStrength = strongestEvidence(item);

  if (section === 'riskUp') {
    const risks = riskNames(item);
    return {
      id: `brief-risk-${item.id}`,
      title: `${category} 进入风险需要观察`,
      source,
      sourceType,
      category,
      summary: item.summary || item.title,
      opportunityInsight: `该信号提示「${risks}」可能影响进入节奏，需要先验证风险是否可控，而不是直接进入。`,
      suitableFor: suitableForItem(item),
      validationDirection: '用小预算 landing page、访谈或投放测试验证需求，同时记录支付、本地化、合规和获客成本约束。',
      evidenceStrength,
      signalType: 'risk_signal',
      isSynthetic: dataSource !== 'real',
      isSeed: dataSource !== 'real',
      isDerived: true,
    };
  }

  const isRising = section === 'rising';
  return {
    id: `brief-${section}-${item.id}`,
    title: isRising ? `${category} 信号持续升温` : `${category} 出现当前抓取批次信号`,
    source,
    sourceType,
    category,
    summary: item.summary || item.title,
    opportunityInsight: isRising
      ? `该信号说明 ${category} 方向仍有讨论或产品活跃度，适合寻找更窄的人群、语言或工作流切口。`
      : `该信号来自当前抓取批次，说明 ${category} 方向出现新的可追踪线索，可继续观察是否形成可验证机会。`,
    suitableFor: suitableForItem(item),
    validationDirection: '用 landing page + waitlist、5-10 个用户访谈或小预算广告测试验证细分场景付费意愿。',
    evidenceStrength,
    signalType: signalTypeFromItem(item),
    isSynthetic: dataSource !== 'real',
    isSeed: dataSource !== 'real',
    isDerived: true,
  };
}

function opportunityToBriefItem(
  opportunity: DiscoverableOpportunity,
  dataSource: DailyBriefSourceStatus,
): DailyIntelligenceBriefItem {
  return {
    id: `brief-worth-${opportunity.id}`,
    title: opportunity.title,
    source: opportunity.evidenceChain.map((evidence) => evidence.source).join(' / ') || 'opportunity rules',
    sourceType: sourceTypeForStatus(dataSource),
    category: opportunity.category,
    summary: opportunity.whyNow,
    opportunityInsight: `${opportunity.opportunityGap} 可能形成可验证切口，但仍需用小样本验证需求、转化和进入风险。`,
    suitableFor: opportunity.targetUser,
    validationDirection: opportunity.validationHypothesis,
    evidenceStrength: opportunity.confidenceLevel,
    signalType: 'opportunity_signal',
    isSynthetic: dataSource !== 'real',
    isSeed: dataSource !== 'real',
    isDerived: true,
  };
}

function buildManualCaseSeeds(): DailyIntelligenceBriefItem[] {
  return [
    {
      id: 'brief-manual-case-ai-workflow',
      title: 'Agent 工作流从通用助手转向垂直执行链路',
      source: 'HotPulse manual seed',
      sourceType: 'manual_seed',
      category: 'Agent 工作流',
      summary: '手工样例：用于验证“案例 / 模式观察”栏目结构，不代表今日真实市场结论。',
      opportunityInsight: '通用 Agent 很难直接形成付费，垂直执行链路更容易绑定具体 ROI，如客服质检、销售线索整理、开发者自动化。',
      suitableFor: 'AI 工具、SaaS、开发者工具团队',
      validationDirection: '选择一个垂直岗位工作流，制作可交互 demo + waitlist，验证 7 天内是否有人愿意预约试用或付费。',
      evidenceStrength: 'low',
      signalType: 'case_pattern',
      isSynthetic: true,
      isSeed: true,
      isDerived: false,
    },
    {
      id: 'brief-manual-case-local-payment',
      title: '出海订阅产品需要把本地支付作为验证变量',
      source: 'HotPulse manual seed',
      sourceType: 'manual_seed',
      category: '支付 / 订阅',
      summary: '手工样例：用于验证“案例 / 模式观察”栏目结构，不代表今日真实市场结论。',
      opportunityInsight: '同一个产品在不同市场的付费转化可能受本地支付、订阅价格和退款习惯影响，支付适配应进入 MVP 前验证。',
      suitableFor: 'AI 应用、内容订阅、工具 SaaS 出海团队',
      validationDirection: '在目标市场测试 2-3 个价格锚点和支付路径，比较点击、试付、放弃支付和用户反馈。',
      evidenceStrength: 'low',
      signalType: 'case_pattern',
      isSynthetic: true,
      isSeed: true,
      isDerived: false,
    },
  ];
}

function dedupeByTitle(items: DailyIntelligenceBriefItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildDailyIntelligenceBrief({
  items,
  dataSource,
  discoverableOpportunities,
}: BuildDailyIntelligenceBriefInput): DailyIntelligenceBrief {
  const todayNew = clampItems(
    [...items]
      .sort((a, b) => newestTime(b) - newestTime(a))
      .map((item) => itemToBriefItem(item, dataSource, 'todayNew')),
  );

  const rising = clampItems(
    [...items]
      .sort((a, b) => {
        const scoreA = a.valueScore + a.heat + a.interaction + evidenceStrengthRank(strongestEvidence(a)) * 10;
        const scoreB = b.valueScore + b.heat + b.interaction + evidenceStrengthRank(strongestEvidence(b)) * 10;
        return scoreB - scoreA;
      })
      .map((item) => itemToBriefItem(item, dataSource, 'rising')),
  );

  const worthValidating = clampItems(
    discoverableOpportunities
      .filter((opportunity) => opportunity.trendTag === '值得验证' || opportunity.discoveryScore >= 65)
      .sort((a, b) => b.discoveryScore - a.discoveryScore)
      .map((opportunity) => opportunityToBriefItem(opportunity, dataSource)),
  );

  const riskUp = clampItems(
    [...items]
      .filter((item) => riskScore(item) >= 70)
      .sort((a, b) => riskScore(b) - riskScore(a))
      .map((item) => itemToBriefItem(item, dataSource, 'riskUp')),
  );

  return {
    todayNew: dedupeByTitle(todayNew),
    rising: dedupeByTitle(rising),
    worthValidating: dedupeByTitle(worthValidating),
    riskUp: dedupeByTitle(riskUp),
    caseOrPattern: buildManualCaseSeeds(),
  };
}
