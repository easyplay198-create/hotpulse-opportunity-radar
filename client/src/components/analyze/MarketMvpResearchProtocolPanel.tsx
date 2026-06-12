import { useState } from 'react';
import type { MarketMvpResearchProtocol } from '../../lib/marketMvpResearchProtocol';
import type { AnalyzeResponse } from '../../types/analyze';
import styles from '../../pages/AnalyzePage/AnalyzePage.module.css';

type SourceMode = 'real' | 'mock' | 'fallback';

type Props = {
  protocol: MarketMvpResearchProtocol;
  source: SourceMode;
  result: AnalyzeResponse | null;
  missingCriticalCount: number;
};

type EvidenceStatus = MarketMvpResearchProtocol['evidenceCoverage'][number]['status'];
type EvidenceStrengthValue = 'high' | 'medium' | 'low' | 'missing';

type DecisionContract = {
  verdict: string;
  score: number;
  confidence: string;
  evidenceCoverage: number;
  totalEvidence: number;
  mainRisk: string;
  nextMove: string;
  reason: string;
  tone: 'neutral' | 'warning' | 'ready' | 'preview';
};

type EvidenceDimension = {
  label: string;
  currentStatus: '已验证' | '弱证据' | '待补充' | '不适用';
  sourceType: string;
  evidenceStrength: EvidenceStrengthValue;
  reason: string;
};

type ActionTask = {
  phase: '24h' | '7d' | 'Stop';
  name: string;
  purpose: string;
  steps: string[];
  successMetric: string;
  stopCondition: string;
  deliverable: string;
  cta: string;
};

type FeedbackPanel = {
  title: string;
  items: string[];
  footer: string;
};

const FALLBACK_INPUTS = ['目标市场', '目标用户', '产品类型', '使用场景 / 核心痛点', '商业模式 / 付费方式'];

const MISSING_HELP: Record<string, { reason: string; example: string }> = {
  目标市场: {
    reason: '没有目标市场，无法判断竞品、价格、渠道和支付环境。',
    example: '示例：日本 / 东南亚 / 美国 / 欧美',
  },
  目标用户: {
    reason: '没有目标用户，无法判断痛点是否真实，也无法设计访谈样本。',
    example: '示例：独立设计师 / SaaS 创始人 / 留学生 / 游戏玩家',
  },
  产品类型: {
    reason: '没有产品类型，系统无法识别替代方案和常见进入路径。',
    example: '示例：AI 图片工具 / 英语学习 App / 陪伴型机器狗',
  },
  '使用场景 / 核心痛点': {
    reason: '没有场景和痛点，无法判断需求是否值得继续投入。',
    example: '示例：低成本生成电商素材 / 英语口语练习 / 养老陪伴',
  },
  '商业模式 / 付费方式': {
    reason: '没有付费方式，无法生成价格测试和停止门槛。',
    example: '示例：订阅 / 一次性付费 / IAP / 广告',
  },
};

function shortText(text: string, max = 64) {
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
}

function missingHelp(label: string) {
  return MISSING_HELP[label] ?? {
    reason: '该条件会影响市场进入判断，需要先补齐。',
    example: '补充具体市场、用户、场景、收费方式或渠道。',
  };
}

function sourceNotice(source: SourceMode) {
  if (source === 'real') {
    return {
      title: 'Real data：真实数据源',
      body: '当前结果可以作为进入前判断参考，但仍需结合证据覆盖和行动计划验证。',
    };
  }
  if (source === 'fallback') {
    return {
      title: 'Fallback：真实服务不可用，当前使用本地样本',
      body: '此模式只能用于演示验证结构，不建议作为正式进入判断。',
    };
  }
  return {
    title: 'Mock preview：样本预览',
    body: '以下仅展示验证结果结构，不能作为真实市场判断。',
  };
}

function statusLabel(status: EvidenceStatus): EvidenceDimension['currentStatus'] {
  if (status === 'covered') return '已验证';
  if (status === 'weak') return '弱证据';
  if (status === 'missing') return '待补充';
  return '弱证据';
}

function hasRealUrl(result: AnalyzeResponse | null) {
  return Boolean(result?.evidenceBoard?.some((item) => item.sourceType === 'real_signal' && item.url));
}

function statusToStrength(status: EvidenceStatus, hasExternalUrl: boolean, source: SourceMode): EvidenceStrengthValue {
  if (status === 'missing') return 'missing';
  if (status === 'weak') return 'low';
  if (source !== 'real') return status === 'covered' ? 'low' : 'missing';
  if (status === 'covered' && hasExternalUrl) return 'high';
  if (status === 'covered' || status === 'inferred') return 'medium';
  return 'low';
}

function strengthClass(strength: EvidenceStrengthValue) {
  if (strength === 'high') return styles.evidenceStrengthHigh;
  if (strength === 'medium') return styles.evidenceStrengthMedium;
  if (strength === 'low') return styles.evidenceStrengthLow;
  return styles.evidenceStrengthMissing;
}

function decisionToneClass(tone: DecisionContract['tone']) {
  if (tone === 'ready') return styles.decisionToneReady;
  if (tone === 'warning') return styles.decisionToneWarning;
  if (tone === 'preview') return styles.decisionTonePreview;
  return styles.decisionToneNeutral;
}

function evidenceStatusClass(status: EvidenceDimension['currentStatus']) {
  if (status === '已验证') return styles.evidenceCardCovered;
  if (status === '弱证据') return styles.evidenceCardWeak;
  if (status === '不适用') return styles.evidenceCardNeutral;
  return styles.evidenceCardMissing;
}

function textBlob(protocol: MarketMvpResearchProtocol, result: AnalyzeResponse | null) {
  return [
    protocol.judgmentReason,
    protocol.pricingHypothesis.risk,
    protocol.supplyDemand.demandSignal,
    protocol.supplyDemand.supplyPressure,
    ...protocol.probabilityView.negativeFactors,
    ...(result?.riskMatrix ?? []).map((item) => item.label),
    ...(result?.riskBottlenecks ?? []).map((item) => `${item.title} ${item.why} ${item.impact}`),
  ].join(' ');
}

function includesAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

function buildEvidenceDimensions(protocol: MarketMvpResearchProtocol, result: AnalyzeResponse | null, source: SourceMode): EvidenceDimension[] {
  const externalUrl = hasRealUrl(result);
  const base = protocol.evidenceCoverage;
  const blob = textBlob(protocol, result);
  const isAi = /AI|token|模型|算力/i.test(blob) || /AI/i.test(protocol.marketContext.summary);
  const paymentStatus: EvidenceStatus = includesAny(blob, [/支付|订阅|价格|付费|收款/]) ? 'weak' : 'missing';
  const localizationStatus: EvidenceStatus = includesAny(blob, [/本地化|语言|文化|日语|翻译/]) ? 'weak' : 'missing';
  const aiCostStatus: EvidenceStatus = isAi ? 'weak' : 'missing';

  const dimensions: Array<{ label: string; sourceType: string; status: EvidenceStatus; reason: string }> = [
    {
      label: '用户/输入完整度',
      sourceType: 'User Input',
      status: base[0]?.status ?? 'missing',
      reason: base[0]?.reason ?? '需要先补齐用户输入。',
    },
    {
      label: '竞品密度假设',
      sourceType: 'Community',
      status: base[1]?.status ?? 'missing',
      reason: base[1]?.reason ?? '待补充竞品和替代方案证据。',
    },
    {
      label: '目标用户痛点',
      sourceType: 'Community',
      status: base[2]?.status ?? 'missing',
      reason: base[2]?.reason ?? '待访谈或行为信号验证。',
    },
    {
      label: '价格假设',
      sourceType: 'Payment Knowledge',
      status: base[3]?.status ?? 'missing',
      reason: base[3]?.reason ?? '待付费意愿测试。',
    },
    {
      label: '获客渠道',
      sourceType: 'Search Trend',
      status: base[4]?.status ?? 'missing',
      reason: base[4]?.reason ?? '待补充渠道触达证据。',
    },
    {
      label: '合规/平台风险',
      sourceType: 'Compliance Knowledge',
      status: base[5]?.status ?? 'missing',
      reason: base[5]?.reason ?? '待上架、平台规则或隐私风险检查。',
    },
    {
      label: '支付适配',
      sourceType: 'Payment Knowledge',
      status: paymentStatus,
      reason: paymentStatus === 'missing' ? '暂无支付方式、订阅或价格证据。' : '已识别支付或价格相关风险，需要专项验证。',
    },
    {
      label: '本地化成本',
      sourceType: 'Localization Knowledge',
      status: localizationStatus,
      reason: localizationStatus === 'missing' ? '暂无语言、文化或本地化成本证据。' : '已识别本地化相关风险，需要检查表达和使用习惯。',
    },
    {
      label: 'AI 成本压力',
      sourceType: 'Cost Knowledge',
      status: aiCostStatus,
      reason: aiCostStatus === 'missing' ? '暂无 AI 成本或 token 压力证据。' : 'AI 相关方向需要测算 token、模型和毛利空间。',
    },
  ];

  return dimensions.map((item) => ({
    label: item.label,
    currentStatus: statusLabel(item.status),
    sourceType: item.sourceType,
    evidenceStrength: statusToStrength(item.status, externalUrl, source),
    reason: item.sourceType !== 'User Input' && item.status === 'covered' && !externalUrl
      ? `${item.reason} 当前未发现真实 URL，强度不标记为 high。`
      : item.reason,
  }));
}

function buildDecisionContract({
  protocol,
  result,
  source,
  missingCriticalCount,
  evidenceDimensions,
}: {
  protocol: MarketMvpResearchProtocol;
  result: AnalyzeResponse | null;
  source: SourceMode;
  missingCriticalCount: number;
  evidenceDimensions: EvidenceDimension[];
}): DecisionContract {
  const verifiedCoverage = evidenceDimensions.filter((item) => item.currentStatus === '已验证').length;
  const mediumOrHigh = evidenceDimensions.filter((item) => item.evidenceStrength === 'medium' || item.evidenceStrength === 'high').length;
  const highCount = evidenceDimensions.filter((item) => item.evidenceStrength === 'high').length;
  const mainRisk = protocol.probabilityView.negativeFactors[0] ?? '证据不足，需要先补齐外部信号。';
  const evidenceStrength = result?.recommendation?.evidenceStrength ?? 'low';
  const baseScore = Math.max(8, Math.min(92, verifiedCoverage * 11 + mediumOrHigh * 5 + Math.max(0, 6 - missingCriticalCount) * 4));

  if (source === 'mock') {
    return {
      verdict: '样本模式：仅展示验证结果结构',
      score: Math.min(baseScore, 25),
      confidence: '样本',
      evidenceCoverage: verifiedCoverage,
      totalEvidence: evidenceDimensions.length,
      mainRisk: '当前是 mock preview，不能作为真实进入判断。',
      nextMove: '切换真实数据源或补齐真实证据后再判断',
      reason: 'Mock preview 不代表真实市场信号，因此所有结论都降级为结构预览。',
      tone: 'preview',
    };
  }

  if (missingCriticalCount >= 3 || protocol.missingInputs.length >= 3) {
    return {
      verdict: '信息不足，暂不建议进入 MVP',
      score: Math.min(baseScore, 35),
      confidence: '低',
      evidenceCoverage: verifiedCoverage,
      totalEvidence: evidenceDimensions.length,
      mainRisk: '目标市场、目标用户或商业模式仍不完整。',
      nextMove: '先补全目标市场、目标用户和商业模式',
      reason: '缺失关键假设时，继续生成进入判断会误导后续投入。',
      tone: 'warning',
    };
  }

  if (verifiedCoverage <= 2 || source === 'fallback' || evidenceStrength === 'low') {
    return {
      verdict: '可做低成本预验证，但不建议正式投入',
      score: source === 'fallback' ? Math.min(baseScore, 45) : Math.min(baseScore, 55),
      confidence: source === 'fallback' ? '低' : '中低',
      evidenceCoverage: verifiedCoverage,
      totalEvidence: evidenceDimensions.length,
      mainRisk,
      nextMove: '48 小时补证据验证',
      reason: source === 'fallback'
        ? '当前使用 fallback 样本，不能直接作为正式判断。'
        : '证据覆盖不足，应先验证痛点、价格和渠道信号。',
      tone: 'warning',
    };
  }

  if (verifiedCoverage >= 5 && highCount >= 2 && evidenceStrength === 'high') {
    return {
      verdict: '优先验证',
      score: Math.min(baseScore + 8, 92),
      confidence: '中高',
      evidenceCoverage: verifiedCoverage,
      totalEvidence: evidenceDimensions.length,
      mainRisk,
      nextMove: '进入验证队列并生成报告',
      reason: '证据覆盖较强，可进入更完整的验证计划。',
      tone: 'ready',
    };
  }

  return {
    verdict: '可以进入 7 天 MVP 验证',
    score: Math.min(baseScore + 4, 78),
    confidence: '中',
    evidenceCoverage: verifiedCoverage,
    totalEvidence: evidenceDimensions.length,
    mainRisk,
    nextMove: '执行 24h / 7d 验证计划',
    reason: '当前具备中等证据基础，但仍需按停止门槛推进。',
    tone: 'neutral',
  };
}

function buildActionTasks(decision: DecisionContract, protocol: MarketMvpResearchProtocol): ActionTask[] {
  const lowEvidence = decision.evidenceCoverage <= 2 || decision.confidence === '低' || decision.confidence === '中低' || decision.confidence === '样本';
  const firstStage = protocol.mvpStages[0];
  const secondStage = protocol.mvpStages[1];

  if (lowEvidence) {
    return [
      {
        phase: '24h',
        name: '补齐证据验证',
        purpose: '确认目标用户是否真的有该痛点。',
        steps: ['写 1 页 landing page', '找 10 个目标用户访谈', '记录愿意留邮箱/预约的人数'],
        successMetric: '10 人中至少 3 人表达明确需求。',
        stopCondition: '少于 2 人愿意继续了解。',
        deliverable: '访谈记录 + 需求强度判断',
        cta: '生成访谈清单',
      },
      {
        phase: '7d',
        name: '价格与渠道小测试',
        purpose: '验证愿不愿意付费，以及哪个渠道能触达。',
        steps: ['测试 2 个价格点', '跑 1 个小预算渠道', '记录点击、留资和预约'],
        successMetric: '至少 2 个用户接受价格或询问付款方式。',
        stopCondition: '无人接受价格，或触达成本明显过高。',
        deliverable: '价格反馈 + 渠道响应表',
        cta: '生成执行建议',
      },
      {
        phase: 'Stop',
        name: '停止门槛',
        purpose: '防止低证据方向继续消耗开发和投放预算。',
        steps: ['复盘访谈反馈', '检查替代方案是否足够好', '确认支付/本地化是否过重'],
        successMetric: '只有出现明确继续信号才扩大投入。',
        stopCondition: protocol.finalStopConditions[0] ?? '没有明确需求、价格或渠道信号。',
        deliverable: '停止/继续决策记录',
        cta: '查看停止清单',
      },
    ];
  }

  return [
    {
      phase: '24h',
      name: firstStage?.stage ?? '痛点与需求验证',
      purpose: firstStage?.goal ?? '确认目标用户是否真的有该痛点。',
      steps: firstStage?.actions.slice(0, 3) ?? ['写 1 页 landing page', '找 10 个目标用户访谈', '收集预约/留资'],
      successMetric: firstStage?.passCondition ?? '10 人中至少 3 人表达明确需求。',
      stopCondition: firstStage?.stopCondition ?? '少于 2 人愿意继续了解。',
      deliverable: '需求强度判断 + 用户反馈摘要',
      cta: '生成执行建议',
    },
    {
      phase: '7d',
      name: secondStage?.stage ?? '价格与渠道验证',
      purpose: secondStage?.goal ?? '验证价格接受度和渠道触达。',
      steps: secondStage?.actions.slice(0, 3) ?? ['测试 2 个价格点', '验证 1 个渠道', '记录预约/付款意向'],
      successMetric: secondStage?.passCondition ?? '至少 2 个用户接受某个价格点。',
      stopCondition: secondStage?.stopCondition ?? '无人接受价格，或只愿意免费使用。',
      deliverable: '价格边界 + 渠道响应数据',
      cta: '生成执行建议',
    },
    {
      phase: 'Stop',
      name: '停止门槛',
      purpose: '用明确门槛控制正式投入前的风险。',
      steps: ['检查需求强度', '检查付费信号', '检查渠道可触达性'],
      successMetric: '关键假设至少 2 项通过。',
      stopCondition: protocol.finalStopConditions[0] ?? '目标用户反馈已有替代工具足够好。',
      deliverable: '继续/暂缓/停止判断',
      cta: '查看停止清单',
    },
  ];
}

function buildAdvisorItems(protocol: MarketMvpResearchProtocol, result: AnalyzeResponse | null) {
  const blob = textBlob(protocol, result);
  const items = [
    {
      key: 'payment',
      enabled: includesAny(blob, [/支付|订阅|价格|付费|收款/]),
      title: '支付适配检查',
      trigger: '价格、订阅或收款路径可能影响转化。',
      cta: '查看检查清单',
    },
    {
      key: 'localization',
      enabled: includesAny(blob, [/本地化|语言|文化|日语|翻译/]),
      title: '本地化验证',
      trigger: '语言表达、使用习惯或市场语境需要确认。',
      cta: '生成执行建议',
    },
    {
      key: 'compliance',
      enabled: includesAny(blob, [/合规|平台|上架|审核|隐私|商店/]),
      title: '上架风险预审',
      trigger: '平台规则、隐私或审核风险需要前置检查。',
      cta: '加入人工验证清单',
    },
    {
      key: 'aiCost',
      enabled: includesAny(blob, [/AI|token|模型|算力|成本/i]),
      title: 'AI 成本结构测算',
      trigger: '模型、token 或推理成本可能影响毛利。',
      cta: '生成执行建议',
    },
    {
      key: 'acquisition',
      enabled: includesAny(blob, [/获客|渠道|投放|广告|触达|搜索|SEO/i]),
      title: '小预算获客测试',
      trigger: '渠道可触达性和线索成本仍需测试。',
      cta: '查看检查清单',
    },
  ].filter((item) => item.enabled);

  return items.length > 0
    ? items
    : [{
        key: 'evidence',
        enabled: true,
        title: '证据补全清单',
        trigger: '当前风险维度还不明确，先补齐访谈、竞品和渠道证据。',
        cta: '查看检查清单',
      }];
}

function actionFeedback(task: ActionTask): FeedbackPanel {
  if (task.cta.includes('访谈')) {
    return {
      title: '访谈清单',
      items: [
        '你现在如何解决这个问题？',
        '你是否愿意为这个方案付费？',
        '你尝试过哪些替代方案？',
        '什么情况下你会停止使用现有方案？',
        '你更在意价格、效率、质量还是可控性？',
      ],
      footer: '可复制到访谈文档',
    };
  }

  if (task.cta.includes('停止')) {
    return {
      title: '停止条件清单',
      items: [
        '10 个目标用户中少于 2 人表达明确需求',
        '没有人愿意留下邮箱或预约',
        '用户认为当前替代方案已经足够',
        '价格接受度明显低于成本线',
        '获客渠道点击成本明显过高',
      ],
      footer: '用于验证复盘时判断是否暂停继续投入',
    };
  }

  return {
    title: '执行建议',
    items: [
      '先写 1 页 landing page',
      '准备 3 个价格锚点',
      '找 10 个目标用户访谈',
      '跑 1 个小预算渠道测试',
      '记录点击、留言、预约和付费意愿',
    ],
    footer: '当前为前端生成的执行建议，不会提交到后端',
  };
}

function advisorFeedback(item: ReturnType<typeof buildAdvisorItems>[number]): FeedbackPanel {
  if (item.cta === '加入人工验证清单') {
    return {
      title: '本地验证清单',
      items: ['已加入本地验证清单（当前为前端预览，后续可接入账号系统）'],
      footer: '没有提交到后端，也没有创建真实人工服务单',
    };
  }

  if (item.cta === '生成执行建议') {
    return {
      title: `${item.title}执行建议`,
      items: [
        '先确认该风险是否会影响 24h / 7d 验证动作',
        '列出 3 个需要验证的关键假设',
        '准备 1 份检查表和 1 个最小测试动作',
        '记录验证结果，并决定继续、暂缓或停止',
      ],
      footer: '当前为前端预览建议，可作为执行清单起点',
    };
  }

  if (item.key === 'payment') {
    return {
      title: '支付适配检查',
      items: [
        '目标市场是否支持主流支付方式？',
        '是否适合订阅、一次性付费或 IAP？',
        '是否存在拒付、退款、税务或结算风险？',
        '是否需要本地支付方式？',
        '是否需要先验证价格接受度？',
      ],
      footer: '可复制到支付适配检查文档',
    };
  }

  if (item.key === 'localization') {
    return {
      title: '本地化验证',
      items: [
        '是否需要日语/韩语/英语本地化？',
        '文案长度是否影响 UI？',
        '是否涉及文化语境、单位、价格显示？',
        '是否需要本地案例或本地素材？',
        '是否影响客服与售后？',
      ],
      footer: '可复制到本地化检查文档',
    };
  }

  if (item.key === 'compliance') {
    return {
      title: '上架风险预审',
      items: [
        '是否涉及 AI 生成内容声明？',
        '是否涉及订阅价格透明度？',
        '是否涉及 UGC、版权或数据隐私？',
        '是否需要 App Store / Google Play 审核准备？',
        '是否有被拒审风险？',
      ],
      footer: '当前仅为前端预审清单，不代表正式合规结论',
    };
  }

  if (item.key === 'acquisition') {
    return {
      title: '小预算获客测试',
      items: [
        '选择 1 个渠道',
        '准备 3 条卖点文案',
        '设定小预算测试范围',
        '追踪点击、预约、留言和注册',
        '根据结果判断是否继续',
      ],
      footer: '不创建真实投放任务，仅生成测试清单',
    };
  }

  return {
    title: `${item.title}检查清单`,
    items: [
      '确认该风险是否影响当前验证路径',
      '列出需要补齐的证据',
      '找到 1 个最小测试动作',
      '记录继续或停止条件',
    ],
    footer: '当前为前端预览清单',
  };
}

function FeedbackPanelView({ panel }: { panel: FeedbackPanel }) {
  return (
    <div className={styles.feedbackPanel}>
      <strong>{panel.title}</strong>
      <ul>
        {panel.items.map((item) => <li key={item}>{item}</li>)}
      </ul>
      <span>{panel.footer}</span>
    </div>
  );
}

function exampleList() {
  return [
    'AI 图片工具出海日本，面向独立设计师，订阅制，核心痛点是低成本生成电商素材',
    '英语学习 App 进入日本市场，面向大学生和职场新人，订阅制，验证付费意愿',
    '陪伴型机器狗进入日本市场，面向独居老人家庭，硬件销售 + AI 陪伴订阅，验证养老陪伴场景',
  ];
}

export function MarketMvpResearchProtocolPanel({ protocol, source, result, missingCriticalCount }: Props) {
  const [activeActionPanel, setActiveActionPanel] = useState<string | null>(null);
  const [activeAdvisorPanel, setActiveAdvisorPanel] = useState<string | null>(null);

  if (!protocol.canJudge) {
    const missingInputs = protocol.missingInputs.length > 0 ? protocol.missingInputs : FALLBACK_INPUTS;

    return (
      <section className={styles.consoleShell} aria-label="信息补齐工作台">
        <div className={styles.protocolHeader}>
          <div className={styles.protocolHeaderMain}>
            <span className={styles.protocolKicker}>Market MVP Protocol</span>
            <h2 className={styles.missingWorkspaceTitle}>信息不足，暂不建议进入 MVP</h2>
            <p className={styles.missingWorkspaceText}>
              当前输入还不足以形成可靠市场假设。先补齐关键条件，再让系统生成风险、证据和下一步动作。
            </p>
          </div>
          <div className={`${styles.protocolBadge} ${styles.protocolBadgeHold}`}>Hold / 信息不足</div>
        </div>

        <section className={styles.missingWorkspace}>
          <div className={styles.missingWorkspaceHeader}>
            <div>
              <span className={styles.missingStatusBadge}>Missing Information</span>
              <h3>还缺哪些信息才能形成可靠判断</h3>
            </div>
            <p>缺少这些信息时，继续生成市场判断会变成低可信度推测。</p>
          </div>

          <div className={styles.missingGrid}>
            {missingInputs.map((label) => {
              const help = missingHelp(label);
              return (
                <article key={label} className={styles.missingCard}>
                  <div className={styles.missingCardTitle}>{label}</div>
                  <div className={styles.missingCardStatus}>待补充</div>
                  <p className={styles.missingCardReason}>{help.reason}</p>
                  <p className={styles.missingCardExample}>{help.example}</p>
                </article>
              );
            })}
          </div>

          <section className={styles.completionFormula}>
            <span className={styles.formulaToken}>推荐描述结构</span>
            <p>
              我想验证 <span className={styles.formulaToken}>产品类型</span> 进入{' '}
              <span className={styles.formulaToken}>目标市场</span>，面向{' '}
              <span className={styles.formulaToken}>目标用户</span>，通过{' '}
              <span className={styles.formulaToken}>商业模式</span>，解决{' '}
              <span className={styles.formulaToken}>核心痛点</span>。
            </p>
          </section>

          <section className={styles.examplePromptList}>
            <div className={styles.protocolKicker}>Example Prompts</div>
            {exampleList().map((item) => (
              <div key={item} className={styles.examplePromptItem}>{item}</div>
            ))}
          </section>
        </section>
      </section>
    );
  }

  const evidenceDimensions = buildEvidenceDimensions(protocol, result, source);
  const decision = buildDecisionContract({ protocol, result, source, missingCriticalCount, evidenceDimensions });
  const notice = sourceNotice(source);
  const actionTasks = buildActionTasks(decision, protocol);
  const advisorItems = buildAdvisorItems(protocol, result);
  const activeAdvisorItem = advisorItems.find((item) => `${item.key}:${item.cta}` === activeAdvisorPanel);

  return (
    <section className={styles.consoleShell} aria-label="Market MVP 验证结果">
      <div className={styles.sourceModeNotice}>
        <strong>{notice.title}</strong>
        <p>{notice.body}</p>
      </div>

      <section className={`${styles.decisionContractBar} ${decisionToneClass(decision.tone)}`}>
        <div className={styles.decisionVerdict}>
          <span className={styles.panelEyebrow}>Verdict</span>
          <h2>{decision.verdict}</h2>
          <p>{decision.reason}</p>
        </div>
        <div className={styles.decisionContractGrid}>
          <article>
            <span>Score</span>
            <strong>{decision.score}</strong>
            <small>前端派生分</small>
          </article>
          <article>
            <span>Confidence</span>
            <strong>{decision.confidence}</strong>
            <small>由证据覆盖与来源决定</small>
          </article>
          <article>
            <span>Evidence</span>
            <strong>{decision.evidenceCoverage}/{decision.totalEvidence}</strong>
            <small>已验证维度</small>
          </article>
          <article>
            <span>Main Risk</span>
            <strong>{shortText(decision.mainRisk, 18)}</strong>
            <small>优先处理</small>
          </article>
          <article>
            <span>Next Move</span>
            <strong>{shortText(decision.nextMove, 18)}</strong>
            <small>下一步动作</small>
          </article>
        </div>
      </section>

      <section className={styles.protocolBlock}>
        <div className={styles.protocolBlockHeader}>
          <div>
            <span className={styles.panelEyebrow}>Evidence Coverage</span>
            <h3>证据覆盖与来源</h3>
          </div>
          <small>没有真实 URL 的维度不会标记为 high。</small>
        </div>
        <div className={styles.evidenceCoverageGrid}>
          {evidenceDimensions.map((item) => (
            <article key={item.label} className={`${styles.evidenceCard} ${evidenceStatusClass(item.currentStatus)}`}>
              <div className={styles.evidenceCardTop}>
                <strong>{item.label}</strong>
                <span>{item.currentStatus}</span>
              </div>
              <div className={styles.evidenceMetaLine}>
                <span>{item.sourceType}</span>
                <strong className={strengthClass(item.evidenceStrength)}>{item.evidenceStrength}</strong>
              </div>
              <p>{shortText(item.reason, 88)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.protocolBlock}>
        <div className={styles.protocolBlockHeader}>
          <div>
            <span className={styles.panelEyebrow}>Action Plan</span>
            <h3>24h / 7d / Stop 任务卡</h3>
          </div>
          <small>{decision.evidenceCoverage <= 2 ? '当前优先补证据，不直接开发 MVP。' : '按通过条件和停止门槛推进。'}</small>
        </div>
        <div className={styles.actionPlanGrid}>
          {actionTasks.map((task) => (
            <article key={task.phase} className={styles.actionPlanCard}>
              <div className={styles.actionPlanTop}>
                <span>{task.phase}</span>
                <strong>{task.name}</strong>
              </div>
              <p>{task.purpose}</p>
              <div>
                <span className={styles.actionCardLabel}>执行步骤</span>
                <ul className={styles.actionList}>
                  {task.steps.slice(0, 3).map((step) => <li key={step}>{step}</li>)}
                </ul>
              </div>
              <div className={styles.experimentGateRow}>
                <div className={styles.passMiniGate}>
                  <strong>成功标准</strong>
                  <p>{task.successMetric}</p>
                </div>
                <div className={styles.stopMiniGate}>
                  <strong>停止条件</strong>
                  <p>{task.stopCondition}</p>
                </div>
              </div>
              <div className={styles.actionOutputRow}>
                <span>产出物：{task.deliverable}</span>
                <button
                  type="button"
                  aria-expanded={activeActionPanel === task.phase}
                  onClick={() => setActiveActionPanel((current) => current === task.phase ? null : task.phase)}
                >
                  {activeActionPanel === task.phase ? '收起' : task.cta}
                </button>
              </div>
              {activeActionPanel === task.phase ? <FeedbackPanelView panel={actionFeedback(task)} /> : null}
            </article>
          ))}
        </div>
      </section>

      <section className={styles.advisoryNext}>
        <div>
          <span className={styles.panelEyebrow}>Advisor Support</span>
          <h3>按风险维度衔接顾问 / 执行支持</h3>
          <p>入口来自当前风险识别，不是服务套餐广告；用于把验证结论转成检查清单或执行建议。</p>
        </div>
        <div className={styles.advisoryRiskGrid}>
          {advisorItems.map((item) => (
            <article key={item.key} className={styles.advisoryRiskCard}>
              <strong>{item.title}</strong>
              <p>{item.trigger}</p>
              <button
                type="button"
                aria-expanded={activeAdvisorPanel === `${item.key}:${item.cta}`}
                onClick={() => setActiveAdvisorPanel((current) => current === `${item.key}:${item.cta}` ? null : `${item.key}:${item.cta}`)}
              >
                {activeAdvisorPanel === `${item.key}:${item.cta}` ? '收起' : item.cta}
              </button>
            </article>
          ))}
        </div>
        {activeAdvisorItem ? (
          <div className={styles.advisorFeedbackPanel}>
            <FeedbackPanelView panel={advisorFeedback(activeAdvisorItem)} />
          </div>
        ) : null}
      </section>

      <details className={styles.collapsedProtocolDetails}>
        <summary>查看完整协议细节</summary>
        <div className={styles.protocolDetailGrid}>
          <section className={styles.detailPanel}>
            <span className={styles.panelEyebrow}>Market & User</span>
            <h4>市场与用户假设</h4>
            <p>{protocol.marketContext.summary}</p>
            <p>{protocol.userSegment.reason}</p>
            <p>{protocol.marketContext.uncertainty}</p>
          </section>
          <section className={styles.detailPanel}>
            <span className={styles.panelEyebrow}>Pain & Trend</span>
            <h4>痛点与趋势信号</h4>
            <p>{protocol.painPoint.hypothesis}</p>
            <p>{protocol.trendSignal.signal}</p>
            <p>{protocol.trendSignal.transferableInsight}</p>
          </section>
          <section className={styles.detailPanel}>
            <span className={styles.panelEyebrow}>Competition & Price</span>
            <h4>竞品与价格假设</h4>
            <p>{protocol.competitorPattern.whatToBorrow}</p>
            <p>{protocol.competitorPattern.openGap}</p>
            <p>{protocol.pricingHypothesis.testRange}</p>
          </section>
          <section className={styles.detailPanel}>
            <span className={styles.panelEyebrow}>Probability</span>
            <h4>信心与决策门</h4>
            <div className={styles.protocolPills}>
              {protocol.probabilityView.positiveFactors.slice(0, 4).map((item) => (
                <span key={item} className={styles.protocolPill}>{shortText(item, 28)}</span>
              ))}
            </div>
          </section>
          <section className={styles.detailPanelWide}>
            <span className={styles.panelEyebrow}>Stop Conditions</span>
            <h4>最终停止条件</h4>
            <ul className={styles.stopConditionList}>
              {protocol.finalStopConditions.slice(0, 6).map((item, index) => (
                <li key={`${item}-${index}`}>{item}</li>
              ))}
            </ul>
          </section>
        </div>
      </details>
    </section>
  );
}
