import type { StandardActionItem } from '../../viewModels';
import styles from './ActionPlaybook.module.css';

type Props = {
  actions: StandardActionItem[];
  maxItems?: number;
};

export function ActionPlaybook({ actions, maxItems = 5 }: Props) {
  const visibleActions = actions.slice(0, maxItems);

  return (
    <section className={styles.root} aria-label="行动清单">
      <div className={styles.header}>
        <h3 className={styles.title}>Action Playbook</h3>
        <span className={styles.subtitle}>{visibleActions.length} 项动作</span>
      </div>

      {visibleActions.length > 0 ? (
        <div className={styles.list}>
          {visibleActions.map((action) => (
            <article key={action.id} className={styles.item}>
              <div className={styles.check} aria-hidden="true" />
              <div className={styles.body}>
                <div className={styles.rowTop}>
                  <span className={styles.label}>{action.title}</span>
                  <span className={styles.meta}>{action.timeBox}</span>
                  {action.relatedRisk ? <span className={styles.meta}>{action.relatedRisk}</span> : null}
                </div>
                <div className={styles.line}>{action.successMetric}</div>
                <div className={styles.line}>{action.stopCondition}</div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className={styles.empty}>暂无行动项。</div>
      )}
    </section>
  );
}
