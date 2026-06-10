import { useEffect, useMemo, useState } from 'react';
import { analyzeOpportunity } from '../../api/analyzeOpportunity';
import { AppShell } from '../../components/layout/AppShell';
import { TopNav } from '../../components/layout/TopNav';
import { AnalyzeAdvancedOptions } from '../../components/analyze/AnalyzeAdvancedOptions';
import { AnalyzeProgressPanel } from '../../components/analyze/AnalyzeProgressPanel';
import { AnalyzeWorkbench } from '../../components/analyze/AnalyzeWorkbench';
import { AnalyzeActionReport } from '../../components/analyze/AnalyzeActionReport';
import { AnalyzeInputQualityGate } from '../../components/analyze/AnalyzeInputQualityGate';
import { MarketMvpResearchProtocolPanel } from '../../components/analyze/MarketMvpResearchProtocolPanel';
import type { AnalyzeProfile, AnalyzeResponse } from '../../types/analyze';
import { buildMarketMvpResearchProtocol, type MarketMvpResearchProtocol } from '../../lib/marketMvpResearchProtocol';
import styles from './AnalyzePage.module.css';

const ANALYZE_QUERY_KEY = 'hotpulse_analyze_query';
const DEFAULT_PROFILE: AnalyzeProfile = { productStage: '想法阶段', targetMarket: 'Global', budgetRange: '$0-$50', validationGoal: '需求是否存在' };

function getSource(): 'real' | 'mock' | 'fallback' {
  const source = new URLSearchParams(window.location.search).get('source');
  if (source === 'real' || source === 'fallback') return source;
  return 'mock';
}

function normalizeViewResult(result: AnalyzeResponse | null): AnalyzeResponse | null {
  if (!result) return null;
  return { ...result, matchedSignals: Array.isArray(result.matchedSignals) ? result.matchedSignals : [], matchedOpportunities: Array.isArray(result.matchedOpportunities) ? result.matchedOpportunities : [], clarifyingQuestions: Array.isArray(result.clarifyingQuestions) ? result.clarifyingQuestions : [], evidenceGaps: Array.isArray(result.evidenceGaps) ? result.evidenceGaps : [], warnings: Array.isArray(result.warnings) ? result.warnings : [], projectEvaluation: Array.isArray(result.projectEvaluation) ? result.projectEvaluation : [], riskBottlenecks: Array.isArray(result.riskBottlenecks) ? result.riskBottlenecks : [], mvpValidationPlan: Array.isArray(result.mvpValidationPlan) ? result.mvpValidationPlan : [], analysisTrace: Array.isArray(result.analysisTrace) ? result.analysisTrace : [], evidenceBoard: Array.isArray(result.evidenceBoard) ? result.evidenceBoard : [], relevanceScores: result.relevanceScores || { topSignalScores: [], rejectedSignals: [] }, riskMatrix: Array.isArray(result.riskMatrix) ? result.riskMatrix : [], sevenDayPlan: Array.isArray(result.sevenDayPlan) ? result.sevenDayPlan : [], recommendation: result.recommendation || { title: '当前缺少足够相关信号，建议先做小样本验证', verdict: '持续观察', matchScore: 0, targetMarket: '未明确', evidenceStrength: 'low', summary: '当前结果缺少足够信息。', nextStep: '请继续补充输入后重试.' } };
}

function inspectInputQuality(query: string) {
  const text = query.trim();
  const hasTargetMarket = /日本|韩国|台湾|东南亚|美国|欧美|巴西|中东|土耳其|印度|印尼|泰国|越南|Global|Japan|US|SEA|Europe/i.test(text);
  const hasUser = /用户|开发者|学生|老师|团队|企业|卖家|创作者|运营|设计师|家长|老人|儿童|独居|B端|C端/i.test(text);
  const hasProduct = /AI|SaaS|工具|App|订阅|游戏|短剧|支付|机器人|机器狗|硬件|插件|平台|软件/i.test(text);
  const hasBusiness = /订阅|付费|广告|佣金|一次性|会员|充值|收款|支付|价格|客单价|售价|月费/i.test(text);
  const hasScenario = /用于|帮助|解决|提高|降低|自动|生成|管理|陪伴|学习|办公|营销|获客|养老|设计|素材|效率/i.test(text);
  const missing: string[] = [];
  if (!hasTargetMarket) missing.push('目标市场');
  if (!hasUser) missing.push('目标用户');
  if (!hasProduct) missing.push('产品类型');
  if (!hasScenario) missing.push('使用场景 / 核心痛点');
  if (!hasBusiness) missing.push('商业模式 / 付费方式');
  return { score: 5 - missing.length, isEnough: missing.length <= 2, missing };
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
  };

  const applyQualityExample = (value: string) => {
    setQuery(value);
    setInputQuality(null);
    window.sessionStorage.setItem(ANALYZE_QUERY_KEY, value);
  };

  const runAnalyze = async () => {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
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
    setAnalyzing(true);
    try {
      const response = await analyzeOpportunity({ query: normalizedQuery, source, profile });
      setSource(response.source);
      setResult(normalizeViewResult(response));
      setActiveStep(5);
    } catch {
      setError('分析服务暂时不可用，请稍后重试或查看当前市场信号。');
    } finally {
      setAnalyzing(false);
    }
  };

  const resetAll = () => {
    setQuery(''); setResult(null); setError(null); setInputQuality(null); setProtocol(null); setActiveStep(0); window.sessionStorage.removeItem(ANALYZE_QUERY_KEY);
  };

  const viewResult = useMemo(() => normalizeViewResult(result), [result]);

  return (
    <AppShell>
      <div className={styles.page}>
        <TopNav />
        <AnalyzeWorkbench query={query} source={source} analyzing={analyzing} onQueryChange={handleQueryChange} onSubmit={runAnalyze} onReset={resetAll} />
        {inputQuality ? (
          <AnalyzeInputQualityGate missing={inputQuality.missing} query={inputQuality.query} onExampleApply={applyQualityExample} />
        ) : (
          <>
            {!viewResult ? <AnalyzeAdvancedOptions profile={profile} onChange={setProfile} /> : null}
            {analyzing ? <AnalyzeProgressPanel activeIndex={activeStep} done={false} steps={viewResult?.steps} /> : null}
            {protocol ? <MarketMvpResearchProtocolPanel protocol={protocol} /> : null}
          </>
        )}
        {error ? <section className={styles.errorCard}><h2>分析服务暂时不可用</h2><p>请稍后重试或查看当前市场信号。</p><div className={styles.actionsRow}><button type="button" className={styles.primaryButton} onClick={runAnalyze}>重新分析</button><a className={styles.ghostButton} href={`/signals?source=${source}`}>查看市场信号</a></div></section> : null}
        {viewResult && protocol?.canJudge ? <details className={styles.legacyDecisionDetails}><summary className={styles.legacyDecisionSummary}>查看补充决策画布</summary><div className={styles.legacyDecisionBody}><p className={styles.legacyDecisionSummaryText}>以下为旧版评分视图，仅作为补充参考，最终判断以 Market MVP Protocol 为主。</p><AnalyzeActionReport result={viewResult} source={source} /></div></details> : null}
      </div>
    </AppShell>
  );
}
