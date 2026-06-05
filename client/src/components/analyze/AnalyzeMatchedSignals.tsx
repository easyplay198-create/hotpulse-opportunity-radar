import type { AnalyzeResponse } from '../../types/analyze';
import styles from '../../pages/AnalyzePage/AnalyzePage.module.css';

interface Props {
  result: AnalyzeResponse;
  source: 'real' | 'mock' | 'fallback';
}

function relevanceLabel(label?: string) {
  if (label === '强匹配') return '强匹配';
  if (label === '匹配') return '匹配';
  if (label === '弱相关参考') return '弱相关参考';
  return '';
}

export function AnalyzeMatchedSignals({ result, source }: Props) {
  const visibleSignals = result.matchedSignals.filter((item) => (item.relevanceScore ?? item.valueScore ?? 0) >= 45);
  const visibleOpportunities = result.matchedOpportunities;

  if (visibleSignals.length === 0 && visibleOpportunities.length === 0) {
    return (
      <section className={styles.matchedCard}>
        <h2>相关信号</h2>
        <p>当前没有足够相关信号。</p>
      </section>
    );
  }

  return (
    <section className={styles.matchedGrid}>
      <article className={styles.matchedCard}>
        <h2>匹配信号</h2>
        {visibleSignals.length > 0 ? visibleSignals.slice(0, 3).map((item) => {
          const score = item.relevanceScore ?? item.valueScore ?? 0;
          const label = relevanceLabel(item.relevanceLabel);
          return (
            <div key={item.id} className={styles.compactItem}>
              <h3>{item.title}</h3>
              <p>{item.evidence?.[0]?.source ?? item.platformId} · 相关性 {score}{label ? ` · ${label}` : ''}</p>
              <a href={`/report?id=${item.id}&source=${source}`}>查看报告</a>
            </div>
          );
        }) : <p>当前没有足够相关信号。</p>}
      </article>
      <article className={styles.matchedCard}>
        <h2>匹配机会</h2>
        {visibleOpportunities.length > 0 ? visibleOpportunities.slice(0, 3).map((item) => (
          <div key={item.id} className={styles.compactItem}>
            <h3>{item.title}</h3>
            <p>匹配分 {item.fitScore} · {item.reason}</p>
            <a href={`/report?id=${item.sourceItemId}&source=${source}`}>查看报告</a>
          </div>
        )) : <p>当前没有足够相关的可追溯机会。</p>}
      </article>
    </section>
  );
}
