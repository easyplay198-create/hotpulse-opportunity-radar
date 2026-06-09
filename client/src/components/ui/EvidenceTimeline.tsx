import type { StandardEvidenceItem } from '../../viewModels';
import styles from './EvidenceTimeline.module.css';

type Props = {
  items: StandardEvidenceItem[];
  maxItems?: number;
};

function clampFact(text: string) {
  if (text.length <= 110) return text;
  return `${text.slice(0, 107)}...`;
}

export function EvidenceTimeline({ items, maxItems = 5 }: Props) {
  const visibleItems = items.slice(0, maxItems);

  return (
    <section className={styles.root} aria-label="证据时间线">
      <div className={styles.header}>
        <h3 className={styles.title}>Evidence Timeline</h3>
        <span className={styles.subtitle}>{visibleItems.length} 条证据</span>
      </div>

      {visibleItems.length > 0 ? (
        <div className={styles.list}>
          {visibleItems.map((item) => (
            <div key={item.id} className={styles.item}>
              <div className={styles.dot} aria-hidden="true" />
              <article className={styles.card}>
                <div className={styles.meta}>
                  <span>{item.source}</span>
                  <span>{item.strength}</span>
                  {item.time ? <span>{item.time}</span> : null}
                </div>
                <p className={styles.fact} title={item.fact}>{clampFact(item.fact)}</p>
                <div className={styles.meta}>
                  <span>{item.title}</span>
                  {item.url ? (
                    <a className={styles.link} href={item.url} target="_blank" rel="noreferrer">查看来源</a>
                  ) : null}
                </div>
              </article>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.empty}>暂无证据项。</div>
      )}
    </section>
  );
}
