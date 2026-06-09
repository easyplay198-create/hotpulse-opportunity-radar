import type { OpportunityDecisionVM } from '../../viewModels';
import { ScoreBadge } from './ScoreBadge';
import { VerdictPill } from './VerdictPill';
import { RiskPill } from './RiskPill';
import styles from './OpportunityTable.module.css';

type Props = {
  opportunities: OpportunityDecisionVM[];
  maxRows?: number;
};

function evidenceText(opportunity: OpportunityDecisionVM) {
  const sources = opportunity.sources.slice(0, 2).join(' / ');
  return `${opportunity.evidenceCount} 条 · ${sources || '来源待补充'}`;
}

export function OpportunityTable({ opportunities, maxRows = 10 }: Props) {
  const rows = opportunities.slice(0, maxRows);

  return (
    <section className={styles.root} aria-label="机会表格">
      <div className={styles.header}>
        <h3 className={styles.title}>Opportunity Table</h3>
        <span className={styles.subtitle}>{rows.length} 条机会</span>
      </div>

      {rows.length > 0 ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Opportunity</th>
                <th>Market</th>
                <th>Score</th>
                <th>Verdict</th>
                <th>Confidence</th>
                <th>Risk</th>
                <th>Evidence</th>
                <th>Updated</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((opportunity) => (
                <tr key={opportunity.id} className={styles.row}>
                  <td>
                    <div className={styles.opportunity}>
                      <span className={styles.name}>{opportunity.title}</span>
                      <span className={styles.category}>{opportunity.category}</span>
                    </div>
                  </td>
                  <td>{opportunity.targetMarket}</td>
                  <td><ScoreBadge score={opportunity.score} band={opportunity.scoreBand} size="sm" /></td>
                  <td><VerdictPill verdict={opportunity.verdict} label={opportunity.verdictLabel} /></td>
                  <td>{opportunity.confidence}</td>
                  <td>{opportunity.topRisks[0] ? <RiskPill risk={opportunity.topRisks[0]} /> : <span className={styles.smallNote}>待确认</span>}</td>
                  <td><span className={styles.evidence}>{evidenceText(opportunity)}</span></td>
                  <td>{opportunity.updatedAt || <span className={styles.smallNote}>-</span>}</td>
                  <td><button type="button" className={styles.actionButton}>{opportunity.verdict === 'validate_now' ? '验证' : '查看'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={styles.empty}>暂无机会。</div>
      )}
    </section>
  );
}
