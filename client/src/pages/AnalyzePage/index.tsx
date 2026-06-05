import { useEffect, useState } from 'react';
import { analyzeOpportunity } from '../../api/analyzeOpportunity';
import { AppShell } from '../../components/layout/AppShell';
import { TopNav } from '../../components/layout/TopNav';
import { AnalyzeAdvancedOptions } from '../../components/analyze/AnalyzeAdvancedOptions';
import { AnalyzeMatchedSignals } from '../../components/analyze/AnalyzeMatchedSignals';
import { AnalyzeProgressPanel } from '../../components/analyze/AnalyzeProgressPanel';
import { AnalyzeResultSummary } from '../../components/analyze/AnalyzeResultSummary';
import { AnalyzeWorkbench } from '../../components/analyze/AnalyzeWorkbench';
import { AnalysisTracePanel } from '../../components/analyze/AnalysisTracePanel';
import { EvidenceBoard } from '../../components/analyze/EvidenceBoard';
import { ProjectEvaluationPanel } from '../../components/analyze/ProjectEvaluationPanel';
import { ProjectUnderstandingPanel } from '../../components/analyze/ProjectUnderstandingPanel';
import { RiskBottleneckPanel } from '../../components/analyze/RiskBottleneckPanel';
import { MvpValidationPlanPanel } from '../../components/analyze/MvpValidationPlanPanel';
import type { AnalyzeProfile, AnalyzeResponse } from '../../types/analyze';
import styles from './AnalyzePage.module.css';

const ANALYZE_QUERY_KEY = 'hotpulse_analyze_query';
const DEFAULT_PROFILE: AnalyzeProfile = { productStage: '想法阶段', targetMarket: 'Global', budgetRange: '$0-$50', validationGoal: '需求是否存在' };

function getSource(): 'real' | 'mock' | 'fallback' {
  const source = new URLSearchParams(window.location.search).get('source');
  if (source === 'real' || source === 'fallback') return source;
  return 'mock';
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
      setResult(response);
      setActiveStep(5);
    } catch (apiError) {
      setError(apiError instanceof Error ? apiError.message : '分析服务暂时不可用');
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

  return (
    <AppShell>
      <div className={styles.page}>
        <TopNav />
        <AnalyzeWorkbench query={query} source={source} analyzing={analyzing} onQueryChange={setQuery} onSubmit={runAnalyze} onReset={resetAll} />
        <AnalyzeAdvancedOptions profile={profile} onChange={setProfile} />

        {(analyzing || result) ? <AnalyzeProgressPanel activeIndex={activeStep} done={Boolean(result)} steps={result?.steps} /> : null}

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

        {result ? (
          <div className={styles.validationGrid}>
            <div className={styles.validationMainCol}>
              <ProjectUnderstandingPanel understanding={result.projectUnderstanding} />
              <ProjectEvaluationPanel items={result.projectEvaluation} />
              <RiskBottleneckPanel items={result.riskBottlenecks} />
              <MvpValidationPlanPanel steps={result.mvpValidationPlan} fallback={result.sevenDayPlan} />
            </div>
            <div className={styles.validationSideCol}>
              <AnalysisTracePanel analysisTrace={result.analysisTrace} rejectedCount={result.relevanceScores?.rejectedSignals?.length ?? 0} />
              <EvidenceBoard items={result.evidenceBoard} source={source} />
            </div>
          </div>
        ) : null}

        {result ? <AnalyzeResultSummary result={result} source={source} onReset={resetAll} onRetry={runAnalyze} /> : null}
        {result ? <AnalyzeMatchedSignals result={result} source={source} /> : null}
      </div>
    </AppShell>
  );
}
