import type { HotItem } from '../types/hot';
import type { SmallTeamOpportunity } from './buildSmallTeamOpportunities';
import { buildSmallTeamOpportunities } from './buildSmallTeamOpportunities';

export type AdvisorAsset = '还只是想法' | '已有 MVP' | '已有产品' | '已有 App' | '已有网站 / landing page' | '已有用户' | '已有内容 / 素材';
export type AdvisorCapability = '技术开发能力' | '设计 / UI 能力' | '内容生产能力' | '社群 / 私域用户' | '投放经验' | '本地化能力' | '支付 / 订阅接入经验' | 'AI API / token 成本优势' | 'App 上架经验' | '行业客户资源' | '还不确定';
export type AdvisorGoal = '需求是否存在' | '用户是否愿意付费' | '哪个国家更适合' | '本地化是否有效' | '获客成本是否可接受' | '支付 / 订阅能不能跑通';
export type AdvisorAvoidDirection = '不想重开发' | '不想高投流' | '不想高合规风险' | '不想高 AI 成本' | '不想做 App 上架' | '还不确定';
export type AdvisorBudget = '暂不确定' | '$0-$50：只做访谈 / 社区验证' | '$50-$200：轻量 landing page / 小样本测试' | '$200-$1000：小预算投放 / 多市场对比' | '$1000-$5000：较完整 MVP 验证' | '$5000+：准备正式进入' | '自定义';
export type AdvisorWeeklyTime = '1-3 小时' | '3-8 小时' | '8-20 小时' | '20 小时以上';

export interface AdvisorProfile {
  productType: string;
  targetMarket: string;
  customMarket?: string;
  stage: string;
  assets: AdvisorAsset[];
  capabilities: AdvisorCapability[];
  validationGoals: AdvisorGoal[];
  avoidDirections: AdvisorAvoidDirection[];
  budgetRange: AdvisorBudget;
  customBudget?: string;
  weeklyTime: AdvisorWeeklyTime;
  notes?: string;
}

export interface AdvisorRecommendation {
  opportunityId: string;
  title: string;
  fitScore: number;
  reason: string;
  firstStep: string;
  riskWarning: string;
  sourceItemId: string;
}

export interface AdvisorMatchResult {
  bestMatch: AdvisorRecommendation | null;
  alternatives: AdvisorRecommendation[];
  avoidDirections: string[];
}

const BENCHMARK_NAMES = ['chatgpt', 'meta ai', 'deepseek', 'perplexity', 'grok', 'gemini', 'claude'];

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function textBag(opportunity: SmallTeamOpportunity) {
  return [
    opportunity.title,
    opportunity.targetMarket,
    opportunity.targetCustomer,
    opportunity.painPoint,
    opportunity.wedge,
    opportunity.validationAngle,
    opportunity.riskSummary,
  ].join(' ').toLowerCase();
}

function includesBenchmarkTitle(title: string) {
  const lower = title.toLowerCase();
  return BENCHMARK_NAMES.some((name) => lower.includes(name));
}

function normalizedMarket(profile: AdvisorProfile) {
  return profile.targetMarket === '自定义'
    ? (profile.customMarket?.trim() || 'Global')
    : profile.targetMarket;
}

function isLowBudget(profile: AdvisorProfile) {
  return profile.budgetRange === '暂不确定' || profile.budgetRange.startsWith('$0-$50') || profile.budgetRange.startsWith('$50-$200');
}

function isGrowthBudget(profile: AdvisorProfile) {
  return profile.budgetRange.startsWith('$200-$1000') || profile.budgetRange.startsWith('$1000-$5000') || profile.budgetRange.startsWith('$5000+');
}

function hasLowTime(profile: AdvisorProfile) {
  return profile.weeklyTime === '1-3 小时';
}

function scoreOpportunity(opportunity: SmallTeamOpportunity, profile: AdvisorProfile) {
  const bag = textBag(opportunity);
  const market = normalizedMarket(profile);
  let score = 40 + opportunity.wedgeScore * 0.35;
  const reasons: string[] = [];

  if (profile.productType !== '其他' && bag.includes(profile.productType.toLowerCase())) {
    score += 10;
    reasons.push(`与你描述的产品类型「${profile.productType}」接近`);
  } else if (/ai|开发者|工具|内容|游戏|短剧|语聊/i.test(`${profile.productType} ${bag}`)) {
    score += 5;
  }

  if (market !== 'Global' && opportunity.targetMarket.includes(market)) {
    score += 14;
    reasons.push(`目标市场与「${market}」接近`);
  } else if (market === 'Global' || opportunity.targetMarket === 'Global') {
    score += 5;
  }

  if (profile.assets.includes('已有产品') || profile.assets.includes('已有 App') || profile.assets.includes('已有 MVP')) {
    if (/(本地化|支付|订阅|市场|app|store|扩张)/i.test(bag)) {
      score += 10;
      reasons.push('你已有产品基础，更适合做市场扩张、本地化或订阅验证');
    }
  }
  if (profile.assets.includes('已有网站 / landing page') && /(landing|落地页|waitlist|转化|获客)/i.test(bag)) {
    score += 10;
    reasons.push('已有网站适合快速做 waitlist 或落地页验证');
  }
  if (profile.assets.includes('已有内容 / 素材') && /(内容|短剧|语聊|社媒|创作者)/i.test(bag)) {
    score += 10;
    reasons.push('已有内容素材适合先验证内容型海外场景');
  }
  if (profile.assets.includes('还只是想法')) {
    score += 4;
    reasons.push('当前更适合轻量访谈、社区或 landing page 验证');
  }

  if (profile.capabilities.includes('技术开发能力') && /(开发者|插件|工具|workflow|api|自动化)/i.test(bag)) {
    score += 12;
    reasons.push('你的技术开发能力适合验证工具或插件类机会');
  }
  if (profile.capabilities.includes('内容生产能力') && /(内容|创作者|短剧|语聊|社媒)/i.test(bag)) {
    score += 10;
    reasons.push('内容生产能力适合先做内容场景小样本测试');
  }
  if (profile.capabilities.includes('本地化能力') && /(本地化|语种|japan|indonesia|latin|middle east|localization)/i.test(bag)) {
    score += 12;
    reasons.push('本地化能力能帮助验证地区或小语种切口');
  }
  if (profile.capabilities.includes('支付 / 订阅接入经验') && /(支付|订阅|付费|转化|subscription)/i.test(bag)) {
    score += 12;
    reasons.push('支付 / 订阅经验适合验证付费链路');
  }
  if (profile.capabilities.includes('AI API / token 成本优势') && /(ai|token|成本|助手|内容)/i.test(bag)) {
    score += 10;
    reasons.push('AI API / token 成本优势有助于控制 MVP 成本');
  }
  if (profile.capabilities.includes('投放经验') && /(投放|获客|落地页|转化)/i.test(bag)) {
    score += 10;
    reasons.push('投放经验适合验证获客成本和转化效率');
  }
  if (profile.capabilities.includes('App 上架经验') && /(app|应用|上架|商店|store)/i.test(bag)) score += 8;
  if (profile.capabilities.includes('社群 / 私域用户') && /(社区|社群|waitlist|用户|访谈)/i.test(bag)) score += 8;
  if (profile.capabilities.includes('行业客户资源') && /(垂直|行业|客户|工作流)/i.test(bag)) score += 8;

  if (profile.validationGoals.includes('用户是否愿意付费') && /(支付|订阅|付费|转化)/i.test(bag)) score += 10;
  if (profile.validationGoals.includes('本地化是否有效') && /(本地化|语种|市场)/i.test(bag)) score += 10;
  if (profile.validationGoals.includes('获客成本是否可接受') && /(获客|投放|landing|转化)/i.test(bag)) score += 10;
  if (profile.validationGoals.includes('支付 / 订阅能不能跑通') && /(支付|订阅)/i.test(bag)) score += 12;
  if (profile.validationGoals.includes('哪个国家更适合') && /(市场|多市场|本地化)/i.test(bag)) score += 8;

  if (isLowBudget(profile) && /(风险偏高|合规|获客|投放|开发|平台)/i.test(opportunity.riskSummary + bag)) {
    score -= 14;
    reasons.push('预算偏轻，建议避开高投流、高合规或重开发方向');
  }
  if (isGrowthBudget(profile) && /(投放|多市场|落地页|转化|本地化)/i.test(bag)) {
    score += 8;
    reasons.push('你的预算更适合做小预算投放或多市场对比');
  }

  if (hasLowTime(profile) && /(开发|插件|app|平台|上架)/i.test(bag)) {
    score -= 10;
    reasons.push('每周时间较少，建议优先选择低开发量验证路径');
  }

  if (profile.avoidDirections.includes('不想重开发') && /(开发|插件|app|平台)/i.test(bag)) score -= 12;
  if (profile.avoidDirections.includes('不想高投流') && /(投流|投放|获客)/i.test(bag)) score -= 12;
  if (profile.avoidDirections.includes('不想高合规风险') && /(合规|中东|支付)/i.test(bag + opportunity.riskSummary)) score -= 10;
  if (profile.avoidDirections.includes('不想高 AI 成本') && /(ai|token|成本|助手)/i.test(bag)) score -= 10;
  if (profile.avoidDirections.includes('不想做 App 上架') && /(app|应用|上架|商店|store)/i.test(bag)) score -= 10;

  return {
    score: clamp(score),
    reason: reasons.slice(0, 2).join('；') || '根据你的产品阶段、预算和能力，该方向适合先做低成本小样本验证。',
  };
}

function firstStepFor(opportunity: SmallTeamOpportunity, profile: AdvisorProfile) {
  if (profile.budgetRange.startsWith('$0-$50') || profile.assets.includes('还只是想法')) return '先做 3-5 个用户访谈或社区提问，验证需求是否真实存在。';
  if (profile.assets.includes('已有网站 / landing page')) return '先复用现有页面做一个目标市场版本，测试点击率和 waitlist 转化。';
  if (profile.capabilities.includes('本地化能力')) return '先准备目标市场语言版本的卖点文案，验证是否能获得明确反馈。';
  if (profile.capabilities.includes('支付 / 订阅接入经验')) return '先设计低价订阅或支付意向表单，验证用户是否有付费意愿。';
  if (profile.capabilities.includes('投放经验') && isGrowthBudget(profile)) return '先做一个小预算投放实验，对比点击率、留资率和反馈质量。';
  return opportunity.validationAngle;
}

function riskFor(opportunity: SmallTeamOpportunity, profile: AdvisorProfile) {
  if (isLowBudget(profile)) return '预算偏轻，建议只验证一个最小切口，避免同时做开发、投放和上架。';
  if (hasLowTime(profile)) return '每周可投入时间较少，建议优先选择访谈、社区或 landing page 路径。';
  return opportunity.riskSummary || '该推荐仍是可验证假设，需要用真实反馈确认需求强度。';
}

function buildAvoidDirections(profile: AdvisorProfile): string[] {
  const avoids = new Set<string>();
  if (profile.avoidDirections.includes('不想重开发') || !profile.capabilities.includes('技术开发能力')) {
    avoids.add('通用 AI 助手正面竞争或重开发平台型产品');
  }
  if (profile.avoidDirections.includes('不想高投流') || isLowBudget(profile)) {
    avoids.add('高投流成本内容产品');
  }
  if (profile.avoidDirections.includes('不想高合规风险')) {
    avoids.add('高合规风险市场或强监管支付场景');
  }
  if (profile.avoidDirections.includes('不想高 AI 成本')) {
    avoids.add('高 AI 成本且付费意愿未验证的生成式产品');
  }
  if (profile.avoidDirections.includes('不想做 App 上架')) {
    avoids.add('依赖 App Store 上架和商店分发的验证路径');
  }
  return [...avoids].slice(0, 3);
}

export function matchAdvisorOpportunities(
  items: HotItem[],
  smallTeamOpportunities: SmallTeamOpportunity[],
  profile: AdvisorProfile,
): AdvisorMatchResult {
  const base = smallTeamOpportunities.length > 0 ? smallTeamOpportunities : buildSmallTeamOpportunities(items);
  const recommendations = base
    .filter((opportunity) => !includesBenchmarkTitle(opportunity.title))
    .map((opportunity) => {
      const scored = scoreOpportunity(opportunity, profile);
      return {
        opportunityId: opportunity.id,
        title: opportunity.title,
        fitScore: scored.score,
        reason: scored.reason,
        firstStep: firstStepFor(opportunity, profile),
        riskWarning: riskFor(opportunity, profile),
        sourceItemId: opportunity.sourceItemId,
      };
    })
    .sort((a, b) => b.fitScore - a.fitScore);

  return {
    bestMatch: recommendations[0] ?? null,
    alternatives: recommendations.slice(1, 3),
    avoidDirections: buildAvoidDirections(profile),
  };
}
