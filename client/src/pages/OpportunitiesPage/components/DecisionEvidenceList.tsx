import type { DecisionObservation } from '../../../types/opportunityDecision';
import { formatDecisionTime, isWeakObservation, mapDecisionProvenanceLabel, splitObservationMetrics } from '../decisionPresentation';
import styles from '../OpportunitiesPage.module.css';

function safeExternalUrl(value?: string | null) {
  const raw = value?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (url.hostname === 'example.com' || url.hostname.endsWith('.example.com')) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function DecisionEvidenceList({
  observations,
  variant = 'brief',
}: {
  observations: DecisionObservation[];
  variant?: 'brief' | 'compact';
}) {
  if (observations.length === 0) {
    return <p className={styles.briefEmpty}>当前没有可展示的外部观测记录。</p>;
  }

  return (
    <div className={styles.evidenceTrack} data-variant={variant}>
      {observations.map((observation) => {
        const metrics = splitObservationMetrics(observation);
        const weak = isWeakObservation(observation);
        const safeUrl = safeExternalUrl(observation.sourceUrl);
        return (
          <article key={observation.id} className={styles.evidenceRow} data-provenance={observation.provenance}>
            <div className={styles.evidenceRail} aria-hidden="true" />
            <div className={styles.evidenceBody}>
              <div className={styles.evidenceRowHeader}>
                <span className={styles.evidenceSource}>{observation.sourceName}</span>
                <span className={styles.evidenceProvenanceTag}>{mapDecisionProvenanceLabel(observation.provenance)}</span>
                {weak ? <span className={styles.weakIndicator}>弱互动信号</span> : null}
                {!observation.sourceUrl ? <span className={styles.weakIndicator}>不可直接追溯</span> : null}
              </div>
              <div className={`${styles.evidenceMetric}${weak ? ` ${styles.evidenceMetricWeak}` : ''}`}>
                <strong>{metrics.primary}</strong>
                {metrics.secondary ? <span>{metrics.secondary}</span> : null}
              </div>
              <div className={styles.evidenceMeta}>
                <span>{formatDecisionTime(observation.retrievedAt)}</span>
                {safeUrl ? (
                  <a href={safeUrl} target="_blank" rel="noreferrer" className={styles.evidenceLink}>
                    打开原始来源 ↗
                  </a>
                ) : null}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
