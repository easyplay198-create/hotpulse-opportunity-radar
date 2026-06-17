import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { analyzeOpportunityStream } from '../../api/analyzeOpportunity';
import { AppShell } from '../../components/layout/AppShell';
import { TopNav } from '../../components/layout/TopNav';
import { AnalyzeAdvancedOptions } from '../../components/analyze/AnalyzeAdvancedOptions';
import { AnalyzeWorkbench } from '../../components/analyze/AnalyzeWorkbench';
import { MarketMvpResearchProtocolPanel } from '../../components/analyze/MarketMvpResearchProtocolPanel';
import { sourceModeHint, sourceModeLabel, sourceModeTitle } from '../../components/analyze/analyzePresentation';
import type { AnalyzeProfile, AnalyzeResponse } from '../../types/analyze';
import type { AnalyzeProgressEvent, AnalyzeProviderEvent, AnalyzeStreamStatus, AnalyzeUiStageKey } from '../../types/analyzeStream';
import { buildMarketMvpResearchProtocol, type MarketMvpResearchProtocol } from '../../lib/marketMvpResearchProtocol';
import { buildReportInputFromProfile, saveReport } from '../../lib/reportStorage';
import {
  applyFieldAnswer,
  clarificationStatusLabel,
  countExplicitFields,
  hasAllExplicit,
  mergeStructuredBrief,
  parseClarificationResult,
  toStructuredConditions,
  validateClarificationAnswer,
  type ClarificationParseSeed,
  type ClarificationFieldKey,
  type ClarificationFieldState,
  type ClarificationQuestion,
} from '../../lib/analyzeClarification';
import styles from './AnalyzePage.module.css';

type AnalyzeSource = 'real' | 'mock' | 'fallback';

const ANALYZE_QUERY_KEY = 'hotpulse_analyze_query';
const AUTO_RUN_ONCE_PREFIX = 'hotpulse_auto_run_once';
const DEFAULT_PROFILE: AnalyzeProfile = {
  productStage: '想法阶段',
  targetMarket: 'Global',
  budgetRange: '$0-$50',
  validationGoal: '需求是否存在',
};

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

type CompletedAnalysisInput = {
  query: string;
  profile: AnalyzeProfile;
};

type WorkflowRunStatus = 'idle' | 'preparing' | 'streaming' | 'completed' | 'failed' | 'cancelled' | 'compatibility_fallback';

type WorkflowStageItem = {
  key: AnalyzeUiStageKey;
  label: string;
  status: AnalyzeStreamStatus;
  message: string;
  startedAt?: number;
  endedAt?: number;
  metrics?: Record<string, unknown>;
};

type AnalyzeResponseWithJudgment = AnalyzeResponse & {
  judgment?: BackendJudgment;
  assumptions?: Record<string, unknown>;
  missingInfo?: Array<string | { key?: string; label?: string }>;
};

type GateFieldKey = 'productType' | 'targetMarket' | 'targetUser' | 'painPoint' | 'businessModel';

type ClarificationPhase = 'idle' | 'questioning' | 'confirm';
type ClarificationAnswerMode = 'option' | 'custom' | 'undecided' | null;

type ClarificationSession = {
  sourceQuery: string;
  phase: ClarificationPhase;
  fields: Record<GateFieldKey, ClarificationFieldState>;
  questions: ClarificationQuestion[];
  questionIndex: number;
  answeredFields: Partial<Record<GateFieldKey, boolean>>;
  answerModeByField: Partial<Record<GateFieldKey, ClarificationAnswerMode>>;
  customDraftByField: Partial<Record<GateFieldKey, string>>;
  customErrorByField: Partial<Record<GateFieldKey, string>>;
  customSavedByField: Partial<Record<GateFieldKey, boolean>>;
};

type ClarificationDerivedProgress = {
  explicitCount: number;
  unresolvedCount: number;
  answeredQuestionCount: number;
  questionTotal: number;
  currentQuestionNumber: number;
  canStartAnalyze: boolean;
};

const REQUIRED_GATE_FIELDS: Array<{ key: GateFieldKey; label: string }> = [
  { key: 'productType', label: '产品类型' },
  { key: 'targetMarket', label: '目标市场' },
  { key: 'targetUser', label: '目标用户' },
  { key: 'painPoint', label: '核心痛点' },
  { key: 'businessModel', label: '商业模式' },
];

function initAnsweredFields(fields: Record<GateFieldKey, ClarificationFieldState>) {
  return REQUIRED_GATE_FIELDS.reduce<Partial<Record<GateFieldKey, boolean>>>((acc, item) => {
    acc[item.key] = fields[item.key].status === 'explicit';
    return acc;
  }, {});
}

function initAnswerModes(fields: Record<GateFieldKey, ClarificationFieldState>) {
  return REQUIRED_GATE_FIELDS.reduce<Partial<Record<GateFieldKey, ClarificationAnswerMode>>>((acc, item) => {
    const field = fields[item.key];
    if (field.value === '暂未确定') {
      acc[item.key] = 'undecided';
    } else if (field.status === 'explicit') {
      acc[item.key] = 'option';
    } else {
      acc[item.key] = null;
    }
    return acc;
  }, {});
}

const PENDING_VALUE = '待补充';
const CRITICAL_ASSUMPTION_KEYS = ['targetMarket', 'targetUser', 'painPoint', 'businessModel', 'acquisitionChannel', 'platformForm'];

const WORKFLOW_STAGE_SPECS: Array<{ key: AnalyzeUiStageKey; label: string }> = [
  { key: 'goal_understanding', label: '理解验证目标' },
  { key: 'condition_check', label: '检查进入条件' },
  { key: 'signal_collection', label: '收集市场信号' },
  { key: 'evidence_building', label: '构建证据链' },
  { key: 'canonical_judgment', label: '执行进入判断' },
  { key: 'report_generation', label: '生成验证报告' },
];

const STAGE_MAP: Record<string, AnalyzeUiStageKey> = {
  input_received: 'goal_understanding',
  brief_parsed: 'goal_understanding',
  conditions_checked: 'condition_check',
  providers_started: 'signal_collection',
  evidence_normalized: 'evidence_building',
  canonical_judgment: 'canonical_judgment',
  explanation_generation: 'report_generation',
  report_assembled: 'report_generation',
};

function initialWorkflowStages(): WorkflowStageItem[] {
  return WORKFLOW_STAGE_SPECS.map((item) => ({
    key: item.key,
    label: item.label,
    status: 'waiting',
    message: '等待开始',
  }));
}

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

function getSource(): AnalyzeSource {
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

function AnalyzeHero({
  source,
  qualityScore,
  analyzing,
  hasResult,
  hasError,
  statusOverride,
}: {
  source: 'real' | 'mock' | 'fallback';
  qualityScore: number;
  analyzing: boolean;
  hasResult: boolean;
  hasError: boolean;
  statusOverride?: string;
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
        <span className={styles.heroEyebrow}>出海验证工具</span>
        <h1 className={styles.heroTitle}>
          <span className={styles.heroTitleSegment}>看清方向，</span>
          <span className={styles.heroTitleSegment}>再决定进入</span>
        </h1>
        <p className={styles.heroSubtitle}>
          用市场信号、证据强度与风险，判断现在该继续、暂缓还是停止。
        </p>
      </div>
      <aside className={styles.heroStatusCard} aria-label="验证工作台状态">
        <div className={styles.heroStatusHeader}>
          <span>Validation OS</span>
          <strong>{statusOverride ?? (hasError ? 'Error' : analyzing ? 'Running' : hasResult ? 'Ready' : 'Standby')}</strong>
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

function ClarificationBadge({ status }: { status: ClarificationFieldState['status'] }) {
  const className = [
    styles.clarificationBadge,
    status === 'explicit'
      ? styles.clarificationBadgeExplicit
      : status === 'ambiguous'
        ? styles.clarificationBadgeAmbiguous
        : status === 'inferred'
          ? styles.clarificationBadgeInferred
          : styles.clarificationBadgeMissing,
  ].join(' ');
  return <span className={className}>{clarificationStatusLabel(status)}</span>;
}

function ClarificationGuide({
  session,
  progress,
  focusRequest,
  onSelectOption,
  onEnterCustomMode,
  onCustomDraftChange,
  onConfirmCustomAnswer,
  onBackQuestion,
  onNextQuestion,
  onEditField,
  onFocusUnresolved,
  onConfirm,
}: {
  session: ClarificationSession;
  progress: ClarificationDerivedProgress;
  focusRequest: { field: ClarificationFieldKey; seq: number } | null;
  onSelectOption: (field: ClarificationFieldKey, value: string) => void;
  onEnterCustomMode: (field: ClarificationFieldKey) => void;
  onCustomDraftChange: (field: ClarificationFieldKey, value: string) => void;
  onConfirmCustomAnswer: (field: ClarificationFieldKey) => void;
  onBackQuestion: () => void;
  onNextQuestion: () => void;
  onEditField: (field: ClarificationFieldKey, value: string) => void;
  onFocusUnresolved: () => void;
  onConfirm: () => void;
}) {
  const [highlightField, setHighlightField] = useState<ClarificationFieldKey | null>(null);
  const customInputRef = useRef<HTMLInputElement | null>(null);
  const summaryFieldRefs = useRef<Partial<Record<GateFieldKey, HTMLInputElement | null>>>({});
  const {
    explicitCount,
    unresolvedCount,
    answeredQuestionCount,
    questionTotal,
    currentQuestionNumber,
    canStartAnalyze,
  } = progress;
  const unresolvedLabels = REQUIRED_GATE_FIELDS
    .filter(({ key }) => session.fields[key].status !== 'explicit')
    .map(({ label }) => label);
  const currentQuestion = session.questions[session.questionIndex];
  const currentAnswered = currentQuestion ? Boolean(session.answeredFields[currentQuestion.field]) : false;
  const currentField = currentQuestion?.field;
  const currentValue = currentField ? session.fields[currentField].value : '';
  const currentMode = currentField ? (session.answerModeByField[currentField] ?? null) : null;
  const customValue = currentField ? (session.customDraftByField[currentField] ?? '') : '';
  const customError = currentField ? (session.customErrorByField[currentField] ?? '') : '';
  const customSaved = currentField ? Boolean(session.customSavedByField[currentField]) : false;
  const isUndecidedSelected = currentQuestion
    ? currentMode === 'undecided' && currentAnswered && currentValue === '暂未确定'
    : false;

  useEffect(() => {
    if (!focusRequest) return;
    const target = summaryFieldRefs.current[focusRequest.field];
    if (!target) return;
    setHighlightField(focusRequest.field);
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.focus();
    const timer = window.setTimeout(() => setHighlightField((current) => (current === focusRequest.field ? null : current)), 1800);
    return () => window.clearTimeout(timer);
  }, [focusRequest?.seq, focusRequest?.field]);

  if (session.phase === 'idle') return null;

  if (session.phase === 'questioning' && currentQuestion) {
    return (
      <section className={styles.clarificationPanel} aria-label="智能补问向导">
        <div className={styles.clarificationHeader}>
          <div>
            <span className={styles.panelEyebrow}>Clarification Guide</span>
            <h2>{unresolvedCount === 0 ? '主要问题已完成' : `还需要确认 ${unresolvedCount} 项验证条件`}</h2>
            <p>{unresolvedCount === 0 ? '请进入 Brief 确认，检查信息后再开始验证。' : '先完成以下主要问题，再检查最终 Brief。'}</p>
          </div>
          <strong>补问进度 {answeredQuestionCount} / {questionTotal}</strong>
        </div>
        <div className={styles.clarificationQuestionCard}>
          <span className={styles.clarificationQuestionIndex}>问题 {currentQuestionNumber} / {questionTotal}</span>
          <h3>{currentQuestion.prompt}</h3>
          <p>{currentQuestion.helper}</p>
          <div className={styles.clarificationOptionGrid}>
            {currentQuestion.options.map((option) => (
              (() => {
                const isOtherOption = option.label.includes('其他');
                const isSelected = currentAnswered && currentMode !== 'custom' && currentValue === option.value;
                const className = [
                  styles.clarificationOptionButton,
                  isOtherOption && currentMode === 'custom' ? styles.clarificationOptionSelected : '',
                  isSelected ? styles.clarificationOptionSelected : '',
                  isSelected && option.value === '暂未确定' ? styles.clarificationOptionUndecided : '',
                ].filter(Boolean).join(' ');
                return (
                  <button
                    key={option.label}
                    type="button"
                    className={className}
                    onClick={() => {
                      if (isOtherOption) {
                        onEnterCustomMode(currentQuestion.field);
                        window.setTimeout(() => customInputRef.current?.focus(), 0);
                        return;
                      }
                      onSelectOption(currentQuestion.field, option.value);
                    }}
                  >
                    <span>{option.label}</span>
                    {option.suggested ? <small>系统建议</small> : null}
                  </button>
                );
              })()
            ))}
          </div>
          {isUndecidedSelected ? (
            <div className={styles.clarificationUndecidedHint}>
              你可以继续完成其他问题，但该项仍需补充，暂时不能生成完整验证判断。
            </div>
          ) : null}
          {currentMode === 'custom' ? (
            <label className={styles.clarificationCustomField}>
              <span>自定义回答</span>
              <div className={styles.clarificationCustomRow}>
                <input
                  ref={customInputRef}
                  value={customValue}
                  onChange={(event) => onCustomDraftChange(currentQuestion.field, event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      onConfirmCustomAnswer(currentQuestion.field);
                    }
                  }}
                  placeholder="输入你的确认内容"
                />
                <button
                  type="button"
                  className={`${styles.commandSecondaryButton} ${styles.clarificationCustomSaveButton}`}
                  onClick={() => onConfirmCustomAnswer(currentQuestion.field)}
                  disabled={!customValue.trim()}
                >
                  确认自定义答案
                </button>
              </div>
              {customError ? <small className={styles.clarificationCustomError}>{customError}</small> : null}
            </label>
          ) : null}
          {customSaved && currentMode === 'custom'
            ? <span className={styles.clarificationSavedHint}>已选择：自定义答案</span>
            : null}
          <div className={styles.clarificationActions}>
            <button type="button" className={styles.commandSecondaryButton} onClick={onBackQuestion} disabled={session.questionIndex === 0}>
              上一题
            </button>
            <button type="button" className={styles.commandPrimaryButton} onClick={onNextQuestion} disabled={!currentAnswered}>
              {session.questionIndex + 1 >= session.questions.length ? '进入 Brief 确认' : '下一题'}
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.clarificationPanel} aria-label="验证 Brief 确认">
      <div className={styles.clarificationHeader}>
        <div>
          <span className={styles.panelEyebrow}>Structured Brief</span>
          <h2>验证 Brief 确认</h2>
          <p>已确认 {explicitCount} / 5 项验证条件</p>
        </div>
        <strong>{explicitCount} / 5</strong>
      </div>
      <div className={styles.clarificationSummaryGrid}>
        {REQUIRED_GATE_FIELDS.map(({ key, label }) => {
          const field = session.fields[key];
          return (
            <label
              key={key}
              className={`${styles.clarificationSummaryItem} ${
                field.status !== 'explicit' ? styles.clarificationSummaryItemPending : styles.clarificationSummaryItemReady
              } ${highlightField === key ? styles.clarificationSummaryItemFocused : ''}`}
              data-field={key}
            >
              <div className={styles.clarificationSummaryTop}>
                <span>{label}</span>
                <ClarificationBadge status={field.status} />
              </div>
              <input
                ref={(node) => {
                  summaryFieldRefs.current[key] = node;
                }}
                value={field.value}
                placeholder="请确认该字段"
                onChange={(event) => onEditField(key, event.target.value)}
              />
              <small>
                {field.value === '暂未确定'
                  ? '用户暂未确定，该项尚未满足完整验证条件'
                  : field.reason}
              </small>
            </label>
          );
        })}
      </div>
      {!canStartAnalyze ? (
        <div className={styles.clarificationLimitCard}>
          <strong>当前能判断什么</strong>
          <p>可识别已明确条件与待确认风险优先级。</p>
          <strong>当前不能判断什么</strong>
          <p>无法生成完整进入结论，最优先补齐：{unresolvedLabels[0] ?? '目标市场'}。</p>
        </div>
      ) : null}
      <div className={styles.clarificationActions}>
        <button type="button" className={styles.commandSecondaryButton} onClick={onBackQuestion}>
          返回修改
        </button>
        <button
          type="button"
          className={styles.commandPrimaryButton}
          onClick={canStartAnalyze ? onConfirm : onFocusUnresolved}
        >
          {canStartAnalyze ? '确认并开始验证' : '定位待确认项'}
        </button>
      </div>
    </section>
  );
}

function SaveReportPanel({
  result,
  completedAnalysisInput,
  savedReportId,
  onSaved,
}: {
  result: AnalyzeResponse | null;
  completedAnalysisInput: CompletedAnalysisInput | null;
  savedReportId: string | null;
  onSaved: (id: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!result || !completedAnalysisInput) return null;

  const handleSave = () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    const reportInput = buildReportInputFromProfile(
      completedAnalysisInput.query,
      completedAnalysisInput.profile,
      result,
    );
    const saved = saveReport({
      existingId: savedReportId,
      projectDescription: reportInput.projectDescription,
      targetMarket: reportInput.targetMarket,
      productType: reportInput.productType,
      result,
    });
    setSaving(false);
    if (!saved.ok || !saved.report) {
      setError(saved.error ?? '报告保存失败，请稍后重试。');
      return;
    }
    onSaved(saved.report.id);
    setMessage('已保存到当前浏览器');
  };

  return (
    <section className={styles.saveReportPanel} aria-label="保存验证报告">
      <div>
        <span className={styles.panelEyebrow}>Saved Report</span>
        <h3>{message ?? '保存到我的报告'}</h3>
        <p>报告仅保存在当前浏览器，可随时在“我的报告”中查看。</p>
        {error ? <small className={styles.saveReportError}>{error}</small> : null}
      </div>
      <div className={styles.saveReportActions}>
        <button type="button" className={styles.primaryButton} onClick={handleSave} disabled={saving}>
          {message ? '已保存到当前浏览器' : saving ? '保存中...' : '保存到我的报告'}
        </button>
        {savedReportId ? <a className={styles.ghostButton} href="/report">查看我的报告</a> : null}
      </div>
    </section>
  );
}

function formatElapsed(startedAt?: number, endedAt?: number): string {
  if (!startedAt) return '--';
  const isLive = endedAt === undefined;
  const diff = Math.max(0, (endedAt ?? Date.now()) - startedAt);
  if (!isLive && diff < 100) return '瞬时完成';
  if (diff < 1000) return `${diff}ms`;
  return `${(diff / 1000).toFixed(1)}s`;
}

const WORKFLOW_RUN_STATUS_LABEL: Record<WorkflowRunStatus, string> = {
  idle: '待机',
  preparing: '准备中',
  streaming: '执行中',
  completed: '验证完成',
  failed: '执行失败',
  cancelled: '已取消',
  compatibility_fallback: '兼容模式',
};

const STAGE_STATUS_LABEL: Record<string, string> = {
  waiting: '等待执行',
  running: '进行中',
  completed: '已完成',
  partial: '部分完成',
  failed: '失败',
};

function buildProviderActivityMessage(event: AnalyzeProviderEvent): string {
  const name = event.provider;
  if (event.status === 'skipped') return `${name} · 已跳过`;
  if (event.status === 'failed') return `${name} · 载入失败`;
  const accepted = event.metrics?.accepted;
  return `${name} · ${typeof accepted === 'number' ? `${accepted} 条证据` : '已载入'}`;
}

function BriefConditionsChecklist({
  conditionStatus,
}: {
  conditionStatus: Array<{ key: string; label: string; filled: boolean }>;
}) {
  const filledCount = conditionStatus.filter((s) => s.filled).length;
  const total = conditionStatus.length;
  const allFilled = filledCount === total;
  return (
    <div className={styles.briefConditions}>
      <div className={styles.briefConditionsHeader}>
        <span>验证条件</span>
        <strong>
          {filledCount} / {total} · {allFilled ? '已满足完整验证要求' : `还需补齐 ${total - filledCount} 项`}
        </strong>
      </div>
      <div className={styles.briefConditionsList}>
        {conditionStatus.map((item) => (
          <span
            key={item.key}
            className={`${styles.briefConditionChip} ${item.filled ? styles.briefConditionChipFilled : styles.briefConditionChipMissing}`}
          >
            <span className={styles.briefConditionDot}>{item.filled ? '✓' : '○'}</span>
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function AnalyzeWorkflowPanel({
  runStatus,
  stages,
  providers,
  compatibilityFallback,
  activityLog,
}: {
  runStatus: WorkflowRunStatus;
  stages: WorkflowStageItem[];
  providers: AnalyzeProviderEvent[];
  compatibilityFallback: boolean;
  activityLog: string[];
}) {
  const [, setTick] = useState(0);
  const [detailsExpanded, setDetailsExpanded] = useState(true);
  const hasUserToggledRef = useRef(false);
  const runningStage = stages.find((s) => s.status === 'running');

  // Live timer for running stage elapsed
  useEffect(() => {
    if (!runningStage) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 200);
    return () => window.clearInterval(id);
  }, [runningStage?.key, runningStage?.status]);

  // Auto expand/collapse on run status transitions
  useEffect(() => {
    if (runStatus === 'preparing') {
      hasUserToggledRef.current = false;
      setDetailsExpanded(true);
      return;
    }
    if (!hasUserToggledRef.current) {
      if (runStatus === 'completed') setDetailsExpanded(false);
      if (runStatus === 'failed') setDetailsExpanded(true);
    }
  }, [runStatus]);

  const handleToggleDetails = () => {
    hasUserToggledRef.current = true;
    setDetailsExpanded((v) => !v);
  };

  const completedCount = stages.filter(
    (s) => s.status === 'completed' || s.status === 'partial' || s.status === 'failed',
  ).length;
  const hasPartialOrFailed = stages.some((s) => s.status === 'partial' || s.status === 'failed');
  const isCompleted = runStatus === 'completed';
  const isFailed = runStatus === 'failed';
  const isActive = runStatus === 'preparing' || runStatus === 'streaming' || runStatus === 'compatibility_fallback';

  // ── Idle state: compact waiting card ──
  if (runStatus === 'idle') {
    return (
      <section className={styles.workflowIdleCard} aria-label="验证执行工作流">
        <span className={styles.workflowIdleIcon}>◎</span>
        <div className={styles.workflowIdleText}>
          <strong>等待开始验证</strong>
          <span>确认 Brief 后，系统将开始构建证据链和进入判断。</span>
        </div>
      </section>
    );
  }

  // ── Completed state: collapsed summary ──
  if (isCompleted && !detailsExpanded) {
    const totalMs = (() => {
      const mn = stages.reduce<number>((acc, s) => (s.startedAt && s.startedAt < acc ? s.startedAt : acc), Infinity);
      const mx = stages.reduce<number>((acc, s) => (s.endedAt && s.endedAt > acc ? s.endedAt : acc), 0);
      return mn !== Infinity && mx > 0 ? mx - mn : null;
    })();
    const totalStr = totalMs !== null
      ? (totalMs < 1000 ? `${totalMs}ms` : `${(totalMs / 1000).toFixed(1)}s`)
      : null;
    const hints: string[] = [];
    if (compatibilityFallback) hints.push('兼容模式');
    if (hasPartialOrFailed) hints.push('部分降级');
    return (
      <section className={styles.workflowCompletedCard} aria-label="验证执行工作流">
        <div className={styles.workflowCompletedSummary}>
          <span className={styles.workflowCompletedIcon}>✓</span>
          <div className={styles.workflowCompletedInfo}>
            <strong>验证完成</strong>
            <span>
              {stages.length} / {stages.length} 个阶段
              {totalStr ? ` · 总耗时 ${totalStr}` : ''}
              {hints.length > 0 ? ` · ${hints.join(' · ')}` : ''}
            </span>
          </div>
          <button type="button" className={styles.workflowToggleButton} onClick={handleToggleDetails}>
            查看执行过程
          </button>
        </div>
      </section>
    );
  }

  // ── Cancelled state: compact card ──
  if (runStatus === 'cancelled') {
    return (
      <section className={styles.workflowCancelledCard} aria-label="验证执行工作流">
        <span className={styles.workflowCancelledIcon}>✕</span>
        <div className={styles.workflowIdleText}>
          <strong>已取消</strong>
          <span>验证请求已被中止。</span>
        </div>
      </section>
    );
  }

  // ── Full panel: active / failed / user-expanded completed ──
  const currentStageName = runningStage?.label
    ?? (isCompleted ? '验证已完成' : isFailed ? '验证执行失败' : '准备中');

  const statusBarClass = [
    styles.workflowStatusBar,
    isActive && runningStage ? styles.workflowStatusBarStreaming : '',
    isCompleted ? styles.workflowStatusBarCompleted : '',
    isFailed ? styles.workflowStatusBarFailed : '',
  ].filter(Boolean).join(' ');

  const recentActivity = [...activityLog].reverse().slice(0, 5);

  return (
    <section className={styles.workflowPanel} aria-label="验证执行工作流">
      <div className={styles.workflowHeader}>
        <div>
          <span className={styles.panelEyebrow}>Validation Workflow</span>
          <h2>验证执行工作台</h2>
        </div>
        <div className={styles.workflowHeaderRight}>
          {isCompleted ? (
            <button type="button" className={styles.workflowToggleButton} onClick={handleToggleDetails}>
              收起执行过程
            </button>
          ) : null}
          <strong>{WORKFLOW_RUN_STATUS_LABEL[runStatus] ?? runStatus}</strong>
        </div>
      </div>

      {/* Real-time top status bar */}
      <div className={statusBarClass}>
        <div className={styles.workflowStatusMain}>
          <span className={styles.workflowStatusStageName}>{currentStageName}</span>
          <span className={styles.workflowStatusMeta}>
            已完成 {completedCount} / {stages.length} 个阶段
          </span>
        </div>
        {runningStage?.startedAt ? (
          <span className={styles.workflowStatusElapsed}>
            当前已运行 {formatElapsed(runningStage.startedAt)}
          </span>
        ) : null}
      </div>

      {compatibilityFallback ? (
        <div className={styles.workflowFallbackNotice}>
          流式接口不可用，已切换兼容模式（普通请求）。
        </div>
      ) : null}

      {/* Vertical stage list */}
      <div className={styles.workflowStageListV}>
        {stages.map((stage) => {
          if (stage.status === 'running') {
            return (
              <article key={stage.key} className={styles.workflowStageRunningCard}>
                <div className={styles.workflowStageRunningTop}>
                  <strong>{stage.label}</strong>
                  <span>进行中 · 已运行 {formatElapsed(stage.startedAt)}</span>
                </div>
                <p className={styles.workflowStageRunningMsg}>{stage.message}</p>
                <div className={styles.workflowProgressTrack}>
                  <div className={styles.workflowProgressFill} />
                </div>
              </article>
            );
          }

          let iconClass = styles.workflowStageIconWaiting;
          let colorClass = styles.workflowStageWaitingColor;
          let iconContent = '○';
          let metaText = STAGE_STATUS_LABEL[stage.status] ?? stage.status;

          if (stage.status === 'completed') {
            iconClass = styles.workflowStageIconCompleted;
            colorClass = styles.workflowStageCompletedColor;
            iconContent = '✓';
            metaText = formatElapsed(stage.startedAt, stage.endedAt);
          } else if (stage.status === 'partial') {
            iconClass = styles.workflowStageIconPartial;
            colorClass = styles.workflowStagePartialColor;
            iconContent = '△';
            metaText = `部分完成 · ${formatElapsed(stage.startedAt, stage.endedAt)}`;
          } else if (stage.status === 'failed') {
            iconClass = styles.workflowStageIconFailed;
            colorClass = styles.workflowStageFailedColor;
            iconContent = '✗';
            metaText = `失败 · ${formatElapsed(stage.startedAt, stage.endedAt)}`;
          }

          const isTerminal = stage.status === 'completed' || stage.status === 'partial' || stage.status === 'failed';

          return (
            <article key={stage.key} className={`${styles.workflowStageCompactCard} ${colorClass}`}>
              <span className={`${styles.workflowStageIcon} ${iconClass}`}>{iconContent}</span>
              <span className={styles.workflowStageCompactLabel}>{stage.label}</span>
              <small className={isTerminal ? styles.workflowStageCompactMetaHighlight : styles.workflowStageCompactMeta}>
                {metaText}
              </small>
            </article>
          );
        })}
      </div>

      {/* Recent activity feed */}
      {recentActivity.length > 0 ? (
        <div className={styles.workflowRecentActivity}>
          <span className={styles.workflowRecentActivityLabel}>最近动态</span>
          {recentActivity.map((msg, i) => (
            <div key={i} className={i === 0 ? styles.workflowActivityLatest : styles.workflowActivityItem}>
              {msg}
            </div>
          ))}
        </div>
      ) : null}

      {/* Provider details */}
      {providers.length > 0 ? (
        <details className={styles.workflowProviders}>
          <summary>提供方明细（{providers.length}）</summary>
          <div className={styles.workflowProviderList}>
            {providers.map((provider, index) => (
              <article key={`${provider.provider}-${provider.timestamp}-${index}`} className={styles.workflowProviderItem}>
                <strong>{provider.provider}</strong>
                <span>{provider.status}</span>
                <small>
                  {provider.message}
                  {provider.metrics && typeof provider.metrics.accepted === 'number'
                    ? ` · ${provider.metrics.accepted} 条证据`
                    : ''}
                  {provider.metrics && typeof provider.metrics.elapsedMs === 'number'
                    ? ` · ${provider.metrics.elapsedMs}ms`
                    : ''}
                </small>
              </article>
            ))}
          </div>
        </details>
      ) : null}
    </section>
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
            <h3>{missingCritical.length >= 3 ? '还需要补齐关键假设，才能提升判断可靠性' : '还需补齐证据，确认后才能生成完整判断'}</h3>
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
  const targetMarketFromUrl = searchParams.get('targetMarket') ?? '';
  const productTypeFromUrl = searchParams.get('productType') ?? '';
  const opportunityIdFromUrl = searchParams.get('opportunityId') ?? '';
  const sourceFromUrl = searchParams.get('source') ?? '';
  const autoRunFromUrl = searchParams.get('auto') === '1';
  const isOpportunityEntry = Boolean(autoRunFromUrl && queryFromUrl.trim() && opportunityIdFromUrl && sourceFromUrl === 'real');
  const autoRunKey = isOpportunityEntry
    ? `${opportunityIdFromUrl || 'opportunity'}:${productTypeFromUrl}:${queryFromUrl.trim()}`
    : null;
  const [source, setSource] = useState<AnalyzeSource>(() => getSource());
  const [query, setQuery] = useState(() => queryFromUrl || window.sessionStorage.getItem(ANALYZE_QUERY_KEY) || '');
  const [profile, setProfile] = useState<AnalyzeProfile>(() => ({
    ...DEFAULT_PROFILE,
    targetMarket: targetMarketFromUrl || DEFAULT_PROFILE.targetMarket,
  }));
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [protocol, setProtocol] = useState<MarketMvpResearchProtocol | null>(null);
  const [savedReportId, setSavedReportId] = useState<string | null>(null);
  const [completedAnalysisInput, setCompletedAnalysisInput] = useState<CompletedAnalysisInput | null>(null);
  const [analysisRunSerial, setAnalysisRunSerial] = useState(0);
  const [clarificationSession, setClarificationSession] = useState<ClarificationSession | null>(null);
  const [clarificationFocusRequest, setClarificationFocusRequest] = useState<{ field: GateFieldKey; seq: number } | null>(null);
  const [workflowRunStatus, setWorkflowRunStatus] = useState<WorkflowRunStatus>('idle');
  const [workflowStages, setWorkflowStages] = useState<WorkflowStageItem[]>(() => initialWorkflowStages());
  const [workflowProviders, setWorkflowProviders] = useState<AnalyzeProviderEvent[]>([]);
  const [workflowCompatibilityFallback, setWorkflowCompatibilityFallback] = useState(false);
  const [workflowActivityLog, setWorkflowActivityLog] = useState<string[]>([]);
  const verdictRef = useRef<HTMLElement | null>(null);
  const lastAutoScrolledResultRef = useRef<string | null>(null);
  const handledAutoRunRef = useRef<string | null>(null);
  const analysisRunSerialRef = useRef(0);
  const activeRunIdRef = useRef<string | null>(null);
  const streamAbortRef = useRef<AbortController | null>(null);
  const workflowPanelRef = useRef<HTMLDivElement | null>(null);
  const workflowScrolledRef = useRef(false);

  const scrollToVerdictResult = useCallback((autoScrollKey: string) => {
    let attempts = 0;
    const attemptScroll = () => {
      const target = verdictRef.current ?? document.querySelector<HTMLElement>('[data-analyze-verdict="true"]');
      if (!target) {
        attempts += 1;
        if (attempts < 80) {
          window.setTimeout(attemptScroll, 100);
        }
        return;
      }
      if (lastAutoScrolledResultRef.current === autoScrollKey) return;
      lastAutoScrolledResultRef.current = autoScrollKey;
      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const behavior: ScrollBehavior = reduceMotion ? 'auto' : 'smooth';
      target.scrollIntoView({ behavior, block: 'start' });
      window.setTimeout(() => {
        const rect = target.getBoundingClientRect();
        if (rect.top > window.innerHeight * 0.45 || rect.top < 0) {
          const scrollMarginTop = Number.parseFloat(window.getComputedStyle(target).scrollMarginTop || '0') || 0;
          window.scrollTo({
            top: Math.max(0, rect.top + window.scrollY - scrollMarginTop),
            behavior,
          });
        }
        window.setTimeout(() => {
          const updatedRect = target.getBoundingClientRect();
          if (updatedRect.top > window.innerHeight * 0.45 || updatedRect.top < 0) {
            target.focus({ preventScroll: false });
            if (window.location.hash !== '#analyze-verdict') {
              window.location.hash = 'analyze-verdict';
            }
          }
        }, reduceMotion ? 0 : 280);
      }, reduceMotion ? 0 : 220);
    };
    window.setTimeout(attemptScroll, 50);
  }, []);

  useEffect(() => { setSource(getSource()); }, []);
  useEffect(() => { window.sessionStorage.setItem(ANALYZE_QUERY_KEY, query); }, [query]);

  useEffect(() => {
    if (workflowRunStatus === 'idle') {
      workflowScrolledRef.current = false;
      return;
    }
    if (!workflowScrolledRef.current && workflowPanelRef.current) {
      workflowScrolledRef.current = true;
      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      workflowPanelRef.current.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    }
  }, [workflowRunStatus]);
  const handleQueryChange = (value: string) => {
    setQuery(value);
    setError(null);
    setClarificationSession(null);
    setClarificationFocusRequest(null);
  };

  const appendAssumptionSnippet = (snippet: string) => {
    const normalizedSnippet = snippet.replace(/^.+：例如/, '').replace(/^.+：/, '').trim();
    const nextQuery = query.trim() ? `${query.trim()}，${normalizedSnippet}` : normalizedSnippet;
    setQuery(nextQuery);
    setError(null);
    setClarificationSession(null);
    setClarificationFocusRequest(null);
    window.sessionStorage.setItem(ANALYZE_QUERY_KEY, nextQuery);
  };

  const runAnalyze = useCallback(async (
    briefValue = query,
    requestedSource: AnalyzeSource = source,
    requestedProfile: AnalyzeProfile = profile,
  ) => {
    const normalizedQuery = briefValue.trim();
    if (!normalizedQuery) {
      setResult(null);
      setProtocol(null);
      setCompletedAnalysisInput(null);
      setError('请先输入产品、想法或目标市场。');
      return;
    }
    const nextProtocol = buildMarketMvpResearchProtocol(normalizedQuery);
    setProtocol(nextProtocol);
    setError(null);
    const previousController = streamAbortRef.current;
    activeRunIdRef.current = null;
    previousController?.abort();
    const nextAnalysisRunSerial = analysisRunSerialRef.current + 1;
    analysisRunSerialRef.current = nextAnalysisRunSerial;
    setAnalysisRunSerial(nextAnalysisRunSerial);
    lastAutoScrolledResultRef.current = null;
    if (window.location.hash === '#analyze-verdict') {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    }
    setSource(requestedSource);
    setClarificationSession(null);
    setClarificationFocusRequest(null);
    setResult(null);
    setSavedReportId(null);
    setCompletedAnalysisInput(null);
    setAnalyzing(true);
    setWorkflowRunStatus('preparing');
    setWorkflowCompatibilityFallback(false);
    setWorkflowStages(initialWorkflowStages());
    setWorkflowProviders([]);
    setWorkflowActivityLog([]);
    workflowScrolledRef.current = false;
    const requestRunId = `client-${Date.now()}-${nextAnalysisRunSerial}`;
    activeRunIdRef.current = requestRunId;
    const controller = new AbortController();
    streamAbortRef.current = controller;
    const updateStage = (stageKey: AnalyzeUiStageKey, nextStatus: AnalyzeStreamStatus, message: string, metrics?: Record<string, unknown>) => {
      if (activeRunIdRef.current !== requestRunId) return;
      setWorkflowStages((current) => current.map((stage) => {
        if (stage.key !== stageKey) return stage;
        const now = Date.now();
        return {
          ...stage,
          status: nextStatus,
          message: message || stage.message,
          metrics: metrics || stage.metrics,
          startedAt: stage.startedAt ?? now,
          endedAt: nextStatus === 'running' ? undefined : now,
        };
      }));
    };
    try {
      const response = await analyzeOpportunityStream(
        { query: normalizedQuery, source: requestedSource, profile: requestedProfile },
        {
          onProgress: (event: AnalyzeProgressEvent) => {
            if (activeRunIdRef.current !== requestRunId) return;
            setWorkflowRunStatus('streaming');
            if (event.message) {
              setWorkflowActivityLog((log) => [...log.slice(-14), event.message].filter(Boolean));
            }
            const mapped = STAGE_MAP[event.stage];
            if (!mapped) return;
            if (event.stage === 'explanation_generation' && event.status === 'running') {
              updateStage(mapped, 'running', event.message, event.metrics);
              return;
            }
            if (event.stage === 'explanation_generation' && event.status !== 'running') {
              const explanationStatus = String(event.metrics?.explanationStatus || '');
              const isPartial = ['timeout', 'error', 'malformed', 'rejected', 'not_configured'].includes(explanationStatus);
              updateStage(mapped, isPartial ? 'partial' : 'completed', isPartial ? '解释层已降级为确定性报告' : event.message, event.metrics);
              return;
            }
            updateStage(
              mapped,
              event.status === 'running' ? 'running' : event.status === 'partial' ? 'partial' : event.status === 'failed' ? 'failed' : 'completed',
              event.message,
              event.metrics,
            );
          },
          onProvider: (event: AnalyzeProviderEvent) => {
            if (activeRunIdRef.current !== requestRunId) return;
            setWorkflowProviders((current) => [...current, event]);
            const providerMsg = buildProviderActivityMessage(event);
            setWorkflowActivityLog((log) => [...log.slice(-14), providerMsg]);
            if (event.status === 'failed' || event.status === 'skipped') {
              updateStage('signal_collection', 'partial', '市场信号收集部分降级');
            } else {
              updateStage('signal_collection', 'running', '正在收集市场信号');
            }
          },
          onDone: () => {
            if (activeRunIdRef.current !== requestRunId) return;
            setWorkflowStages((current) => current.map((stage) => {
              if (stage.status === 'failed' || stage.status === 'partial' || stage.status === 'completed') return stage;
              if (stage.status === 'running') {
                return { ...stage, status: 'completed', endedAt: Date.now(), message: stage.message || '已完成' };
              }
              return stage;
            }));
            setWorkflowRunStatus((current) => (current === 'failed' || current === 'cancelled' ? current : 'completed'));
          },
          onError: (event) => {
            if (activeRunIdRef.current !== requestRunId) return;
            setWorkflowRunStatus('failed');
            const mapped = event.stage ? STAGE_MAP[String(event.stage)] : undefined;
            if (mapped) updateStage(mapped, 'failed', event.message);
          },
          onCompatibilityFallback: () => {
            if (activeRunIdRef.current !== requestRunId) return;
            setWorkflowCompatibilityFallback(true);
            setWorkflowRunStatus('compatibility_fallback');
            setWorkflowStages((current) => current.map((stage) => {
              if (stage.status === 'waiting' || stage.status === 'running') {
                return {
                  ...stage,
                  status: 'partial',
                  message: '兼容模式执行，无法提供完整实时阶段',
                  endedAt: Date.now(),
                };
              }
              return stage;
            }));
          },
        },
        controller.signal,
      );
      if (activeRunIdRef.current !== requestRunId) return;
      const normalizedResponse = normalizeViewResult(response);
      setSource(response.source);
      setResult(normalizedResponse);
      if (normalizedResponse) {
        setCompletedAnalysisInput({
          query: normalizedQuery,
          profile: {
            ...requestedProfile,
            assets: requestedProfile.assets ? [...requestedProfile.assets] : undefined,
            capabilities: requestedProfile.capabilities ? [...requestedProfile.capabilities] : undefined,
            avoidDirections: requestedProfile.avoidDirections ? [...requestedProfile.avoidDirections] : undefined,
          },
        });
        const resultKey = `${normalizedResponse.analysisId || 'analysis'}:${normalizedResponse.generatedAt || 'generated'}`;
        scrollToVerdictResult(`${nextAnalysisRunSerial}:${resultKey}`);
      }
    } catch (requestError) {
      if (activeRunIdRef.current !== requestRunId) return;
      if (controller.signal.aborted) {
        if (activeRunIdRef.current === requestRunId) setWorkflowRunStatus('cancelled');
        return;
      }
      console.warn('Analyze request failed', requestError);
      setProtocol(null);
      setError('分析服务未连接。请稍后重试，或切换样本模式查看验证结构。');
      setWorkflowRunStatus('failed');
    } finally {
      if (activeRunIdRef.current === requestRunId) {
        if (streamAbortRef.current === controller) streamAbortRef.current = null;
        activeRunIdRef.current = null;
        setAnalyzing(false);
      }
    }
  }, [profile, query, scrollToVerdictResult, source]);

  useEffect(() => {
    if (!autoRunKey || analyzing) return;
    if (handledAutoRunRef.current === autoRunKey) return;
    const autoRunOnceKey = `${AUTO_RUN_ONCE_PREFIX}:${autoRunKey}`;
    if (window.sessionStorage.getItem(autoRunOnceKey) === '1') return;

    const autoBrief = queryFromUrl.trim();
    if (!autoBrief) return;

    handledAutoRunRef.current = autoRunKey;
    window.sessionStorage.setItem(autoRunOnceKey, '1');
    const requestedSource = getSource();
    const seed: ClarificationParseSeed = {
      productType: productTypeFromUrl || undefined,
      targetMarket: targetMarketFromUrl || undefined,
    };
    const parsed = parseClarificationResult(autoBrief, seed);
    const nextGateConditions = toStructuredConditions(parsed.fields);
    const nextProfile = {
      ...profile,
      targetMarket: targetMarketFromUrl || profile.targetMarket,
    };
    const cleanedParams = new URLSearchParams(window.location.search);
    cleanedParams.delete('auto');
    const nextSearch = cleanedParams.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}`);

    setQuery(autoBrief);
    setProfile(nextProfile);
    setSource(requestedSource);
    setResult(null);
    setCompletedAnalysisInput(null);
    setSavedReportId(null);
    setError(null);
    setAnalyzing(false);
    window.sessionStorage.setItem(ANALYZE_QUERY_KEY, autoBrief);
    if (hasAllExplicit(parsed.fields)) {
      const mergedBrief = mergeStructuredBrief(autoBrief, nextGateConditions);
      setQuery(mergedBrief);
      window.sessionStorage.setItem(ANALYZE_QUERY_KEY, mergedBrief);
      void runAnalyze(mergedBrief, requestedSource, {
        ...nextProfile,
        targetMarket: nextGateConditions.targetMarket,
      });
      setClarificationSession(null);
      setClarificationFocusRequest(null);
    } else {
      setClarificationSession({
        sourceQuery: autoBrief,
        phase: parsed.questions.length > 0 ? 'questioning' : 'confirm',
        fields: parsed.fields,
        questions: parsed.questions,
        questionIndex: 0,
        answeredFields: initAnsweredFields(parsed.fields),
        answerModeByField: initAnswerModes(parsed.fields),
        customDraftByField: {},
        customErrorByField: {},
        customSavedByField: {},
      });
      setClarificationFocusRequest(null);
    }
  }, [analyzing, autoRunKey, profile, productTypeFromUrl, queryFromUrl, runAnalyze, targetMarketFromUrl]);

  useEffect(() => {
    setClarificationSession(null);
    setClarificationFocusRequest(null);
  }, [autoRunKey]);

  const resetAll = () => {
    const currentController = streamAbortRef.current;
    activeRunIdRef.current = null;
    currentController?.abort();
    streamAbortRef.current = null;
    setQuery('');
    setResult(null);
    setSavedReportId(null);
    setCompletedAnalysisInput(null);
    setError(null);
    setProtocol(null);
    setClarificationSession(null);
    setClarificationFocusRequest(null);
    setWorkflowRunStatus('idle');
    setWorkflowStages(initialWorkflowStages());
    setWorkflowProviders([]);
    setWorkflowCompatibilityFallback(false);
    setWorkflowActivityLog([]);
    workflowScrolledRef.current = false;
    lastAutoScrolledResultRef.current = null;
    window.sessionStorage.removeItem(ANALYZE_QUERY_KEY);
  };

  const viewResult = useMemo(() => normalizeViewResult(result), [result]);
  useEffect(() => () => {
    const controller = streamAbortRef.current;
    activeRunIdRef.current = null;
    controller?.abort();
    streamAbortRef.current = null;
  }, []);
  useEffect(() => {
    if (!viewResult || analyzing) return;
    const resultKey = `${viewResult.analysisId || 'analysis'}:${viewResult.generatedAt || 'generated'}`;
    scrollToVerdictResult(`${analysisRunSerial}:${resultKey}`);
  }, [analysisRunSerial, analyzing, scrollToVerdictResult, viewResult]);
  const backendJudgment = useMemo(() => getBackendJudgment(viewResult), [viewResult]);
  const displaySource = backendJudgment && (backendJudgment as { mode?: 'real' | 'mock' | 'fallback' }).mode
    ? (backendJudgment as { mode: 'real' | 'mock' | 'fallback' }).mode
    : source;
  const parsedBrief = useMemo(() => (query.trim() ? parseClarificationResult(query) : null), [query]);
  const activeBriefFields = clarificationSession?.fields ?? parsedBrief?.fields ?? null;
  const currentQuality = useMemo(() => ({
    score: activeBriefFields ? countExplicitFields(activeBriefFields) : 0,
  }), [activeBriefFields]);
  const assumptions = useMemo(
    () => mergeBackendAssumptions(extractAssumptions(query, profile), backendJudgment),
    [backendJudgment, profile, query],
  );
  const missingCritical = useMemo(
    () => assumptions.filter((item) => CRITICAL_ASSUMPTION_KEYS.includes(item.key) && item.status === 'missing'),
    [assumptions],
  );
  const hasBlockingError = Boolean(error && !viewResult);
  const radarSource = new URLSearchParams(window.location.search).has('source') ? source : 'real';

  const briefConditionStatus = useMemo(() => {
    if (!activeBriefFields) {
      return REQUIRED_GATE_FIELDS.map(({ key, label }) => ({ key, label, filled: false }));
    }
    return REQUIRED_GATE_FIELDS.map(({ key, label }) => ({
      key,
      label,
      filled: activeBriefFields[key].status === 'explicit',
    }));
  }, [activeBriefFields]);

  const clarificationProgress = useMemo<ClarificationDerivedProgress | null>(() => {
    if (!clarificationSession) return null;
    const explicitCount = countExplicitFields(clarificationSession.fields);
    const unresolvedCount = REQUIRED_GATE_FIELDS.length - explicitCount;
    const questionTotal = clarificationSession.questions.length;
    const answeredQuestionCount = clarificationSession.questions.filter((question) => clarificationSession.answeredFields[question.field]).length;
    const currentQuestionNumber = clarificationSession.phase === 'questioning'
      ? Math.min(questionTotal, clarificationSession.questionIndex + 1)
      : questionTotal > 0 ? questionTotal : 1;
    return {
      explicitCount,
      unresolvedCount,
      answeredQuestionCount,
      questionTotal,
      currentQuestionNumber,
      canStartAnalyze: hasAllExplicit(clarificationSession.fields),
    };
  }, [clarificationSession]);

  const focusFirstUnresolvedField = useCallback(() => {
    if (!clarificationSession) return;
    const unresolvedField = REQUIRED_GATE_FIELDS
      .map((item) => item.key)
      .find((field) => clarificationSession.fields[field].status !== 'explicit');
    if (!unresolvedField) return;
    setClarificationFocusRequest((prev) => ({
      field: unresolvedField,
      seq: (prev?.seq ?? 0) + 1,
    }));
  }, [clarificationSession]);

  const startClarification = useCallback((rawQuery: string, seed?: ClarificationParseSeed) => {
    const normalized = rawQuery.trim();
    if (!normalized) return;
    const parsed = parseClarificationResult(normalized, seed);
    const nextGateConditions = toStructuredConditions(parsed.fields);
    if (hasAllExplicit(parsed.fields)) {
      const mergedBrief = mergeStructuredBrief(normalized, nextGateConditions);
      const nextProfile = {
        ...profile,
        targetMarket: nextGateConditions.targetMarket || profile.targetMarket,
      };
      setClarificationSession(null);
      setClarificationFocusRequest(null);
      setQuery(mergedBrief);
      setProfile(nextProfile);
      window.sessionStorage.setItem(ANALYZE_QUERY_KEY, mergedBrief);
      void runAnalyze(mergedBrief, source, nextProfile);
      return;
    }
    setClarificationSession({
      sourceQuery: normalized,
      phase: parsed.questions.length > 0 ? 'questioning' : 'confirm',
      fields: parsed.fields,
      questions: parsed.questions,
      questionIndex: 0,
      answeredFields: initAnsweredFields(parsed.fields),
      answerModeByField: initAnswerModes(parsed.fields),
      customDraftByField: {},
      customErrorByField: {},
      customSavedByField: {},
    });
    setClarificationFocusRequest(null);
  }, [profile, runAnalyze, source]);

  const updateClarificationField = useCallback((field: ClarificationFieldKey, value: string) => {
    setClarificationSession((current) => {
      if (!current) return current;
      const normalized = value.trim();
      if (!normalized) return current;
      const nextMode: ClarificationAnswerMode = value === '暂未确定' ? 'undecided' : 'option';
      return {
        ...current,
        fields: applyFieldAnswer(current.fields, field, value),
        answeredFields: {
          ...current.answeredFields,
          [field]: true,
        },
        answerModeByField: {
          ...current.answerModeByField,
          [field]: nextMode,
        },
        customErrorByField: {
          ...current.customErrorByField,
          [field]: '',
        },
        customSavedByField: {
          ...current.customSavedByField,
          [field]: false,
        },
      };
    });
    setClarificationFocusRequest((current) => (current?.field === field ? null : current));
  }, []);

  const enterCustomMode = useCallback((field: ClarificationFieldKey) => {
    setClarificationSession((current) => {
      if (!current) return current;
      return {
        ...current,
        fields: {
          ...current.fields,
          [field]: {
            ...current.fields[field],
            value: '',
            status: 'missing',
            reason: '请确认自定义答案后继续。',
          },
        },
        answeredFields: {
          ...current.answeredFields,
          [field]: false,
        },
        answerModeByField: {
          ...current.answerModeByField,
          [field]: 'custom',
        },
        customErrorByField: {
          ...current.customErrorByField,
          [field]: '',
        },
        customSavedByField: {
          ...current.customSavedByField,
          [field]: false,
        },
      };
    });
  }, []);

  const updateCustomDraft = useCallback((field: ClarificationFieldKey, value: string) => {
    setClarificationSession((current) => {
      if (!current) return current;
      return {
        ...current,
        customDraftByField: {
          ...current.customDraftByField,
          [field]: value,
        },
        customErrorByField: {
          ...current.customErrorByField,
          [field]: '',
        },
      };
    });
  }, []);

  const confirmCustomAnswer = useCallback((field: ClarificationFieldKey) => {
    setClarificationSession((current) => {
      if (!current) return current;
      const draft = (current.customDraftByField[field] ?? '').trim();
      const validation = validateClarificationAnswer(field, draft);
      if (!validation.ok) {
        return {
          ...current,
          fields: {
            ...current.fields,
            [field]: {
              ...current.fields[field],
              status: 'missing',
            },
          },
          answeredFields: {
            ...current.answeredFields,
            [field]: false,
          },
          answerModeByField: {
            ...current.answerModeByField,
            [field]: 'custom',
          },
          customErrorByField: {
            ...current.customErrorByField,
            [field]: [validation.message, validation.hint].filter(Boolean).join(' '),
          },
          customSavedByField: {
            ...current.customSavedByField,
            [field]: false,
          },
        };
      }
      return {
        ...current,
        fields: applyFieldAnswer(current.fields, field, draft),
        answeredFields: {
          ...current.answeredFields,
          [field]: true,
        },
        answerModeByField: {
          ...current.answerModeByField,
          [field]: 'custom',
        },
        customErrorByField: {
          ...current.customErrorByField,
          [field]: '',
        },
        customSavedByField: {
          ...current.customSavedByField,
          [field]: true,
        },
      };
    });
  }, []);

  const handleConfirmBrief = useCallback(() => {
    if (analyzing || activeRunIdRef.current) return;
    if (!clarificationSession) return;
    if (!hasAllExplicit(clarificationSession.fields)) {
      focusFirstUnresolvedField();
      return;
    }
    const conditions = toStructuredConditions(clarificationSession.fields);
    const mergedBrief = mergeStructuredBrief(clarificationSession.sourceQuery, conditions);
    const nextProfile = {
      ...profile,
      targetMarket: conditions.targetMarket || profile.targetMarket,
    };
    setQuery(mergedBrief);
    setProfile(nextProfile);
    setClarificationSession(null);
    setClarificationFocusRequest(null);
    window.sessionStorage.setItem(ANALYZE_QUERY_KEY, mergedBrief);
    void runAnalyze(mergedBrief, source, nextProfile);
  }, [analyzing, clarificationSession, focusFirstUnresolvedField, profile, runAnalyze, source]);

  const handleClarificationNext = useCallback(() => {
    setClarificationSession((current) => {
      if (!current) return current;
      if (current.phase === 'confirm') return current;
      const currentQuestion = current.questions[current.questionIndex];
      if (currentQuestion && !current.answeredFields[currentQuestion.field]) {
        return current;
      }
      if (current.questionIndex + 1 >= current.questions.length) {
        return { ...current, phase: 'confirm' };
      }
      return { ...current, questionIndex: current.questionIndex + 1 };
    });
  }, []);

  const handleClarificationBack = useCallback(() => {
    setClarificationSession((current) => {
      if (!current) return current;
      if (current.phase === 'confirm') {
        if (current.questions.length === 0) return current;
        const unresolvedField = REQUIRED_GATE_FIELDS
          .map((item) => item.key)
          .find((field) => current.fields[field].status !== 'explicit');
        if (!unresolvedField) {
          return {
            ...current,
            phase: 'questioning',
            questionIndex: Math.max(0, current.questions.length - 1),
          };
        }
        const existingQuestionIndex = current.questions.findIndex((question) => question.field === unresolvedField);
        if (existingQuestionIndex >= 0) {
          return {
            ...current,
            phase: 'questioning',
            questionIndex: existingQuestionIndex,
          };
        }
        return current;
      }
      return { ...current, questionIndex: Math.max(0, current.questionIndex - 1) };
    });
    if (clarificationSession?.phase === 'confirm') {
      const unresolvedField = REQUIRED_GATE_FIELDS
        .map((item) => item.key)
        .find((field) => clarificationSession.fields[field].status !== 'explicit');
      if (unresolvedField) {
        const existingQuestionIndex = clarificationSession.questions.findIndex((question) => question.field === unresolvedField);
        if (existingQuestionIndex < 0) {
          focusFirstUnresolvedField();
        }
      }
    }
  }, [clarificationSession, focusFirstUnresolvedField]);

  const handleSubmit = () => {
    if (analyzing || activeRunIdRef.current) return;
    if (clarificationSession?.phase === 'confirm') {
      handleConfirmBrief();
      return;
    }
    startClarification(query);
  };
  const submitLabel = clarificationSession
    ? (hasAllExplicit(clarificationSession.fields) ? '确认并开始验证' : '定位待确认项')
    : '生成验证判断';
  const submitDisabled = false;
  const validationOsStatus = clarificationSession
    ? (hasAllExplicit(clarificationSession.fields) ? 'Brief 已确认' : '等待补问确认')
    : undefined;

  return (
    <AppShell>
      <div className={styles.page}>
        <TopNav />
        {/* 1. Hero — 总体状态摘要 */}
        <AnalyzeHero
          source={displaySource}
          qualityScore={currentQuality.score}
          analyzing={analyzing}
          hasResult={Boolean(viewResult)}
          hasError={hasBlockingError}
          statusOverride={validationOsStatus}
        />
        {/* 2. Brief 工作台 */}
        <AnalyzeWorkbench
          query={query}
          source={source}
          analyzing={analyzing}
          submitLabel={submitLabel}
          submitDisabled={submitDisabled}
          statusNote={clarificationSession ? '先完成补问确认，再发起验证请求。' : undefined}
          onQueryChange={handleQueryChange}
          onSubmit={handleSubmit}
          onReset={resetAll}
        />
        {/* 3. 验证条件 checklist */}
        <BriefConditionsChecklist conditionStatus={briefConditionStatus} />
        {/* 4. 智能补问与结构化确认 */}
        {clarificationSession ? (
          <ClarificationGuide
            session={clarificationSession}
            progress={clarificationProgress as ClarificationDerivedProgress}
            focusRequest={clarificationFocusRequest}
            onSelectOption={updateClarificationField}
            onEnterCustomMode={enterCustomMode}
            onCustomDraftChange={updateCustomDraft}
            onConfirmCustomAnswer={confirmCustomAnswer}
            onBackQuestion={handleClarificationBack}
            onNextQuestion={handleClarificationNext}
            onEditField={updateClarificationField}
            onFocusUnresolved={focusFirstUnresolvedField}
            onConfirm={handleConfirmBrief}
          />
        ) : null}
        {/* 5. 唯一真实验证执行工作台 */}
        <div ref={workflowPanelRef} style={{ scrollMarginTop: '72px' }}>
          <AnalyzeWorkflowPanel
            runStatus={workflowRunStatus}
            stages={workflowStages}
            providers={workflowProviders}
            compatibilityFallback={workflowCompatibilityFallback}
            activityLog={workflowActivityLog}
          />
        </div>
        {/* 6. 系统识别的判断要素 */}
        <AssumptionExtractor
          assumptions={assumptions}
          missingCritical={missingCritical}
          query={query}
          onPatch={appendAssumptionSnippet}
        />
        {!viewResult ? <AnalyzeAdvancedOptions profile={profile} onChange={setProfile} /> : null}
        {/* 7. Verdict 与完整报告 */}
        {protocol ? (
          <MarketMvpResearchProtocolPanel
            protocol={protocol}
            source={source}
            result={viewResult}
            missingCriticalCount={missingCritical.length}
            verdictRef={verdictRef}
            reportSaveSlot={
              viewResult ? (
                <SaveReportPanel
                  result={viewResult}
                  completedAnalysisInput={completedAnalysisInput}
                  savedReportId={savedReportId}
                  onSaved={setSavedReportId}
                />
              ) : null
            }
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
              <button type="button" className={styles.primaryButton} onClick={() => { void runAnalyze(); }}>重新分析</button>
              <a className={styles.ghostButton} href={`/opportunities?tab=signals&source=${radarSource}`}>查看市场信号榜</a>
            </div>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
