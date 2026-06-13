import { useEffect, useMemo, useState } from 'react';
import { analyzeOpportunity } from '../../api/analyzeOpportunity';
import { AppShell } from '../../components/layout/AppShell';
import { TopNav } from '../../components/layout/TopNav';
import { AnalyzeAdvancedOptions } from '../../components/analyze/AnalyzeAdvancedOptions';
import { AnalyzeProgressPanel } from '../../components/analyze/AnalyzeProgressPanel';
import { AnalyzeWorkbench } from '../../components/analyze/AnalyzeWorkbench';
import { AnalyzeInputQualityGate } from '../../components/analyze/AnalyzeInputQualityGate';
import { MarketMvpResearchProtocolPanel } from '../../components/analyze/MarketMvpResearchProtocolPanel';
import { sourceModeHint, sourceModeLabel, sourceModeTitle } from '../../components/analyze/analyzePresentation';
import type { AnalyzeProfile, AnalyzeResponse } from '../../types/analyze';
import { buildMarketMvpResearchProtocol, type MarketMvpResearchProtocol } from '../../lib/marketMvpResearchProtocol';
import styles from './AnalyzePage.module.css';

const ANALYZE_QUERY_KEY = 'hotpulse_analyze_query';
const DEFAULT_PROFILE: AnalyzeProfile = {
  productStage: '想法阶段',
  targetMarket: 'Global',
  budgetRange: '$0-$50',
  validationGoal: '需求是否存在',
};

const FLOW_STEPS = ['产品类型', '目标市场', '用户', '核心痛点', '商业模式'];

type AssumptionStatus = 'identified' | 'missing' | 'profile';

type AssumptionItem = {
  key: string;
  label: string;
  value: string;
  helper: string;
  example: string;
  status: AssumptionStatus;
};

type BackendJudgment = {
  assumptions?: Record<string, unknown>;
  missingInfo?: Array<string | { key?: string; label?: string }>;
};

type AnalyzeResponseWithJudgment = AnalyzeResponse & {
  judgment?: BackendJudgment;
  assumptions?: Record<string, unknown>;
  missingInfo?: Array<string | { key?: string; label?: string }>;
};

const PENDING_VALUE = '待补充';
const CRITICAL_ASSUMPTION_KEYS = ['targetMarket', 'targetUser', 'painPoint', 'businessModel', 'acquisitionChannel', 'platformForm'];

const ASSUMPTION_EXAMPLES: Record<string, string> = {
  targetMarket: '目标市场：例如日本、东南亚、美国或 Global',
  targetUser: '目标用户：例如独立设计师、SaaS 创始人、留学生或游戏玩家',
  painPoint: '核心痛点：例如低成本生成素材、降低获客成本或提升留存',
  businessModel: '商业模式：例如订阅、一次性付费、IAP 或广告',
  acquisitionChannel: '获客渠道：例如 SEO、社群、投放、应用商店或 Product Hunt',
  platformForm: '产品形态：例如 Web SaaS、移动 App、浏览器插件、游戏或硬件',
};

function pickLabel(text: string, rules: Array<[RegExp, string]>) {
  const match = rules.find(([pattern]) => pattern.test(text));
  return match?.[1] ?? PENDING_VALUE;
}

function pickTargetUser(text: string) {
  const direct = text.match(/面向([^，。,.]{2,24})/);
  if (direct?.[1]) return direct[1].trim();
  return pickLabel(text, [
    [/独立设计师/, '独立设计师'],
    [/SaaS\s*创始人|创始人/, 'SaaS 创始人'],
    [/开发者/, '开发者'],
    [/留学生/, '留学生'],
    [/游戏玩家|玩家/, '游戏玩家'],
    [/大学生|学生/, '学生'],
    [/职场新人/, '职场新人'],
    [/独居老人|老人家庭/, '独居老人家庭'],
    [/企业|团队/, '企业 / 团队'],
    [/卖家|电商/, '电商卖家'],
    [/创作者/, '创作者'],
  ]);
}

function pickPainPoint(text: string) {
  const direct = text.match(/(?:核心痛点是|痛点是|解决)([^，。,.]{3,34})/);
  if (direct?.[1]) return direct[1].trim();
  return pickLabel(text, [
    [/低成本生成|素材/, '低成本生成素材'],
    [/付费意愿|价格接受/, '付费意愿不确定'],
    [/获客成本|获客/, '获客成本与渠道可行性'],
    [/本地化|语言|日语/, '本地化表达与使用习惯'],
    [/支付失败|支付/, '支付路径与订阅转化'],
    [/陪伴|养老/, '陪伴 / 养老场景需求'],
    [/效率|自动化/, '效率提升'],
  ]);
}

function assumptionStatus(value: string, status: AssumptionStatus = 'identified'): AssumptionStatus {
  return value === PENDING_VALUE ? 'missing' : status;
}

function extractAssumptions(query: string, profile: AnalyzeProfile): AssumptionItem[] {
  const text = query.trim();
  const profileMarket = profile.targetMarket && profile.targetMarket !== 'Global' ? profile.targetMarket : PENDING_VALUE;
  const productType = pickLabel(text, [
    [/AI\s*图片|图片工具/, 'AI 图片工具'],
    [/AI/, 'AI 工具'],
    [/SaaS/i, 'SaaS'],
    [/App|应用/i, 'App'],
    [/游戏/, '游戏'],
    [/短剧/, '短剧'],
    [/机器狗|机器人/, '机器人 / 硬件'],
    [/插件/, '插件'],
    [/工具/, '工具'],
  ]);
  const targetMarket = pickLabel(text, [
    [/日本|Japan|日语/i, '日本'],
    [/东南亚|SEA|印尼|泰国|越南/i, '东南亚'],
    [/美国|US|USA/i, '美国'],
    [/欧美|欧洲|Europe|Global/i, '欧美 / Global'],
    [/韩国/i, '韩国'],
    [/中东/i, '中东'],
    [/拉美|巴西/i, '拉美'],
  ]);
  const marketValue = targetMarket === PENDING_VALUE ? profileMarket : targetMarket;
  const businessModel = pickLabel(text, [
    [/订阅|月费|会员/, '订阅'],
    [/一次性|买断/, '一次性付费'],
    [/IAP|内购/i, 'IAP / 内购'],
    [/广告/, '广告'],
    [/硬件销售\s*\+|硬件/, '硬件销售 + 服务'],
    [/付费|价格|收款|支付/, '付费转化待验证'],
  ]);
  const acquisitionChannel = pickLabel(text, [
    [/SEO|搜索/i, '搜索 / SEO'],
    [/社群|社区/, '社群 / 社区'],
    [/投放|广告/, '小预算投放'],
    [/内容|短视频/, '内容渠道'],
    [/App Store|应用商店/i, '应用商店'],
    [/Product Hunt|PH/i, 'Product Hunt'],
    [/渠道|触达/, '渠道待验证'],
  ]);
  const platformForm = pickLabel(text, [
    [/Web|网站|SaaS/i, 'Web SaaS'],
    [/App|移动/i, '移动 App'],
    [/插件/, '浏览器 / 开发者插件'],
    [/游戏/, '游戏'],
    [/硬件|机器狗|机器人/, '硬件 + 软件服务'],
    [/API/i, 'API 服务'],
  ]);
  const validationScope = `${profile.validationGoal ?? '需求是否存在'} / ${profile.budgetRange ?? '$0-$50'}`;

  return [
    {
      key: 'productType',
      label: '产品类型',
      value: productType,
      helper: '用于判断竞品、替代方案和验证路径。',
      example: '例如 AI 工具、SaaS、App、游戏或硬件。',
      status: assumptionStatus(productType),
    },
    {
      key: 'targetMarket',
      label: '目标市场',
      value: marketValue,
      helper: '影响支付、本地化、渠道和合规风险。',
      example: ASSUMPTION_EXAMPLES.targetMarket,
      status: assumptionStatus(marketValue, targetMarket === PENDING_VALUE ? 'profile' : 'identified'),
    },
    {
      key: 'targetUser',
      label: '目标用户',
      value: pickTargetUser(text),
      helper: '决定访谈对象和需求强度判断。',
      example: ASSUMPTION_EXAMPLES.targetUser,
      status: assumptionStatus(pickTargetUser(text)),
    },
    {
      key: 'painPoint',
      label: '核心痛点',
      value: pickPainPoint(text),
      helper: '决定是否值得进入低成本验证。',
      example: ASSUMPTION_EXAMPLES.painPoint,
      status: assumptionStatus(pickPainPoint(text)),
    },
    {
      key: 'businessModel',
      label: '商业模式',
      value: businessModel,
      helper: '用于生成价格测试和停止门槛。',
      example: ASSUMPTION_EXAMPLES.businessModel,
      status: assumptionStatus(businessModel),
    },
    {
      key: 'acquisitionChannel',
      label: '获客渠道',
      value: acquisitionChannel,
      helper: '用于判断小预算测试是否可触达。',
      example: ASSUMPTION_EXAMPLES.acquisitionChannel,
      status: assumptionStatus(acquisitionChannel),
    },
    {
      key: 'platformForm',
      label: '平台形态',
      value: platformForm,
      helper: '影响上架、交付、合规和成本。',
      example: ASSUMPTION_EXAMPLES.platformForm,
      status: assumptionStatus(platformForm),
    },
    {
      key: 'validationScope',
      label: '验证周期 / 预算',
      value: validationScope,
      helper: '来自验证条件，用于约束行动计划。',
      example: '可在验证条件中调整。',
      status: 'profile',
    },
  ];
}

function getBackendJudgment(result: AnalyzeResponse | null): BackendJudgment | null {
  if (!result) return null;
  const data = result as AnalyzeResponseWithJudgment;
  if (data.judgment && typeof data.judgment === 'object') return data.judgment;
  if (data.assumptions || data.missingInfo) {
    return {
      assumptions: data.assumptions,
      missingInfo: data.missingInfo,
    };
  }
  return null;
}

function assumptionValueFromBackend(value: unknown) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed && trimmed !== '未明确' ? trimmed : PENDING_VALUE;
}

function missingKeysFromBackend(judgment: BackendJudgment | null) {
  const keys = new Set<string>();
  for (const item of judgment?.missingInfo ?? []) {
    if (typeof item === 'string') keys.add(item);
    else if (item.key) keys.add(item.key);
  }
  return keys;
}

function mergeBackendAssumptions(base: AssumptionItem[], judgment: BackendJudgment | null): AssumptionItem[] {
  if (!judgment?.assumptions) return base;
  const missingKeys = missingKeysFromBackend(judgment);
  return base.map((item) => {
    const backendValue = assumptionValueFromBackend(judgment.assumptions?.[item.key]);
    if (!backendValue) return item;
    return {
      ...item,
      value: backendValue,
      status: missingKeys.has(item.key) || backendValue === PENDING_VALUE ? 'missing' : 'identified',
    };
  });
}

function sourceModeCopy(source: 'real' | 'mock' | 'fallback', hasError: boolean) {
  if (hasError) {
    return {
      label: sourceModeLabel(source),
      title: sourceModeTitle(source, true),
      hint: sourceModeHint(source, true),
    };
  }
  return {
    label: sourceModeLabel(source),
    title: sourceModeTitle(source),
    hint: sourceModeHint(source),
  };
}

function getSource(): 'real' | 'mock' | 'fallback' {
  const source = new URLSearchParams(window.location.search).get('source');
  if (source === 'real' || source === 'fallback') return source;
  return 'mock';
}

function normalizeViewResult(result: AnalyzeResponse | null): AnalyzeResponse | null {
  if (!result) return null;
  return {
    ...result,
    matchedSignals: Array.isArray(result.matchedSignals) ? result.matchedSignals : [],
    matchedOpportunities: Array.isArray(result.matchedOpportunities) ? result.matchedOpportunities : [],
    clarifyingQuestions: Array.isArray(result.clarifyingQuestions) ? result.clarifyingQuestions : [],
    evidenceGaps: Array.isArray(result.evidenceGaps) ? result.evidenceGaps : [],
    warnings: Array.isArray(result.warnings) ? result.warnings : [],
    projectEvaluation: Array.isArray(result.projectEvaluation) ? result.projectEvaluation : [],
    riskBottlenecks: Array.isArray(result.riskBottlenecks) ? result.riskBottlenecks : [],
    mvpValidationPlan: Array.isArray(result.mvpValidationPlan) ? result.mvpValidationPlan : [],
    analysisTrace: Array.isArray(result.analysisTrace) ? result.analysisTrace : [],
    evidenceBoard: Array.isArray(result.evidenceBoard) ? result.evidenceBoard : [],
    relevanceScores: result.relevanceScores || { topSignalScores: [], rejectedSignals: [] },
    riskMatrix: Array.isArray(result.riskMatrix) ? result.riskMatrix : [],
    sevenDayPlan: Array.isArray(result.sevenDayPlan) ? result.sevenDayPlan : [],
    recommendation: result.recommendation || {
      title: '当前缺少足够相关信号，建议先做小样本验证',
      verdict: '持续观察',
      matchScore: 0,
      targetMarket: '未明确',
      evidenceStrength: 'low',
      summary: '当前结果缺少足够信息。',
      nextStep: '请继续补充输入后重试。',
    },
  };
}

function inspectInputQuality(query: string) {
  const text = query.trim();
  const hasTargetMarket =
    /日本|韩国|台湾|东南亚|美国|欧美|巴西|中东|土耳其|印度|印尼|泰国|越南|Global|Japan|US|SEA|Europe/i.test(text);
  const hasUser =
    /用户|开发者|学生|老师|团队|企业|卖家|创作者|运营|设计师|家长|老人|儿童|独居|B端|C端/i.test(text);
  const hasProduct =
    /AI|SaaS|工具|App|订阅|游戏|短剧|支付|机器人|机器狗|硬件|插件|平台|软件/i.test(text);
  const hasBusiness =
    /订阅|付费|广告|佣金|一次性|会员|充值|收款|支付|价格|客单价|售价|月费/i.test(text);
  const hasScenario =
    /用于|帮助|解决|提高|降低|自动|生成|管理|陪伴|学习|办公|营销|获客|养老|设计|素材|效率/i.test(text);
  const missing: string[] = [];
  if (!hasTargetMarket) missing.push('目标市场');
  if (!hasUser) missing.push('目标用户');
  if (!hasProduct) missing.push('产品类型');
  if (!hasScenario) missing.push('使用场景 / 核心痛点');
  if (!hasBusiness) missing.push('商业模式 / 付费方式');
  return { score: 5 - missing.length, isEnough: missing.length <= 2, missing };
}

function AnalyzeHero({
  source,
  qualityScore,
  analyzing,
  hasResult,
  hasError,
}: {
  source: 'real' | 'mock' | 'fallback';
  qualityScore: number;
  analyzing: boolean;
  hasResult: boolean;
  hasError: boolean;
}) {
  const sourceMode = sourceModeCopy(source, hasError);
  const statusItems = [
    { label: '输入质量', value: `${qualityScore}/5`, hint: qualityScore >= 3 ? '可进入判断' : '待补充条件' },
    { label: '数据状态', value: sourceMode.label, hint: sourceMode.hint },
    { label: '风险预判', value: analyzing || hasResult ? '已启动' : '待分析', hint: '先看支付、本地化、渠道' },
    { label: '下一步动作', value: hasResult ? '已生成' : '待输出', hint: '24h / 7d / Stop Gate' },
  ];

  return (
    <section className={styles.analyzeHero}>
      <div className={styles.heroCopy}>
        <span className={styles.heroEyebrow}>MARKET MVP VALIDATION WORKBENCH</span>
        <h1>把一个出海方向，拆成可验证的市场判断</h1>
        <p>
          输入产品、目标市场、用户和商业假设，HotPulse 会先检查输入质量，再拆解风险、证据和下一步验证动作。
        </p>
      </div>
      <aside className={styles.heroStatusCard} aria-label="验证工作台状态">
        <div className={styles.heroStatusHeader}>
          <span>Validation OS</span>
          <strong>{hasError ? 'Error' : analyzing ? 'Running' : hasResult ? 'Ready' : 'Standby'}</strong>
        </div>
        <div className={styles.sourceModeBanner}>
          <span>{sourceMode.title}</span>
          <p>{sourceMode.hint}</p>
        </div>
        <div className={styles.heroStatusGrid}>
          {statusItems.map((item) => (
            <div key={item.label} className={styles.heroStatusItem}>
              <span className={styles.statusDot} />
              <div>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <small>{item.hint}</small>
              </div>
            </div>
          ))}
        </div>
      </aside>
    </section>
  );
}

function ValidationStepper({ activeIndex }: { activeIndex: number }) {
  return (
    <nav className={styles.validationStepper} aria-label="市场 MVP 验证流程">
      {FLOW_STEPS.map((step, index) => {
        const stateClass = index < activeIndex
          ? styles.validationStepDone
          : index === activeIndex
            ? styles.validationStepActive
            : styles.validationStepIdle;
        return (
          <div key={step} className={`${styles.validationStep} ${stateClass}`}>
            <span className={styles.validationStepIndex}>{index + 1}</span>
            <strong>{step}</strong>
          </div>
        );
      })}
    </nav>
  );
}

function AssumptionExtractor({
  assumptions,
  missingCritical,
  query,
  onPatch,
}: {
  assumptions: AssumptionItem[];
  missingCritical: AssumptionItem[];
  query: string;
  onPatch: (snippet: string) => void;
}) {
  const hasInput = query.trim().length > 0;

  return (
    <section className={styles.assumptionPanel} aria-label="系统初步识别的判断要素">
      <div className={styles.assumptionHeader}>
        <div>
          <span className={styles.panelEyebrow}>Assumption Extractor</span>
          <h2>系统已识别的判断要素</h2>
          <p>以下为前端轻量规则的初步识别，可继续补充确认。缺失项会影响 Verdict、Score 和行动计划。</p>
        </div>
        <strong>{assumptions.filter((item) => item.status !== 'missing').length}/{assumptions.length}</strong>
      </div>

      <div className={styles.assumptionGrid}>
        {assumptions.map((item) => (
          <article
            key={item.key}
            className={`${styles.assumptionItem} ${
              item.status === 'missing'
                ? styles.assumptionItemMissing
                : item.status === 'profile'
                  ? styles.assumptionItemProfile
                  : styles.assumptionItemIdentified
            }`}
          >
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <p>{item.status === 'missing' ? item.example : item.helper}</p>
          </article>
        ))}
      </div>

      {missingCritical.length > 0 ? (
        <div className={styles.missingInfoPanel}>
          <div className={styles.missingInfoCopy}>
            <span className={styles.panelEyebrow}>Missing Information</span>
            <h3>{missingCritical.length >= 3 ? '信息不足，先补充关键假设' : '可进入低成本预验证，但需要补齐证据'}</h3>
            <p>
              {hasInput
                ? '补齐以下项后，系统才能把结论、证据覆盖和下一步动作连接起来。'
                : '先输入一个方向，或直接从示例补全开始。'}
            </p>
          </div>
          <div className={styles.missingInfoList}>
            {missingCritical.map((item) => (
              <button key={item.key} type="button" className={styles.missingInfoButton} onClick={() => onPatch(item.example)}>
                <span>{item.label}</span>
                <strong>{item.example}</strong>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function AnalyzePage() {
  const searchParams = new URLSearchParams(window.location.search);
  const queryFromUrl = searchParams.get('q') ?? '';
  const [source, setSource] = useState<'real' | 'mock' | 'fallback'>(() => getSource());
  const [query, setQuery] = useState(() => queryFromUrl || window.sessionStorage.getItem(ANALYZE_QUERY_KEY) || '');
  const [profile, setProfile] = useState<AnalyzeProfile>(DEFAULT_PROFILE);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [inputQuality, setInputQuality] = useState<{ missing: string[]; query: string } | null>(null);
  const [protocol, setProtocol] = useState<MarketMvpResearchProtocol | null>(null);

  useEffect(() => { setSource(getSource()); }, []);
  useEffect(() => { window.sessionStorage.setItem(ANALYZE_QUERY_KEY, query); }, [query]);
  useEffect(() => {
    if (!analyzing) return;
    setActiveStep(0);
    const timer = window.setInterval(() => setActiveStep((current) => Math.min(current + 1, 4)), 650);
    return () => window.clearInterval(timer);
  }, [analyzing]);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setInputQuality(null);
    setError(null);
  };

  const applyQualityExample = (value: string) => {
    setQuery(value);
    setInputQuality(null);
    window.sessionStorage.setItem(ANALYZE_QUERY_KEY, value);
  };

  const appendAssumptionSnippet = (snippet: string) => {
    const normalizedSnippet = snippet.replace(/^.+：例如/, '').replace(/^.+：/, '').trim();
    const nextQuery = query.trim() ? `${query.trim()}，${normalizedSnippet}` : normalizedSnippet;
    setQuery(nextQuery);
    setInputQuality(null);
    setError(null);
    window.sessionStorage.setItem(ANALYZE_QUERY_KEY, nextQuery);
  };

  const runAnalyze = async () => {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      setResult(null);
      setProtocol(null);
      setInputQuality(null);
      setError('请先输入产品、想法或目标市场。');
      return;
    }
    const quality = inspectInputQuality(normalizedQuery);
    const nextProtocol = buildMarketMvpResearchProtocol(normalizedQuery);
    setProtocol(nextProtocol);
    if (!quality.isEnough) {
      setInputQuality({ missing: quality.missing, query: normalizedQuery });
      setResult(null);
      setError(null);
      setAnalyzing(false);
      setActiveStep(0);
      return;
    }
    setError(null);
    setResult(null);
    setInputQuality(null);
    setAnalyzing(true);
    try {
      const response = await analyzeOpportunity({ query: normalizedQuery, source, profile });
      setSource(response.source);
      setResult(normalizeViewResult(response));
      setActiveStep(5);
    } catch (requestError) {
      console.warn('Analyze request failed', requestError);
      setProtocol(null);
      setError('分析服务未连接。请稍后重试，或切换样本模式查看验证结构。');
    } finally {
      setAnalyzing(false);
    }
  };

  const resetAll = () => {
    setQuery('');
    setResult(null);
    setError(null);
    setInputQuality(null);
    setProtocol(null);
    setActiveStep(0);
    window.sessionStorage.removeItem(ANALYZE_QUERY_KEY);
  };

  const viewResult = useMemo(() => normalizeViewResult(result), [result]);
  const backendJudgment = useMemo(() => getBackendJudgment(viewResult), [viewResult]);
  const displaySource = backendJudgment && (backendJudgment as { mode?: 'real' | 'mock' | 'fallback' }).mode
    ? (backendJudgment as { mode: 'real' | 'mock' | 'fallback' }).mode
    : source;
  const currentQuality = useMemo(() => (query.trim() ? inspectInputQuality(query) : { score: 0, isEnough: false, missing: [] }), [query]);
  const assumptions = useMemo(
    () => mergeBackendAssumptions(extractAssumptions(query, profile), backendJudgment),
    [backendJudgment, profile, query],
  );
  const missingCritical = useMemo(
    () => assumptions.filter((item) => CRITICAL_ASSUMPTION_KEYS.includes(item.key) && item.status === 'missing'),
    [assumptions],
  );
  const hasBlockingError = Boolean(error && !viewResult);
  const flowActiveIndex = useMemo(() => {
    if (viewResult && protocol?.canJudge) return 4;
    if (analyzing) return 3;
    if (inputQuality) return 2;
    if (query.trim()) return 1;
    return 0;
  }, [analyzing, inputQuality, protocol?.canJudge, query, viewResult]);

  return (
    <AppShell>
      <div className={styles.page}>
        <TopNav />
        <AnalyzeHero
          source={displaySource}
          qualityScore={currentQuality.score}
          analyzing={analyzing}
          hasResult={Boolean(viewResult && protocol?.canJudge)}
          hasError={hasBlockingError}
        />
        <ValidationStepper activeIndex={flowActiveIndex} />
        <AnalyzeWorkbench
          query={query}
          source={source}
          analyzing={analyzing}
          onQueryChange={handleQueryChange}
          onSubmit={runAnalyze}
          onReset={resetAll}
        />
        <AssumptionExtractor
          assumptions={assumptions}
          missingCritical={missingCritical}
          query={query}
          onPatch={appendAssumptionSnippet}
        />
        {!viewResult ? <AnalyzeAdvancedOptions profile={profile} onChange={setProfile} /> : null}
        {inputQuality ? (
          <AnalyzeInputQualityGate missing={inputQuality.missing} query={inputQuality.query} onExampleApply={applyQualityExample} />
        ) : null}
        {analyzing ? <AnalyzeProgressPanel activeIndex={activeStep} done={false} steps={viewResult?.steps} /> : null}
        {protocol ? (
          <MarketMvpResearchProtocolPanel
            protocol={protocol}
            source={source}
            result={viewResult}
            missingCriticalCount={missingCritical.length}
          />
        ) : null}
        {error && viewResult ? (
          <section className={styles.serviceNotice}>
            <strong>服务状态提醒</strong>
            <p>本次请求出现服务异常，页面保留上一轮结果作为参考。请重新分析后再做最终判断。</p>
          </section>
        ) : null}
        {error && !viewResult ? (
          <section className={styles.errorCard}>
            <h2>分析服务未连接</h2>
            <p>分析服务未连接。请稍后重试，或切换样本模式查看验证结构。</p>
            <div className={styles.actionsRow}>
              <button type="button" className={styles.primaryButton} onClick={runAnalyze}>重新分析</button>
              <a className={styles.ghostButton} href={`/signals?source=${source}`}>查看市场信号</a>
            </div>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
