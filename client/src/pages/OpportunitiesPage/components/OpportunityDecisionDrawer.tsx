import type { DecisionLimitation } from '../../../types/opportunityDecision';
import { useEffect, useId, useRef, useState } from 'react';
import type { HotItem } from '../../../types/hot';
import {
  buildDecisionFromItem,
  buildRiskReferenceItems,
  formatDecisionTime,
  getDecisionWeakIndicators,
  getWhyNowSectionTitle,
  groupLimitationsByCategory,
  mapDecisionProvenanceLabel,
  mapLimitationCategoryLabel,
  mapRiskLevelLabel,
  shouldShowMarket,
} from '../decisionPresentation';
import { mapDataTierLabel as mapTier } from '../presentation';
import { DecisionEvidenceList } from './DecisionEvidenceList';
import styles from '../OpportunitiesPage.module.css';

function safeExternalUrl(value?: string | null) {
  const raw = value?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (url.hostname === 'example.com' || url.hostname.endsWith('.example.com')) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function OpportunityDecisionDrawer({
  item,
  onClose,
}: {
  item: HotItem;
  onClose: () => void;
}) {
  const decision = buildDecisionFromItem(item);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [knowledgeExpanded, setKnowledgeExpanded] = useState(false);
  const [dataNotesExpanded, setDataNotesExpanded] = useState(false);
  const [riskReferenceExpanded, setRiskReferenceExpanded] = useState(false);
  const kbContentId = useId();
  const dataNotesId = useId();
  const riskReferenceId = useId();

  const observed = decision.observations.filter((observation) => observation.provenance === 'observed');
  const knowledge = decision.observations.filter((observation) => observation.provenance === 'knowledge_base');
  const unknown = decision.observations.filter((observation) => observation.provenance === 'unknown');
  const weakIndicators = getDecisionWeakIndicators(decision);
  const primaryUrl = safeExternalUrl(decision.identity.sourceUrl);
  const showProductType = Boolean(decision.identity.productType?.trim() && decision.identity.productType !== '产品类型待确认');
  const showMarket = shouldShowMarket(decision.identity.targetMarket);
  const limitationGroups = groupLimitationsByCategory(decision.limitations);
  const riskReferences = buildRiskReferenceItems(decision.risks, 2);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className={styles.drawerBackdrop} role="presentation" onClick={onClose}>
      <aside
        className={styles.briefDrawer}
        role="dialog"
        aria-modal="true"
        aria-label="信号判断简报"
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.briefHeader}>
          <div>
            <span className={styles.eyebrow}>SIGNAL DECISION BRIEF</span>
            <h2>信号判断简报</h2>
            <p className={styles.briefDisclaimer}>这是由公开信号生成的初步判断，不是市场进入结论。</p>
            <div className={styles.briefIdentityMeta}>
              <span className={styles.decisionTitleLabel}>信号标题</span>
              <strong>{decision.identity.signalTitle}</strong>
            </div>
            <div className={styles.drawerHeaderMeta}>
              <span>{decision.identity.primarySource ?? '来源待确认'}</span>
              <span className={styles.metaSep}>·</span>
              <span className={styles.drawerTierLabel} data-tier={decision.identity.dataTier}>
                {mapTier(decision.identity.dataTier)}
              </span>
              {showProductType ? (
                <>
                  <span className={styles.metaSep}>·</span>
                  <span>{decision.identity.productType}</span>
                </>
              ) : null}
              {showMarket ? (
                <>
                  <span className={styles.metaSep}>·</span>
                  <span>{decision.identity.targetMarket}</span>
                </>
              ) : null}
              <span className={styles.metaSep}>·</span>
              <span>{formatDecisionTime(decision.identity.retrievedAt)}</span>
            </div>
            {weakIndicators.length > 0 && (
              <div className={styles.weakIndicatorRow}>
                {weakIndicators.map((indicator) => (
                  <span key={indicator} className={styles.weakIndicator}>{indicator}</span>
                ))}
              </div>
            )}
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="关闭详情">×</button>
        </header>

        <div className={styles.briefContent}>
          <section className={styles.briefModule}>
            <h3>当前观测</h3>
            <DecisionEvidenceList observations={observed} variant="brief" />
            {unknown.length > 0 && (
              <div className={styles.briefSubSection}>
                <h4>未分类记录</h4>
                <DecisionEvidenceList observations={unknown} variant="compact" />
              </div>
            )}
            {knowledge.length > 0 && (
              <section className={styles.collapsibleSection}>
                <div className={styles.collapsibleHeader}>
                  <h3 className={styles.collapsibleTitle}>内部知识库补充 · {knowledge.length} 条</h3>
                  <button
                    type="button"
                    className={styles.collapsibleToggle}
                    aria-expanded={knowledgeExpanded}
                    aria-controls={kbContentId}
                    onClick={(event) => {
                      event.stopPropagation();
                      setKnowledgeExpanded((value) => !value);
                    }}
                  >
                    {knowledgeExpanded ? '收起内部补充' : '展开内部补充'}
                  </button>
                </div>
                {knowledgeExpanded ? (
                  <div id={kbContentId} className={styles.collapsibleContent}>
                    <DecisionEvidenceList observations={knowledge} variant="compact" />
                  </div>
                ) : null}
              </section>
            )}
          </section>

          <section className={styles.briefModule}>
            <h3>当前证据能支持什么</h3>
            {decision.supportsClaims.length > 0 ? (
              <ul className={styles.claimList}>
                {decision.supportsClaims.map((claim) => (
                  <li key={claim.id}>
                    <span className={styles.claimRef}>#{claim.evidenceRefs.join(', #')}</span>
                    <p>{claim.statement}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.briefEmpty}>当前没有具备原始链接和有效采集时间的外部观测，因此无法形成可追溯陈述。</p>
            )}
          </section>

          <section className={`${styles.briefModule} ${styles.briefModuleHighlight}`}>
            <h3>当前证据不能证明什么</h3>
            <div className={styles.limitationGroups}>
              {limitationGroups.map((group) => (
                <div key={group.category} className={styles.limitationGroup}>
                  <span className={styles.limitationCategory}>{mapLimitationCategoryLabel(group.category as DecisionLimitation['category'])}</span>
                  {group.items.map((limitation) => (
                    <article key={limitation.id} className={styles.limitationItem}>
                      <p>{limitation.statement}</p>
                      <small>影响判断：{limitation.affectedJudgment}</small>
                    </article>
                  ))}
                </div>
              ))}
            </div>
          </section>

          <section className={`${styles.briefModule} ${styles.validationModule}`}>
            <h3>下一步最该验证什么</h3>
            <p className={styles.briefParagraph}>{decision.validationHandoff.statement}</p>
            <ol className={styles.keyQuestionList}>
              {decision.validationHandoff.keyQuestions.map((question, index) => (
                <li key={question}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <p>{question}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className={styles.briefModule}>
            <h3>{getWhyNowSectionTitle(decision)}</h3>
            {decision.whyNow.statement ? (
              <p className={styles.briefParagraph}>{decision.whyNow.statement}</p>
            ) : (
              <p className={styles.briefEmpty}>当前缺少有效采集时间，无法形成“为什么是现在”的判断。</p>
            )}
          </section>

          {riskReferences.length > 0 ? (
            <section className={styles.collapsibleSection}>
              <div className={styles.collapsibleHeader}>
                <h3 className={styles.collapsibleTitle}>规则风险参考 · {riskReferences.length} 条</h3>
                <button
                  type="button"
                  className={styles.collapsibleToggle}
                  aria-expanded={riskReferenceExpanded}
                  aria-controls={riskReferenceId}
                  onClick={(event) => {
                    event.stopPropagation();
                    setRiskReferenceExpanded((value) => !value);
                  }}
                >
                  {riskReferenceExpanded ? '收起' : '展开'}
                </button>
              </div>
              <p className={styles.riskReferenceNote}>通用核查项，不是当前机会已确认风险。</p>
              {riskReferenceExpanded ? (
                <div id={riskReferenceId} className={styles.collapsibleContent}>
                  <div className={styles.riskList}>
                    {riskReferences.map((risk) => (
                      <article key={risk.id} className={styles.riskItem}>
                        <div className={styles.riskItemHeader}>
                          <span className={styles.riskCategory}>{risk.categoryLabel}</span>
                          <span className={styles.riskLevel} data-level={risk.level}>{mapRiskLevelLabel(risk.level)}</span>
                          <span className={styles.riskProvenance}>{mapDecisionProvenanceLabel('rule_derived')}</span>
                        </div>
                        <p className={styles.riskStatement}>{risk.statement}</p>
                      </article>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          <section className={styles.collapsibleSection}>
            <div className={styles.collapsibleHeader}>
              <h3 className={styles.collapsibleTitle}>数据说明 · {decision.dataNotes.externalSourceCount} 个外部来源</h3>
              <button
                type="button"
                className={styles.collapsibleToggle}
                aria-expanded={dataNotesExpanded}
                aria-controls={dataNotesId}
                onClick={(event) => {
                  event.stopPropagation();
                  setDataNotesExpanded((value) => !value);
                }}
              >
                {dataNotesExpanded ? '收起' : '展开'}
              </button>
            </div>
            {dataNotesExpanded ? (
              <div id={dataNotesId} className={styles.collapsibleContent}>
                <ul className={styles.dataNotesList}>
                  <li>外部来源数：{decision.dataNotes.externalSourceCount}</li>
                  <li>知识库条目：{decision.dataNotes.knowledgeBaseEntryCount}</li>
                  <li>最近采集：{formatDecisionTime(decision.dataNotes.latestRetrievedAt)}</li>
                  {decision.dataNotes.missingFields.length > 0 ? (
                    <li>缺失字段：{decision.dataNotes.missingFields.join('、')}</li>
                  ) : null}
                </ul>
                <ul className={styles.disclaimerList}>
                  {decision.dataNotes.disclaimers.map((disclaimer) => (
                    <li key={disclaimer}>{disclaimer}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        </div>

        <footer className={styles.briefFooter}>
          <p className={styles.briefFooterNote}>进入与停止条件需要结合你的目标市场、预算和团队能力生成。</p>
          <div className={styles.briefFooterActions}>
            {decision.validationHandoff.analyzeHref ? (
              <a className={styles.primaryButton} href={decision.validationHandoff.analyzeHref}>
                进入验证工具
              </a>
            ) : null}
            {primaryUrl ? (
              <a className={styles.secondaryButton} href={primaryUrl} target="_blank" rel="noreferrer">
                打开原始来源
              </a>
            ) : null}
            <button className={styles.secondaryButton} type="button" onClick={onClose}>
              返回列表
            </button>
          </div>
        </footer>
      </aside>
    </div>
  );
}
