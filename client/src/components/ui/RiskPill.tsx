import type { StandardRiskItem } from '../../viewModels';
import styles from './RiskPill.module.css';

type Props = {
  risk: StandardRiskItem;
};

export function RiskPill({ risk }: Props) {
  return (
    <span className={`${styles.root} ${styles[risk.level]}`} aria-label={`${risk.label} ${risk.level}`}>
      <span className={styles.bar} aria-hidden="true" />
      <span className={styles.label}>{risk.label}</span>
      <span className={styles.level}>{risk.level}</span>
    </span>
  );
}
