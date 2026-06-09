import type { ProviderStatusVM } from '../../viewModels';
import styles from './SourceHealthStrip.module.css';

type Props = {
  providers: ProviderStatusVM[];
};

export function SourceHealthStrip({ providers }: Props) {
  return (
    <section className={styles.root} aria-label="数据源状态">
      <div className={styles.header}>
        <h3 className={styles.title}>Source Health</h3>
        <span className={styles.subtitle}>{providers.length} 个数据源</span>
      </div>

      {providers.length > 0 ? (
        <div className={styles.list}>
          {providers.map((provider) => (
            <article key={provider.id} className={styles.item}>
              <div className={styles.top}>
                <span className={styles.label}>{provider.label}</span>
                {provider.count !== undefined ? <span className={styles.count}>{provider.count}</span> : null}
              </div>
              <div className={styles.status}>{provider.statusLabel}</div>
              <div className={styles.note}>{provider.note}</div>
            </article>
          ))}
        </div>
      ) : (
        <div className={styles.empty}>暂无数据源状态。</div>
      )}
    </section>
  );
}
