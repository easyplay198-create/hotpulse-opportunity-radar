import styles from '../OpportunitiesPage.module.css';

export function DecisionBoundaryPanel({
  confirmText,
  cannotConfirmText,
}: {
  confirmText: string;
  cannotConfirmText: string;
}) {
  return (
    <div className={styles.boundaryPanel} aria-label="判断边界">
      <div className={styles.boundaryCol} data-boundary="confirm">
        <span className={styles.boundaryLabel}>能确认</span>
        <p className={styles.boundaryText}>{confirmText}</p>
      </div>
      <div className={styles.boundaryDivider} aria-hidden="true" />
      <div className={styles.boundaryCol} data-boundary="cannot">
        <span className={styles.boundaryLabel}>关键未知</span>
        <p className={styles.boundaryText}>{cannotConfirmText}</p>
      </div>
    </div>
  );
}
