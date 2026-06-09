import { useEffect, useMemo, useState } from 'react';
import { analyzeOpportunity } from '../../api/analyzeOpportunity';
import { AppShell } from '../../components/layout/AppShell';
import { TopNav } from '../../components/layout/TopNav';
import { AnalyzeAdvancedOptions } from '../../components/analyze/AnalyzeAdvancedOptions';
import { AnalyzeProgressPanel } from '../../components/analyze/AnalyzeProgressPanel';
import { AnalyzeWorkbench } from '../../components/analyze/AnalyzeWorkbench';
import { AnalyzeActionReport } from '../../components/analyze/AnalyzeActionReport';
import type { AnalyzeProfile, AnalyzeResponse } from '../../types/analyze';
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

  useEffect(() => {
    setSource(getSource());
  }, []);

  useEffect(() => {
    window.sessionStorage.setItem(ANALYZE_QUERY_KEY, query);
  }, [query]);

  useEffect(() => {
    if (!analyzing) return;
    setActiveStep(0);
    const timer = window.setInterval(() => setActiveStep((current) => Math.min(current + 1, 4)), 650);
    return () => window.clearInterval(timer);
  }, [analyzing]);

  const runAnalyze = async () => {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      setError('请先输入产品、想法或目标市场。');
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
    setQuery('');
    setResult(null);
    setError(null);
    setActiveStep(0);
    window.sessionStorage.removeItem(ANALYZE_QUERY_KEY);
  };

  const viewResult = useMemo(() => normalizeViewResult(result), [result]);

  return (
    <AppShell>
      <div className={styles.page}>
        <TopNav />
        <AnalyzeWorkbench query={query} source={source} analyzing={analyzing} onQueryChange={setQuery} onSubmit={runAnalyze} onReset={resetAll} />
        {!viewResult ? <AnalyzeAdvancedOptions profile={profile} onChange={setProfile} /> : null}

        {analyzing ? <AnalyzeProgressPanel activeIndex={activeStep} done={false} steps={viewResult?.steps} /> : null}

        {error ? (
          <section className={styles.errorCard}>
            <h2>分析服务暂时不可用</h2>
            <p>请稍后重试或查看当前市场信号。</p>
            <div className={styles.actionsRow}>
              <button type="button" className={styles.primaryButton} onClick={runAnalyze}>重新分析</button>
              <a className={styles.ghostButton} href={`/signals?source=${source}`}>查看市场信号</a>
            </div>
          </section>
        ) : null}

        {viewResult ? <AnalyzeActionReport result={viewResult} source={source} /> : null}
      </div>
    </AppShell>
  );
}
