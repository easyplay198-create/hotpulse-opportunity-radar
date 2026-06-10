export type EvidenceStatus = 'covered' | 'weak' | 'missing' | 'inferred';

export type MarketMvpResearchProtocol = {
  canJudge: boolean;
  judgmentLabel: string;
  judgmentReason: string;

  missingInputs: string[];

  marketContext: {
    stage: string;
    summary: string;
    uncertainty: string;
  };

  userSegment: {
    primaryUser: string;
    painIntensity: 'low' | 'medium' | 'high' | 'unknown';
    reachableSegment: string;
    reason: string;
  };

  trendSignal: {
    signal: string;
    transferableInsight: string;
    evidenceStatus: EvidenceStatus;
  };

  painPoint: {
    hypothesis: string;
    strength: 'weak' | 'medium' | 'strong' | 'unknown';
    whyItMatters: string;
  };

  competitorPattern: {
    whatToBorrow: string;
    whatToAvoid: string;
    openGap: string;
    evidenceStatus: EvidenceStatus;
  };

  pricingHypothesis: {
    model: string;
    testRange: string;
    risk: string;
  };

  supplyDemand: {
    demandSignal: string;
    supplyPressure: string;
    competitionIntensity: 'low' | 'medium' | 'high' | 'unknown';
  };

  evidenceCoverage: {
    label: string;
    status: EvidenceStatus;
    reason: string;
  }[];

  mvpStages: {
    stage: string;
    goal: string;
    timebox: string;
    actions: string[];
    passCondition: string;
    stopCondition: string;
  }[];

  probabilityView: {
    label: string;
    positiveFactors: string[];
    negativeFactors: string[];
    confidence: 'low' | 'medium' | 'high';
  };

  finalStopConditions: string[];
};

const MARKET_PATTERNS: Array<[RegExp, string]> = [
  [/日本|东京|大阪|日/,'日本'],
  [/韩国|首尔/,'韩国'],
  [/台湾/,'台湾'],
  [/香港/,'香港'],
  [/东南亚|SEA/,'东南亚'],
  [/美国|纽约|硅谷|US|USA/,'美国'],
  [/欧美|欧洲|EU/,'欧美'],
  [/中东/,'中东'],
  [/巴西/,'巴西'],
  [/印度/,'印度'],
  [/印尼/,'印尼'],
  [/泰国/,'泰国'],
  [/越南/,'越南'],
];

const PRODUCT_PATTERNS: Array<[RegExp, string]> = [
  [/AI图片工具|AI 图片工具/,'AI 图片工具'],
  [/AI学习App|英语学习App|英语学习 App/,'英语学习 App'],
  [/AI工具|AI 工具/,'AI 工具'],
  [/SaaS/,'SaaS'],
  [/App/,'App'],
  [/游戏/,'游戏'],
  [/机器狗/,'机器狗'],
  [/陪伴机器人|陪伴型机器人/,'陪伴机器人'],
  [/插件/,'插件'],
  [/短剧/,'短剧'],
  [/语聊/,'语聊'],
  [/电商工具/,'电商工具'],
  [/设计工具/,'设计工具'],
];

const USER_PATTERNS: Array<[RegExp, string]> = [
  [/独立设计师/,'独立设计师'],
  [/独居老人家庭|独居老人/,'独居老人家庭'],
  [/大学生和职场新人|大学生/,'大学生和职场新人'],
  [/开发者/,'开发者'],
  [/电商卖家/,'电商卖家'],
  [/创作者/,'创作者'],
  [/运营/,'运营'],
  [/团队/,'团队'],
  [/企业/,'企业'],
  [/家长/,'家长'],
];

const SCENARIO_PATTERNS: Array<[RegExp, string]> = [
  [/低成本生成电商素材|电商素材/,'低成本生成电商素材'],
  [/养老陪伴|情感陪伴|家庭照护/,'养老陪伴 / 情感陪伴 / 家庭照护'],
  [/英语学习效率|求职|职场沟通/,'英语学习效率 / 求职 / 职场沟通'],
  [/开发者插件接入/,'开发者插件接入'],
  [/支付失败/,'支付失败'],
  [/本地化表达/,'本地化表达'],
  [/订阅价格接受度/,'订阅价格接受度'],
  [/留存|打卡/,'留存 / 打卡机制'],
];

const BUSINESS_PATTERNS: Array<[RegExp, string]> = [
  [/硬件销售\s*\+\s*AI\s*陪伴订阅/,'硬件销售 + AI 陪伴订阅'],
  [/订阅制|订阅/,'订阅制'],
  [/一次性付费/,'一次性付费'],
  [/freemium/,'freemium'],
  [/充值/,'充值'],
  [/抽成/,'抽成'],
  [/广告/,'广告'],
  [/企业版/,'企业版'],
];

const PRICE_PATTERNS: Array<[RegExp, string]> = [
  [/\d+\s*(元|美元|日元|月|\/月)/, '价格线索'],
  [/预算|客单价|售价/,'预算/定价线索'],
];

function normalizeText(text: string) {
  return text.trim();
}

function pickPattern(text: string, patterns: Array<[RegExp, string]>, fallback: string) {
  for (const [pattern, label] of patterns) {
    if (pattern.test(text)) return label;
  }
  return fallback;
}

function hasAny(text: string, patterns: Array<[RegExp, string]>) {
  return patterns.some(([pattern]) => pattern.test(text));
}

function countMissing(text: string) {
  const missing: string[] = [];
  if (!hasAny(text, MARKET_PATTERNS)) missing.push('目标市场');
  if (!hasAny(text, USER_PATTERNS)) missing.push('目标用户');
  if (!hasAny(text, PRODUCT_PATTERNS)) missing.push('产品类型');
  if (!hasAny(text, SCENARIO_PATTERNS)) missing.push('使用场景 / 核心痛点');
  if (!hasAny(text, BUSINESS_PATTERNS)) missing.push('商业模式 / 付费方式');
  return missing;
}

export function buildMarketMvpResearchProtocol(query: string): MarketMvpResearchProtocol {
  const text = normalizeText(query);
  const missingInputs = countMissing(text);
  const canJudge = missingInputs.length < 3;
  const market = pickPattern(text, MARKET_PATTERNS, '待验证市场');
  const product = pickPattern(text, PRODUCT_PATTERNS, '待明确产品');
  const user = pickPattern(text, USER_PATTERNS, '待明确目标用户');
  const scenario = pickPattern(text, SCENARIO_PATTERNS, '待验证场景');
  const business = pickPattern(text, BUSINESS_PATTERNS, '待明确商业模式');
  const hasPrice = hasAny(text, PRICE_PATTERNS);
  const hasCompetitor = /Canva|Adobe|PhotoRoom|Duolingo|native camp|YouTube|竞品|替代|对标|同类/i.test(text);
  const hasChannel = /渠道|投放|广告|内容|社群|SEO|搜索|触达|留资|预约/i.test(text);
  const hasCompliance = /合规|隐私|权限|商店|上架|审核|平台规则|政策|售后|安全/i.test(text);

  const evidenceCoverage: MarketMvpResearchProtocol['evidenceCoverage'] = [
    { label: '用户输入完整度', status: missingInputs.length === 0 ? 'covered' : 'weak', reason: missingInputs.length === 0 ? '核心输入已覆盖，可形成验证假设。' : `仍缺少：${missingInputs.join('、')}。` },
    { label: '竞品借鉴假设', status: hasCompetitor ? 'inferred' : 'weak', reason: hasCompetitor ? '已出现可借鉴的替代方案，但仍需外部证据验证。' : '待外部证据验证，需要先找到对标方案。' },
    { label: '目标用户痛点', status: canJudge ? 'inferred' : 'missing', reason: canJudge ? '当前只能基于输入推断痛点，仍需用户访谈验证。' : '输入不足，暂时无法判断痛点强度。' },
    { label: '价格假设', status: hasPrice ? 'inferred' : 'missing', reason: hasPrice ? '输入中出现价格/预算线索，但仍需付费意愿测试。' : '待付费意愿测试，尚未形成可靠价格边界。' },
    { label: '获客渠道', status: hasChannel ? 'inferred' : 'missing', reason: hasChannel ? '渠道方向可推断，但需要投放或内容测试验证。' : '推断，需要投放或内容测试验证。' },
    { label: '合规 / 平台风险', status: hasCompliance ? 'inferred' : 'missing', reason: hasCompliance ? '已有合规/平台约束线索，但仍需后续市场检查。' : '推断，需要后续市场检查。' },
  ];

  const marketContext: MarketMvpResearchProtocol['marketContext'] = {
    stage: canJudge ? '可以进入低成本 MVP 验证' : '需补齐输入后再判断',
    summary: `当前聚焦 ${product}，面向 ${market} 的 ${user}。`,
    uncertainty: canJudge ? '仍需外部证据确认市场、用户和价格假设。' : `当前信息不足，仍缺少 ${missingInputs.join('、')}。`,
  };

  const userSegment: MarketMvpResearchProtocol['userSegment'] = {
    primaryUser: user,
    painIntensity: canJudge ? 'medium' : 'unknown',
    reachableSegment: canJudge ? `优先触达 ${market} 的 ${user}。` : `先补齐市场与用户，再定义可触达段。`,
    reason: `当前用户定义指向 ${user}，场景是 ${scenario}。`,
  };

  const trendSignal: MarketMvpResearchProtocol['trendSignal'] = {
    signal: hasCompetitor ? '已出现可借鉴的竞品或替代方案。' : '需要先找到可借鉴的竞品或替代方案。',
    transferableInsight: hasCompetitor ? '可先借鉴卖点顺序、入口设计和定价方式，再验证差异点。' : '先补齐对标对象，再判断可借鉴的功能或定价方式。',
    evidenceStatus: hasCompetitor ? 'inferred' : 'missing',
  };

  const painPoint: MarketMvpResearchProtocol['painPoint'] = {
    hypothesis: `核心痛点是 ${scenario}。`,
    strength: canJudge ? 'medium' : 'unknown',
    whyItMatters: '痛点是否真实决定是否值得继续投入 MVP。',
  };

  const competitorPattern: MarketMvpResearchProtocol['competitorPattern'] = {
    whatToBorrow: hasCompetitor ? '借鉴现有产品的入口、卖点顺序和定价方式。' : '先找到 2-3 个可对标方案，再提炼可借鉴结构。',
    whatToAvoid: '避免直接复制功能而忽略本地市场和用户场景差异。',
    openGap: hasCompetitor ? '差异化可能来自更低摩擦的进入路径或更清晰的结果。' : '先识别竞品，再找市场空位。',
    evidenceStatus: hasCompetitor ? 'inferred' : 'missing',
  };

  const pricingHypothesis = {
    model: `商业模式：${business}。`,
    testRange: hasPrice ? '先用输入中的价格/预算线索做 2-3 个价格点测试。' : '先测 2-3 个价格点，找出接受边界。',
    risk: '如果无人接受价格，说明当前方案还不适合继续扩大投入。',
  };

  const supplyDemand = {
    demandSignal: canJudge ? `需求方向指向 ${scenario}，但仍需通过测试确认强度。` : '需求信号不足，需先补齐场景。',
    supplyPressure: hasCompetitor ? '已有替代方案，说明供给侧竞争不弱。' : '供给压力尚不清楚，需先查找对标。',
    competitionIntensity: hasCompetitor ? 'medium' as const : 'unknown' as const,
  };

  const mvpStages = canJudge
    ? [
        {
          stage: '阶段一 · 痛点与需求验证',
          goal: `验证 ${market} 的 ${user} 是否真的需要 ${scenario}。`,
          timebox: '48 小时',
          actions: [
            `做一个面向 ${market} 的 landing page。`,
            '测试 3 个卖点文案，分别强调效率、成本和结果。',
            `找 10 个 ${user} 访谈，记录是否愿意留下邮箱或预约演示。`,
          ],
          passCondition: '10 个目标用户中至少 3 个表达明确需求，且至少 2 个愿意试用。',
          stopCondition: hasCompetitor
            ? '少于 2 个目标用户认为痛点重要，或反馈 Canva / Adobe / PhotoRoom / Duolingo 等替代方案足够好。'
            : '少于 2 个目标用户认为痛点重要，或反馈已有工具足够好。',
        },
        {
          stage: '阶段二 · 价格假设验证',
          goal: `验证 ${business} 的价格接受度。`,
          timebox: '24-48 小时',
          actions: [
            '设计一个最小付费页。',
            '测试 2 个到 3 个价格点。',
            '收集预约、留资或预付费意向。',
          ],
          passCondition: '至少 2 个用户接受某个价格点，或明确询问付款方式。',
          stopCondition: '无人接受价格，或用户只愿意免费使用。',
        },
        {
          stage: '阶段三 · 渠道与交付验证',
          goal: '验证获客渠道或交付可行性。',
          timebox: '24 小时',
          actions: [
            '通过 1 个渠道做定向触达。',
            '记录点击、留资、预约和回复率。',
            '对比不同渠道的响应差异。',
          ],
          passCondition: '找到至少 1 个可持续触达渠道，并获得有效反馈。',
          stopCondition: '无法找到可触达渠道，或触达成本过高。',
        },
      ]
    : [
        {
          stage: '先补齐输入，再进入验证',
          goal: '补齐市场、用户、产品、场景和商业模式。',
          timebox: '当前不进入市场测试',
          actions: ['补齐关键输入后再生成 MVP 协议。'],
          passCondition: '核心输入补齐到可以形成验证假设。',
          stopCondition: '继续生成市场判断会误导决策。',
        },
      ];

  const confidence: MarketMvpResearchProtocol['probabilityView']['confidence'] = canJudge ? (hasCompetitor || hasPrice ? 'medium' : 'low') : 'low';
  const probabilityView: MarketMvpResearchProtocol['probabilityView'] = {
    label: canJudge ? '低成本验证可行' : '需补充信息后再判断',
    positiveFactors: canJudge ? [
      `产品已指向 ${product}`,
      `市场已指向 ${market}`,
      `用户已指向 ${user}`,
      `场景已指向 ${scenario}`,
      `商业模式已指向 ${business}`,
    ] : ['输入不足，先补齐再判断'],
    negativeFactors: canJudge ? [
      hasCompetitor ? '已有替代方案，需验证差异化是否成立。' : '竞品借鉴假设待外部证据验证。',
      hasPrice ? '价格线索存在，但还需付费意愿测试。' : '价格假设待付费意愿测试。',
      hasChannel ? '渠道方向可推断，但仍需测试。' : '获客渠道需要投放或内容测试验证。',
    ] : missingInputs,
    confidence,
  };

  const finalStopConditions = canJudge
    ? [
        '10 个目标用户访谈中少于 3 个明确表示该痛点重要。',
        '少于 2 个目标用户愿意留下邮箱 / 预约演示 / 试用。',
        '没有人接受初步价格区间。',
        '目标用户反馈已有替代工具足够好。',
        '无法找到可触达的测试渠道。',
        '合规、交付、支付或售后成本明显高于可承受范围。',
      ]
    : [
        '核心输入未补齐前不要进入测试。',
        '继续生成结论会误导决策。',
      ];

  return {
    canJudge,
    judgmentLabel: canJudge ? '可以进入低成本 MVP 验证' : '暂不能判断',
    judgmentReason: canJudge ? '当前输入具备形成市场假设和验证动作的最低条件，但仍需要外部证据确认。' : '当前信息不足，继续生成市场判断会误导决策。',
    missingInputs,
    marketContext,
    userSegment,
    trendSignal,
    painPoint,
    competitorPattern,
    pricingHypothesis,
    supplyDemand,
    evidenceCoverage,
    mvpStages,
    probabilityView,
    finalStopConditions,
  };
}
