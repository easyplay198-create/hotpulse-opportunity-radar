import type { DiscoverableOpportunity } from './buildDiscoverableOpportunities';

export type BriefingType = 'today_new' | 'warming' | 'worth_validating' | 'risk_up';

export type BriefingItem = {
  id: string;
  type: BriefingType;
  label: string;
  title: string;
  oneLine: string;
  sourceLabel: string;
  strengthLabel: string;
  trendValue: string;
  signalMeaning: string;
  whyWatch: string;
  suggestedAction: string;
  relatedItemId?: string;
};

const TYPE_ORDER: BriefingType[] = ['today_new', 'warming', 'worth_validating', 'risk_up'];
const TYPE_LABEL: Record<BriefingType, string> = {
  today_new: '新增信号',
  warming: '升温方向',
  worth_validating: '值得验证',
  risk_up: '风险提醒',
};

function sourceLabel(item: DiscoverableOpportunity) {
  if (item.evidenceChain.some((ev) => ev.source === 'Apple App Store')) return 'App Store';
  if (item.evidenceChain.some((ev) => ev.source === 'GitHub')) return 'GitHub';
  if (item.evidenceChain.some((ev) => ev.source === 'Hacker News')) return 'Hacker News';
  if (item.evidenceChain.some((ev) => ev.source === 'Product Hunt')) return 'Product Hunt';
  if (item.evidenceChain.some((ev) => ev.source === 'GDELT')) return 'GDELT';
  return item.evidenceChain[0]?.source || '市场知识库';
}

function strengthLabel(item: DiscoverableOpportunity) {
  if (item.confidenceLevel === 'high') return '高强度';
  if (item.confidenceLevel === 'medium') return '中强度';
  return '待补证据';
}

function buildCopy(type: BriefingType, item?: DiscoverableOpportunity) {
  const target = item?.targetMarket || '目标市场';
  const gap = item?.opportunityGap || '细分进入切口';

  if (type === 'today_new') {
    return {
      title: item ? `${target} 出现新的可追踪信号` : '当前出现新的可追踪信号',
      oneLine: `新的来源线索指向「${gap}」，适合先纳入观察清单。`,
      signalMeaning: '说明该方向已有可追溯市场线索，但还不能等同于完整需求验证。',
      whyWatch: '适合判断是否值得进入简报详情，进一步看来源和关联机会。',
      suggestedAction: '查看来源与关联机会，决定是否进入小样本验证。',
      trendValue: 'new',
    };
  }

  if (type === 'warming') {
    return {
      title: item ? `${target} 方向信号正在汇聚` : '多个来源指向同一方向',
      oneLine: `社区、应用或知识库信号共同指向「${gap}」。`,
      signalMeaning: '说明该方向不是单点噪声，可能存在更稳定的需求背景。',
      whyWatch: '适合继续观察不同来源是否支持同一个进入假设。',
      suggestedAction: '对比 2-3 个信号来源，确认是否存在共同痛点。',
      trendValue: 'multi-source',
    };
  }

  if (type === 'worth_validating') {
    return {
      title: item ? `${target} 方向适合做小样本验证` : '出现适合小样本验证的机会',
      oneLine: `当前证据足以支持围绕「${gap}」设计 7 天验证。`,
      signalMeaning: '说明这个方向可以先用 landing page、访谈或 waitlist 验证。',
      whyWatch: '适合判断是否立刻进入 MVP 前验证，而不是直接开发。',
      suggestedAction: item?.validationHypothesis.replace(/^验证假设：/, '') || '先设计最小验证动作。',
      trendValue: item ? `${item.discoveryScore}` : 'check',
    };
  }

  return {
    title: item ? `${target} 进入风险需要优先确认` : '部分方向风险压力较高',
    oneLine: `支付、本地化、竞争或获客变量可能影响「${gap}」进入判断。`,
    signalMeaning: '说明该方向不能只看热度，必须先确认关键风险是否可控。',
    whyWatch: '适合先看风险提醒，再决定是否补证据或暂缓进入。',
    suggestedAction: '优先验证支付、本地化或获客成本中的最高风险项。',
    trendValue: 'risk',
  };
}

function pickItem(type: BriefingType, items: DiscoverableOpportunity[], fallbackIndex: number) {
  if (type === 'today_new') return items.find((item) => item.trendTag === '今日新增') ?? items[fallbackIndex];
  if (type === 'warming') return items.find((item) => item.trendTag === '持续升温') ?? items[fallbackIndex];
  if (type === 'worth_validating') return items.find((item) => item.trendTag === '值得验证' || item.discoveryScore >= 70) ?? items[fallbackIndex];
  return items.find((item) => item.discoveryScore < 65 || item.confidenceLevel === 'low') ?? items[fallbackIndex];
}

export function buildBriefingItems(items: DiscoverableOpportunity[]): BriefingItem[] {
  return TYPE_ORDER.map((type, index) => {
    const item = pickItem(type, items, index % Math.max(items.length, 1));
    const copy = buildCopy(type, item);
    return {
      id: `briefing-${type}-${item?.sourceItemId ?? index}`,
      type,
      label: TYPE_LABEL[type],
      title: copy.title,
      oneLine: copy.oneLine,
      sourceLabel: item ? sourceLabel(item) : '市场知识库',
      strengthLabel: item ? strengthLabel(item) : '待补证据',
      trendValue: copy.trendValue,
      signalMeaning: copy.signalMeaning,
      whyWatch: copy.whyWatch,
      suggestedAction: copy.suggestedAction,
      relatedItemId: item?.sourceItemId,
    };
  });
}
