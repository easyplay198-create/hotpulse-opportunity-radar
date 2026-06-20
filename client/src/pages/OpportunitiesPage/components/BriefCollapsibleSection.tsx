import type { ReactNode } from 'react';
import styles from '../OpportunitiesPage.module.css';

export function BriefCollapsibleSection({
  summary,
  expanded,
  onToggle,
  contentId,
  expandLabel = '展开',
  collapseLabel = '收起',
  children,
}: {
  summary: string;
  expanded: boolean;
  onToggle: () => void;
  contentId: string;
  expandLabel?: string;
  collapseLabel?: string;
  children: ReactNode;
}) {
  return (
    <section className={styles.collapsibleSection}>
      <div className={styles.collapsibleHeader}>
        <span className={styles.collapsibleSummary}>{summary}</span>
        <button
          type="button"
          className={styles.collapsibleToggle}
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={(event) => {
            event.stopPropagation();
            onToggle();
          }}
        >
          {expanded ? collapseLabel : expandLabel}
        </button>
      </div>
      {expanded ? (
        <div id={contentId} className={styles.collapsibleContent}>
          {children}
        </div>
      ) : null}
    </section>
  );
}
