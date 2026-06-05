import type { AnalyzeResponse } from '../../types/analyze';
import { EvidenceMeter } from '../visual/EvidenceMeter';
import { MetricPill } from '../visual/MetricPill';
import { RiskMiniBars } from '../visual/RiskMiniBars';
import { SourceStack } from '../visual/SourceStack';
import { ValidationTimelineMini } from '../visual/ValidationTimelineMini';
import styles from '../../pages/AnalyzePage/AnalyzePage.module.css';

interface Props {
  result: AnalyzeResponse;
  source: 'real' | 'mock' | 'fallback';
  onReset: () => void;
  onRetry: () => void;
}

export function AnalyzeResultSummary({ result, source, onReset, onRetry }: Props) {
  const reportHref = result.recommendation.reportItemId ? `/report?id=${result.recommendation.reportItemId}&source=${source}` : `/report?source=${source}`;
  return (
    <section className={styles.resultGrid}>
      <article className={styles.resultMainCard}>
        <span className={styles.verdictBadge}>{result.recommendation.verdict}</span>
        <h2>{result.recommendation.title}</h2>
        <div className={styles.resultMetrics}>
          <MetricPill label="匹配分" value={result.recommendation.matchScore} tone="blue" />
          <MetricPill label="目标市场" value={result.recommendation.targetMarket} tone="gray" />
          <MetricPill label="数据源" value={result.source} tone={result.source === 'real' ? 'green' : 'amber'} />
        </div>
        <p>{result.recommendation.summary}</p>
        <p><strong>下一步：</strong>{result.recommendation.nextStep}</p>
        <div className={styles.actionsRow}>
          <a className={styles.primaryButton} href={reportHref}>生成完整报告</a>
          <a className={styles.ghostButton} href={`/opportunities?source=${source}`}>查看匹配机会</a>
          <button type="button" className={styles.ghostButton} onClick={onRetry}>重新验证</button>
          <button type="button" className={styles.textButton} onClick={onReset}>重新输入</button>
        </div>
      </article>
      <aside className={styles.resultSideCard}>
        <EvidenceMeter strength={result.recommendation.evidenceStrength} />
        <RiskMiniBars risks={result.riskMatrix.map((risk) => ({ label: risk.label.replace('风险', ''), value: risk.value }))} />
        <SourceStack evidence={result.matchedSignals.flatMap((item) => item.evidence ?? [])} />
        <ValidationTimelineMini />
      </aside>
    </section>
  );
}
