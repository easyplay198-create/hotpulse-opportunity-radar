import type { DecisionSummaryVM, StandardRiskItem } from '../../viewModels';
import { ScoreBadge } from './ScoreBadge';
import { VerdictPill } from './VerdictPill';
import { RiskPill } from './RiskPill';
import styles from './DecisionBar.module.css';

type Props = {
  decision: DecisionSummaryVM;
  risks?: StandardRiskItem[];
  onExport?: () => void;
  onRerun?: () => void;
};

export function DecisionBar({ decision, risks = [], onExport, onRerun }: Props) {
  const topRisk = risks[0]?.label ?? decision.topRisk ?? '风险待确认';

  return (
    <section className={styles.root} aria-label="决策摘要">
      <ScoreBadge score={decision.score} band={decision.scoreBand} size="lg" />

      <div className={styles.main}>
        <div className={styles.summaryRow}>
          <VerdictPill verdict={decision.verdict} label={decision.verdictLabel} />
          <span className={styles.confidence}>Confidence · {decision.confidenceLabel}</span>
        </div>
        <p className={styles.summary}>{decision.summary}</p>
      </div>

      <div className={styles.right}>
        <div className={styles.meta}>
          <span className={styles.metaLabel}>Top Risk</span>
          <span className={styles.metaValue}>{topRisk}</span>
        </div>
        <div className={styles.meta}>
          <span className={styles.metaLabel}>Next Action</span>
          <span className={styles.metaValue}>{decision.nextAction}</span>
        </div>
        {risks.length > 0 ? <RiskPill risk={risks[0]} /> : null}
        <div className={styles.actions}>
          {onExport ? <button type="button" className={styles.buttonSecondary} onClick={onExport}>导出</button> : null}
          {onRerun ? <button type="button" className={styles.button} onClick={onRerun}>重新分析</button> : null}
        </div>
      </div>
    </section>
  );
}
