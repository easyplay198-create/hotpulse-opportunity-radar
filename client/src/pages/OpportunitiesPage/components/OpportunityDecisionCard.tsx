import type { HotItem } from '../../../types/hot';
import { mapDataTierLabel } from '../presentation';
import { buildDecisionCardView } from '../decisionPresentation';
import { DecisionBoundaryPanel } from './DecisionBoundaryPanel';
import styles from '../OpportunitiesPage.module.css';

export function OpportunityDecisionCard({
  item,
  onOpenBrief,
}: {
  item: HotItem;
  onOpenBrief: () => void;
}) {
  const view = buildDecisionCardView(item);
  const { decision } = view;

  return (
    <article className={styles.decisionCard} data-tier={decision.identity.dataTier}>
      <div className={styles.decisionCardRail} aria-hidden="true" />

      <div className={styles.decisionCardMain}>
        <header className={styles.decisionIdentity}>
          <div className={styles.decisionIdentityTop}>
            <span className={styles.decisionSource}>{view.primarySource}</span>
            <span className={styles.decisionTier} data-tier={decision.identity.dataTier}>
              {mapDataTierLabel(decision.identity.dataTier)}
            </span>
          </div>
          <span className={styles.decisionTitleLabel}>信号标题</span>
          <h2 className={styles.decisionTitle}>{decision.identity.signalTitle}</h2>
          {(view.showProductType || view.showMarket) && (
            <div className={styles.decisionTags}>
              {view.showProductType && decision.identity.productType ? (
                <span>{decision.identity.productType}</span>
              ) : null}
              {view.showMarket && decision.identity.targetMarket ? (
                <span>{decision.identity.targetMarket}</span>
              ) : null}
            </div>
          )}
        </header>

        <section className={styles.decisionMetrics} aria-label="当前观测">
          <span className={styles.sectionMiniLabel}>当前观测</span>
          {view.metrics.length > 0 ? (
            <div className={styles.metricStrip}>
              {view.metrics.map((metric, index) => (
                <div
                  key={`${metric.sourceName}-${index}`}
                  className={`${styles.metricBlock}${metric.isWeak ? ` ${styles.metricBlockWeak}` : ''}`}
                >
                  <span className={styles.metricPrimary}>{metric.primary}</span>
                  {metric.secondary ? <span className={styles.metricSecondary}>{metric.secondary}</span> : null}
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.metricEmpty}>暂无可展示的 observed 指标</p>
          )}
          {view.weakIndicators.length > 0 && (
            <div className={styles.weakIndicatorRow}>
              {view.weakIndicators.map((indicator) => (
                <span key={indicator} className={styles.weakIndicator}>{indicator}</span>
              ))}
            </div>
          )}
        </section>

        <DecisionBoundaryPanel
          confirmText={view.confirmText}
          cannotConfirmText={view.cannotConfirmText}
        />

        <footer className={styles.decisionCardFooter}>
          <button type="button" className={styles.decisionPrimaryCta} onClick={onOpenBrief}>
            查看判断简报
          </button>
          {view.analyzeHref ? (
            <a className={styles.decisionSecondaryCta} href={view.analyzeHref}>
              进入验证
            </a>
          ) : null}
        </footer>
      </div>
    </article>
  );
}
