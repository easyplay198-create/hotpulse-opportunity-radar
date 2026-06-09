import { getVerdictLabel, type StandardVerdict } from '../../viewModels';
import styles from './VerdictPill.module.css';

type Props = {
  verdict: StandardVerdict;
  label?: string;
};

export function VerdictPill({ verdict, label }: Props) {
  return (
    <span className={`${styles.root} ${styles[verdict]}`} aria-label={label ?? getVerdictLabel(verdict)}>
      <span className={styles.dot} aria-hidden="true" />
      {label ?? getVerdictLabel(verdict)}
    </span>
  );
}
