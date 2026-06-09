import type { StandardRiskItem } from '../../viewModels';
import { RiskPill } from './RiskPill';
import styles from './RiskMatrix.module.css';

type Props = {
  risks: StandardRiskItem[];
};

export function RiskMatrix({ risks }: Props) {
  const high = risks.filter((risk) => risk.level === 'high');
  const medium = risks.filter((risk) => risk.level === 'medium');
  const low = risks.filter((risk) => risk.level === 'low');

  const cells = [
    { key: 'high', title: '高概率 / 高影响', items: high },
    { key: 'medium', title: '中间区域', items: medium },
    { key: 'low', title: '低概率 / 低影响', items: low },
    { key: 'buffer', title: '观察区', items: [] as StandardRiskItem[] },
  ] as const;

  return (
    <section className={styles.root} aria-label="风险矩阵">
      <div className={styles.header}>
        <h3 className={styles.title}>Risk Matrix</h3>
        <span className={styles.subtitle}>概率 × 影响</span>
      </div>

      <div className={styles.grid}>
        {cells.map((cell) => (
          <div key={cell.key} className={styles.cell}>
            <div className={styles.cellTitle}>{cell.title}</div>
            <div className={styles.items}>
              {cell.items.length > 0 ? cell.items.map((risk) => <RiskPill key={risk.id} risk={risk} />) : <span className={styles.empty}>暂无风险项</span>}
            </div>
          </div>
        ))}
      </div>

      <div className={styles.axis}>
        <span>低发生概率</span>
        <span>高发生概率</span>
      </div>
    </section>
  );
}
