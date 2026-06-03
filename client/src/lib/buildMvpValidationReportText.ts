import type { HotItem } from '../types/hot';
import { buildMvpValidationPlan } from './buildMvpValidationPlan';
import { buildOpportunityWedge } from './buildOpportunityWedge';

function pickEvidence(item: HotItem) {
  return item.evidence?.[0];
}

function textOrFallback(value: unknown, fallback: string) {
  if (typeof value === 'string' && value.trim()) return value;
  return fallback;
}

function formatDateTime(value: number) {
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(value);
}

function safeNumber(value: unknown, fallback = '暂无明确数据') {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : fallback;
}

export function buildMvpValidationReportText(item: HotItem): string {
  const plan = buildMvpValidationPlan(item);
  const wedge = buildOpportunityWedge(item);
  const evidence = pickEvidence(item);
  const evidenceStrength = evidence?.evidenceStrength ?? 'medium';
  const evidenceSource = evidence?.source ?? '暂无明确数据';
  const evidenceUrl = evidence?.url ?? '暂无明确数据';
  const paymentFit = item.paymentFit ?? 'medium';
  const generatedAt = formatDateTime(Date.now());
  const riskConclusion = '当前机会适合先做小样本验证，不建议直接大规模投入。';
  const nextStep = '建议先完成 7 天验证，再决定是否进入开发、投放或上架阶段。';

  const lines = [
    '【HotPulse MVP 出海验证快评摘要】',
    `生成时间：${generatedAt}`,
    '报告类型：MVP 出海验证快评',
    '数据来源说明：真实信号 / 静态市场进入知识库 / 前端运行时评分',
    '',
    `机会名称：${textOrFallback(item.title, '未命名机会')}`,
    `目标市场：${textOrFallback(item.targetMarket, 'Global')}`,
    `产品类型：${textOrFallback(item.productType, '未注明')}`,
    `当前建议：${item.verdict === 'do_now' ? '优先验证' : item.verdict === 'watch' ? '持续观察' : '暂不进入'}`,
    `机会分：${safeNumber(item.valueScore, '0')}`,
    `机会角色：${wedge.opportunityRole}`,
    `小团队可切入度：${safeNumber(wedge.wedgeScore, '0')}`,
    '',
    '一、真实信号',
    `* 来源：${evidenceSource}`,
    `* 证据强度：${evidenceStrength}`,
    `* 原始链接：${evidenceUrl}`,
    '',
    '二、进入风险',
    `* 支付适配：${paymentFit}`,
    `* 支付风险：${safeNumber(item.paymentRisk)}`,
    `* 本地化风险：${safeNumber(item.localizationRisk)}`,
    `* 合规风险：${safeNumber(item.complianceRisk)}`,
    `* 获客风险：${safeNumber(item.acquisitionRisk)}`,
    `* AI 成本风险：${safeNumber(item.aiCostRisk)}`,
    '',
    '三、MVP 验证计划',
    `* 验证目标：${plan.validationGoal}`,
    `* 建议渠道：${plan.suggestedChannel}`,
    `* 预算区间：${plan.budgetRange}`,
    '* 7 天计划：',
    ...plan.sevenDayPlan.slice(0, 5).map((step, index) => `  ${index + 1}. ${step}`),
    `* 成功指标：${plan.successMetric}`,
    `* 停止条件：${plan.stopCondition}`,
    '',
    '四、小团队可切入判断',
    `* 机会角色：${wedge.opportunityRole}`,
    `* 小团队可切入度：${safeNumber(wedge.wedgeScore, '0')}`,
    `* 痛点洞察：${wedge.painPointInsights.join(' / ')}`,
    `* 切入建议：${wedge.wedgeSuggestions.join(' / ')}`,
    '',
    `风险结论：${riskConclusion}`,
    `下一步建议：${nextStep}`,
    '',
    '提示：真实信号仅代表可追溯线索，不等于完整市场结论。建议先做小样本验证，再决定是否投入开发、投放或上架。',
  ];

  return lines.join('\n');
}
