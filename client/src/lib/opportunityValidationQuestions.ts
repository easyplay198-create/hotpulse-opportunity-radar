import type { DecisionObservation } from '../types/opportunityDecision';
import type { DecisionSourceType } from './opportunityDecisionRules';
import { inferDecisionSourceType } from './opportunityDecisionRules';

export const APP_STORE_KEY_QUESTIONS = [
  '这些评分是否主要来自你准备进入的目标国家与目标用户？',
  '评分数量是否对应持续活跃、留存或付费，而不只是历史安装与一次性评价？',
  '该产品在目标市场是否存在可重复、可承受成本的获客渠道？',
] as const;

export const GITHUB_KEY_QUESTIONS = [
  'Stars 和 Forks 是否对应真实部署、持续使用或商业团队采用？',
  '是否存在明确的付费主体、预算和采购场景？',
  '开发者关注是否能转化为终端用户需求或商业需求？',
] as const;

export const HACKER_NEWS_KEY_QUESTIONS = [
  '同一问题是否能在其他独立来源被重复观察？',
  '参与讨论的人是否属于真正的目标客户，而不只是科技社区用户？',
  '是否能找到愿意接受访谈、试用或付费测试的用户？',
] as const;

export const MISSING_EXTERNAL_KEY_QUESTIONS = [
  '能否先找到至少一个带原始链接的独立外部信号？',
  '该信号是否来自明确的目标用户与目标市场？',
  '需要补充哪些数据后才能形成可追溯判断？',
] as const;

const BLOCKED_QUESTION_TERMS = [
  '需求旺盛',
  '趋势上升',
  '值得投入',
  '适合进入',
  '值得进入',
  '成功概率',
  '市场规模',
  'MAU',
  'DAU',
  'ROI',
];

export function inferPrimarySignalSourceType(
  observations: DecisionObservation[],
  platformId?: string,
): DecisionSourceType | 'insufficient' {
  const observedTypes = observations
    .filter((observation) => observation.provenance === 'observed')
    .map((observation) => observation.sourceType as DecisionSourceType);

  if (observedTypes.includes('app_store')) return 'app_store';
  if (observedTypes.includes('github')) return 'github';
  if (observedTypes.includes('hacker_news')) return 'hacker_news';

  const platformType = platformId
    ? inferDecisionSourceType({ source: platformId, metadata: {} })
    : 'unknown';
  if (platformType === 'app_store' || platformType === 'github' || platformType === 'hacker_news') {
    return platformType;
  }

  return 'insufficient';
}

export function buildKeyValidationQuestions(
  observations: DecisionObservation[],
  platformId?: string,
): string[] {
  const primary = inferPrimarySignalSourceType(observations, platformId);

  if (primary === 'app_store') return [...APP_STORE_KEY_QUESTIONS];
  if (primary === 'github') return [...GITHUB_KEY_QUESTIONS];
  if (primary === 'hacker_news') return [...HACKER_NEWS_KEY_QUESTIONS];
  return [...MISSING_EXTERNAL_KEY_QUESTIONS];
}

export function keyQuestionsAreSafe(questions: string[]): boolean {
  const text = questions.join(' | ');
  return questions.every((question) => question.trim().endsWith('？'))
    && !BLOCKED_QUESTION_TERMS.some((term) => text.includes(term));
}
