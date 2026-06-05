import type { AnalyzeResponse } from '../../types/analyze';
import styles from '../../pages/AnalyzePage/AnalyzePage.module.css';

interface Props {
  result: AnalyzeResponse;
  source: 'real' | 'mock' | 'fallback';
}

export function AnalyzeMatchedSignals({ result, source }: Props) {
  return (
    <section className={styles.matchedGrid}>
      <article className={styles.matchedCard}>
        <h2>匹配信号</h2>
        {result.matchedSignals.slice(0, 3).map((item) => (
          <div key={item.id} className={styles.compactItem}>
            <h3>{item.title}</h3>
            <p>{item.evidence?.[0]?.source ?? item.platformId} · 机会分 {item.valueScore}</p>
            <a href={`/report?id=${item.id}&source=${source}`}>查看报告</a>
          </div>
        ))}
      </article>
      <article className={styles.matchedCard}>
        <h2>匹配机会</h2>
        {result.matchedOpportunities.slice(0, 3).map((item) => (
          <div key={item.id} className={styles.compactItem}>
            <h3>{item.title}</h3>
            <p>匹配分 {item.fitScore} · {item.reason}</p>
            <a href={`/report?id=${item.sourceItemId}&source=${source}`}>查看报告</a>
          </div>
        ))}
      </article>
    </section>
  );
}
