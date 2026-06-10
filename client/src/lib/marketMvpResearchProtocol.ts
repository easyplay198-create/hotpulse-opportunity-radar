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

const TARGET_MARKET = /日本|韩国|台湾|东南亚|美国|欧美|巴西|中东|土耳其|印度|印尼|泰国|越南|Global|Japan|US|SEA|Europe/i;
const TARGET_USER = /用户|开发者|学生|老师|团队|企业|卖家|创作者|运营|设计师|家长|老人|儿童|独居|B端|C端/i;
const PRODUCT_TYPE = /AI|SaaS|工具|App|订阅|游戏|短剧|支付|机器人|机器狗|硬件|插件|平台|软件/i;
const SCENARIO = /用于|帮助|解决|提高|降低|自动|生成|管理|陪伴|学习|办公|营销|获客|养老|设计|素材|效率/i;
const BUSINESS = /订阅|付费|广告|佣金|一次性|会员|充值|收款|支付|价格|客单价|售价|月费/i;
const PRICE = /\d+\s*(元|元\/?月|美元|usd|USD|¥|￥)/;
const COMPETITOR = /竞品|替代|对标|同类|alternative|competitor|workflow|现有方案/i;
const CHANNEL = /渠道|获客|投放|SEO|社群|社区|搜索|广告|内容|触达|曝光/i;
const COMPLIANCE = /合规|隐私|权限|商店|上架|审核|平台规则|政策|App Store|Google Play/i;

function countMissing(text: string) {
  const missing: string[] = [];
  if (!TARGET_MARKET.test(text)) missing.push('目标市场');
  if (!TARGET_USER.test(text)) missing.push('目标用户');
  if (!PRODUCT_TYPE.test(text)) missing.push('产品类型');
  if (!SCENARIO.test(text)) missing.push('使用场景 / 核心痛点');
  if (!BUSINESS.test(text)) missing.push('商业模式 / 付费方式');
  return missing;
}

function normalizeText(text: string) {
  return text.trim();
}

export function buildMarketMvpResearchProtocol(query: string): MarketMvpResearchProtocol {
  const text = normalizeText(query);
  const missingInputs = countMissing(text);
  const canJudge = missingInputs.length < 3;
  const hasMarket = TARGET_MARKET.test(text);
  const hasUser = TARGET_USER.test(text);
  const hasScenario = SCENARIO.test(text);
  const hasBusiness = BUSINESS.test(text);
  const hasPrice = PRICE.test(text);
  const hasCompetitor = COMPETITOR.test(text);
  const hasChannel = CHANNEL.test(text);
  const hasCompliance = COMPLIANCE.test(text);

  const primaryUser = hasUser ? (text.match(TARGET_USER)?.[0] || '目标用户') : '待明确目标用户';
  const market = hasMarket ? (text.match(TARGET_MARKET)?.[0] || '目标市场') : '待明确目标市场';
  const evidenceCoverage: MarketMvpResearchProtocol['evidenceCoverage'] = [
    { label: '用户输入完整度', status: missingInputs.length === 0 ? 'covered' : missingInputs.length <= 2 ? 'weak' : 'missing', reason: missingInputs.length === 0 ? '输入足够形成验证假设。' : `仍缺少 ${missingInputs.slice(0, 2).join('、')} 等核心信息。` },
    { label: '竞品借鉴假设', status: hasCompetitor ? 'covered' : 'weak', reason: hasCompetitor ? '输入中已出现竞品或替代方案线索。' : '尚未看到竞品或替代方案，需要后续补齐。' },
    { label: '目标用户痛点', status: hasScenario ? 'covered' : 'weak', reason: hasScenario ? '已有明确场景和痛点方向。' : '场景存在，但痛点强度仍需验证。' },
    { label: '价格假设', status: hasPrice ? 'covered' : 'weak', reason: hasPrice ? '输入中有价格或预算线索。' : '尚未看到价格边界，需在 MVP 测试中补齐。' },
    { label: '获客渠道', status: hasChannel ? 'covered' : 'inferred', reason: hasChannel ? '输入中出现渠道线索。' : '默认需要通过定向触达或内容测试推断可达渠道。' },
    { label: '合规 / 平台风险', status: hasCompliance ? 'covered' : 'inferred', reason: hasCompliance ? '已出现合规或平台约束线索。' : '默认视为需要在 MVP 阶段进一步确认。' },
  ];

  const marketContext: MarketMvpResearchProtocol['marketContext'] = {
    stage: canJudge ? '可以进入低成本 MVP 验证' : '暂不能判断',
    summary: hasMarket ? `目标市场已出现：${market}。` : '目标市场尚未明确，当前只能做输入补齐。',
    uncertainty: canJudge ? '仍需外部证据确认市场、用户和价格假设。' : '当前信息不足，继续生成市场判断会误导决策。',
  };

  const userSegment: MarketMvpResearchProtocol['userSegment'] = {
    primaryUser,
    painIntensity: hasScenario ? 'medium' : 'unknown',
    reachableSegment: hasMarket && hasUser ? `优先触达 ${market} 的 ${primaryUser}。` : '先补齐市场与用户，再定义可触达段。',
    reason: hasScenario ? '已有可验证场景，可以通过定向触达验证需求。' : '还缺少可操作的用户定义。',
  };

  const trendSignal: MarketMvpResearchProtocol['trendSignal'] = {
    signal: hasCompetitor ? '已出现竞品/替代方案线索。' : '尚未明确竞品/替代方案。',
    transferableInsight: hasCompetitor ? '可先借鉴竞品的卖点与交付方式，再验证差异点。' : '先补齐竞品，再判断可借鉴的功能或定价方式。',
    evidenceStatus: hasCompetitor ? 'covered' : 'missing',
  };

  const painPoint: MarketMvpResearchProtocol['painPoint'] = {
    hypothesis: hasScenario ? '目标用户在这个场景中存在明确痛点。' : '目标用户痛点需要先补齐。',
    strength: hasScenario ? 'medium' : 'unknown',
    whyItMatters: '痛点是否真实决定是否值得继续投入 MVP。',
  };

  const competitorPattern: MarketMvpResearchProtocol['competitorPattern'] = {
    whatToBorrow: hasCompetitor ? '借鉴现有产品的入口、卖点顺序和定价方式。' : '先找到 2-3 个可对标方案。',
    whatToAvoid: '避免直接复制功能而忽略本地市场和用户场景差异。',
    openGap: hasCompetitor ? '差异化可能来自更低摩擦的进入路径或更清晰的结果。' : '先识别竞品，再找市场空位。',
    evidenceStatus: hasCompetitor ? 'covered' : 'missing',
  };

  const pricingHypothesis = {
    model: hasBusiness ? '订阅 / 一次性 / 试用后转付费等模式已可进入测试。' : '商业模式尚未定型。',
    testRange: hasPrice ? '价格线索已出现，可从输入中的预算区间起测。' : '先测 2-3 个价格点，找出接受边界。',
    risk: '如果无人接受价格，说明当前方案还不适合继续扩大投入。',
  };

  const supplyDemand = {
    demandSignal: hasScenario ? '已有需求方向，但需验证强度。' : '需求信号弱，需要补齐场景。',
    supplyPressure: hasCompetitor ? '替代方案已存在，说明供给侧竞争不弱。' : '供给压力尚不清楚，需先查找对标。',
    competitionIntensity: hasCompetitor ? 'medium' as const : 'unknown' as const,
  };

  const mvpStages = canJudge
    ? [
        {
          stage: '阶段一 · 痛点与需求验证',
          goal: hasMarket && hasUser ? `验证 ${market} 的 ${primaryUser} 是否真的需要这个方案。` : '验证目标用户是否真的需要这个方案。',
          timebox: '48 小时',
          actions: [
            '做一个日文或目标市场语言的 landing page。',
            '测试 3 个卖点文案，分别强调效率、成本和结果。',
            '找 10 个目标用户访谈，记录是否愿意留下邮箱或预约演示。',
          ],
          passCondition: '10 个目标用户中至少 3 个表达明确需求，且至少 2 个愿意试用。',
          stopCondition: '少于 2 个目标用户认为痛点重要，或反馈已有工具足够好。',
        },
        {
          stage: '阶段二 · 价格假设验证',
          goal: '验证用户是否愿意按预设价格范围付费。',
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
          goal: '确认是否存在可触达渠道，以及交付方式是否可落地。',
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

  const confidence: MarketMvpResearchProtocol['probabilityView']['confidence'] = missingInputs.length === 0 ? 'high' : missingInputs.length <= 2 ? 'medium' : 'low';
  const probabilityView: MarketMvpResearchProtocol['probabilityView'] = {
    label: canJudge ? '低成本验证可执行' : '暂不进入市场测试',
    positiveFactors: canJudge ? [
      hasScenario ? '场景与痛点已出现' : '存在待验证场景',
      hasBusiness ? '商业模式线索已出现' : '商业模式可以通过测试补齐',
      hasMarket ? '目标市场已明确' : '目标市场可继续补齐',
    ] : ['输入不足，先补齐再判断'],
    negativeFactors: canJudge ? [
      hasCompetitor ? '竞品压力已存在' : '竞品未明确',
      hasPrice ? '价格还需进一步确认' : '价格假设未验证',
    ] : missingInputs,
    confidence,
  };

  const finalStopConditions = canJudge
    ? [
        '48 小时内无有效留资。',
        '10 个目标用户中少于 2 个表达明确需求。',
        '价格测试无人接受。',
        '无法找到可触达渠道。',
      ]
    : [
        '继续生成结论会误导决策。',
        '核心输入未补齐前不要进入测试。',
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
