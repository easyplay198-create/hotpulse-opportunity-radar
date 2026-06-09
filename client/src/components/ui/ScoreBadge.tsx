import { toScoreBand, type ScoreBand } from '../../viewModels';
import styles from './ScoreBadge.module.css';

type Props = {
  score: number;
  band?: ScoreBand;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
};

function bandLabel(band: ScoreBand) {
  if (band === 'strong') return 'Strong';
  if (band === 'testing') return 'Worth testing';
  if (band === 'watch') return 'Watch';
  return 'No-go';
}

export function ScoreBadge({ score, band, label, size = 'md' }: Props) {
  const resolvedBand = band ?? toScoreBand(score);
  return (
    <span className={`${styles.root} ${styles[size]}`} aria-label={label ?? `Score ${score}`}>
      <span className={styles.track} aria-hidden="true">
        <span className={styles.fill} style={{ transform: `scale(${Math.max(0.35, Math.min(1, score / 100))})` }} />
      </span>
      <span className={styles.body}>
        <span className={styles.score}>{score}</span>
        <span className={styles.label}>{label ?? bandLabel(resolvedBand)}</span>
      </span>
    </span>
  );
}
