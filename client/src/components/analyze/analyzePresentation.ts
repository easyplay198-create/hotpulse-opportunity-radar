type SourceMode = 'real' | 'mock' | 'fallback';

const ENGINEERING_COPY_RULES: Array<[RegExp, string]> = [
  [/切换真实数据源或补齐真实证据后再判断/g, '补充真实用户样本和市场证据后再判断'],
  [/切换真实数据源/g, '补充真实市场证据'],
  [/数据源切换/g, '证据补充'],
  [/mock preview/gi, '预验证'],
  [/\bfallback\b/gi, '预验证'],
  [/\bmock\b/gi, '预验证'],
  [/\bAPI\b/g, '服务接口'],
  [/\bschema\b/gi, '结构'],
  [/mock_signal/g, '示例信号'],
  [/first_party_knowledge/g, '已知业务信息'],
  [/user input/gi, '用户提供信息'],
];

const SOURCE_TYPE_LABELS: Record<string, string> = {
  real_signal: '真实市场信号',
  mock_signal: '示例信号',
  fallback_signal: '预验证信号',
  market_signal: '市场信号',
  market_knowledge: '市场知识',
  system_inference: '规则判断',
  user_input: '用户提供信息',
  first_party_knowledge: '已知业务信息',
  payment_knowledge: '支付知识',
  localization_knowledge: '本地化知识',
  compliance_knowledge: '合规知识',
  ai_cost_knowledge: '成本知识',
  computed_rule: '规则判断',
  community: '社区信号',
  app_store: '应用商店信号',
};

const SOURCE_LABELS: Record<SourceMode, string> = {
  real: '真实信号',
  mock: '预验证',
  fallback: '预验证',
};

export function cleanAnalyzePresentationCopy(value: unknown, fallback = '') {
  let text = typeof value === 'string' ? value.trim() : '';
  if (!text) return fallback;

  for (const [pattern, replacement] of ENGINEERING_COPY_RULES) {
    text = text.replace(pattern, replacement);
  }

  return text
    .replace(/样本模式：仅展示验证结果结构/g, '预验证结果：当前结论仍需真实市场证据支持')
    .replace(/样本模式不包含真实市场证据，所有结论只用于查看结构。/g, '当前为预验证，不包含真实市场证据，结论仅用于查看验证结构。')
    .replace(/当前是\s*预验证，不能作为真实进入判断。/g, '当前证据仅用于预验证，不能作为真实市场进入结论。')
    .replace(/以下仅展示验证结果结构，不能作为真实市场判断。/g, '以下为预验证结构，仍需真实市场证据支持。')
    .replace(/预验证\s*不代表真实市场信号/g, '当前证据不代表真实市场信号')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sourceModeLabel(source: SourceMode) {
  return SOURCE_LABELS[source];
}

export function sourceModeTitle(source: SourceMode, hasError = false) {
  if (hasError) return '服务状态异常';
  if (source === 'real') return '真实信号判断';
  return '预验证结果';
}

export function sourceModeHint(source: SourceMode, hasError = false) {
  if (hasError) return '分析服务未连接，请稍后重试或查看预验证结构。';
  if (source === 'real') return '当前结果可作为进入前判断参考，但仍需结合证据覆盖继续验证。';
  return '当前结论仍需真实市场证据支持，适合先做低成本预验证。';
}

export function sourceTypeLabel(value: unknown) {
  const key = String(value || '').trim();
  if (!key) return '待补充';
  return SOURCE_TYPE_LABELS[key] || cleanAnalyzePresentationCopy(key);
}

export function sourceNoticeCopy(source: SourceMode) {
  if (source === 'real') {
    return {
      title: '真实信号判断',
      body: '当前结果来自真实分析链路，可作为进入前判断参考，但仍需结合证据覆盖和行动计划验证。',
    };
  }

  return {
    title: '预验证结果',
    body: '当前结论仍需真实市场证据支持，适合先补充用户样本、市场信号和渠道响应后再判断。',
  };
}

export function safeDecisionTitle(value: unknown, source: SourceMode) {
  const text = cleanAnalyzePresentationCopy(value);
  if (source !== 'real' && /样本|预验证/.test(text)) {
    return '预验证结果：当前结论仍需真实市场证据支持';
  }
  return text || '先做低成本预验证';
}

export function safeDecisionNextMove(value: unknown) {
  return cleanAnalyzePresentationCopy(value, '补充真实用户样本和市场证据后再判断');
}

export function safeDecisionRisk(value: unknown) {
  return cleanAnalyzePresentationCopy(value, '证据覆盖不足，需要先补齐外部信号。');
}
