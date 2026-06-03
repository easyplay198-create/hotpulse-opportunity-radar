import type { HotItem } from '../types/hot';

export interface MvpValidationPlan {
  validationGoal: string;
  suggestedChannel: string;
  budgetRange: string;
  sevenDayPlan: string[];
  successMetric: string;
  stopCondition: string;
}

function getSource(item: HotItem): string {
  const sourceText = [item.platformId, item.category, item.productType, item.targetMarket]
    .filter(Boolean)
    .join(' ');
  return sourceText || 'Global';
}

function getHighRiskCount(item: HotItem): number {
  const risks = [item.acquisitionRisk, item.complianceRisk, item.aiCostRisk, item.paymentRisk, item.localizationRisk];
  return risks.filter((risk) => typeof risk === 'number' && risk >= 70).length;
}

function getBudgetRange(item: HotItem): string {
  const highRiskCount = getHighRiskCount(item);
  if (highRiskCount >= 2) return '$300 - $800 小样本验证';
  if (highRiskCount === 1) return '$100 - $300 轻量验证';
  return '$50 - $150 快速验证';
}

function getValidationBySource(item: HotItem): Pick<MvpValidationPlan, 'validationGoal' | 'suggestedChannel' | 'successMetric'> {
  const source = getSource(item).toLowerCase();

  if (source.includes('apple app store') || source.includes('app store')) {
    return {
      suggestedChannel: 'App Store 关键词与竞品页验证',
      validationGoal: '验证同类应用在目标市场是否存在明确下载、评分与付费需求',
      successMetric: '目标关键词下竞品评分和评论量稳定，且落地页点击率 > 3%',
    };
  }

  if (source.includes('hacker news')) {
    return {
      suggestedChannel: '技术社区 / landing page / waitlist 验证',
      validationGoal: '验证早期用户或开发者是否愿意留下邮箱、试用或参与访谈',
      successMetric: '获得至少 20 个 waitlist 或 3 个高质量用户访谈反馈',
    };
  }

  if (source.includes('github')) {
    return {
      suggestedChannel: '开发者社区 / 开源替代分析 / GitHub 受众验证',
      validationGoal: '验证开发者需求是否足够强，以及是否存在商业化空间',
      successMetric: '获得至少 20 个有效开发者关注信号，或 3 个深度技术反馈',
    };
  }

  return {
    suggestedChannel: 'Landing page + 小样本访谈验证',
    validationGoal: '验证目标用户是否对该方向有明确需求和行动意愿',
    successMetric: '点击率 > 3%，邮箱收集转化率 > 5%，或获得 3 个明确需求反馈',
  };
}

function getStopCondition(item: HotItem): string {
  if ((item.acquisitionRisk ?? 0) >= 70) {
    return '小预算测试中获客成本明显高于预期，且无高质量反馈时暂停';
  }
  if (item.paymentFit === 'low') {
    return '支付链路无法跑通或用户无明确付费意愿时暂停';
  }
  if ((item.aiCostRisk ?? 0) >= 70) {
    return 'AI 成本明显压缩毛利，且用户付费意愿不足时暂停';
  }
  return '连续 7 天无有效注册、试用或明确付费意愿，建议暂停该市场';
}

export function buildMvpValidationPlan(item: HotItem): MvpValidationPlan {
  const sourcePlan = getValidationBySource(item);

  return {
    validationGoal: sourcePlan.validationGoal,
    suggestedChannel: sourcePlan.suggestedChannel,
    budgetRange: getBudgetRange(item),
    sevenDayPlan: [
      'Day 1-2：搭建 landing page 或产品说明页，突出核心卖点与目标市场痛点',
      'Day 3：准备本地化文案、关键词或竞品对比素材',
      'Day 4-5：通过小预算投放、社区发布或 waitlist 收集第一批反馈',
      'Day 6：整理点击、注册、留言、试用、收藏等行为数据',
      'Day 7：根据成功指标判断继续、暂停或调整市场定位',
    ],
    successMetric: sourcePlan.successMetric,
    stopCondition: getStopCondition(item),
  };
}
