import type { MarketMvpResearchProtocol } from '../../lib/marketMvpResearchProtocol';
import styles from '../../pages/AnalyzePage/AnalyzePage.module.css';

type Props = {
  protocol: MarketMvpResearchProtocol;
};

const STATUS_LABELS: Record<'covered' | 'weak' | 'missing' | 'inferred', string> = {
  covered: '已覆盖',
  weak: '弱证据',
  missing: '缺失',
  inferred: '推断',
};

const CONFIDENCE_LABELS: Record<'low' | 'medium' | 'high', string> = {
  low: '低',
  medium: '中',
  high: '高',
};

function sectionTitle(title: string) {
  const map: Record<string, string> = {
    'Market Context': '市场背景假设',
    'User Segment': '用户画像假设',
    'Trend Signal': '趋势 / 偏好信号',
    'Pain Point': '痛点假设',
    'Competitor Pattern': '竞品可借鉴模式',
    'Pricing Hypothesis': '价格与商业模式假设',
    'Supply / Demand / Competition': '供需与竞争判断',
    'Evidence Coverage': '证据覆盖度',
    'MVP Stage Plan': 'MVP 阶段验证计划',
    'Probability View': '成功 / 失败概率解释',
    'Stop Conditions': '最终停止条件',
    'Missing Inputs': '还缺哪些关键信息',
  };
  return map[title] ?? title;
}

export function MarketMvpResearchProtocolPanel({ protocol }: Props) {
  return (
    <section className={styles.protocolPanel} aria-label="市场 MVP 调研协议">
      <div className={styles.protocolHeader}>
        <div>
          <div className={styles.protocolEyebrow}>MARKET MVP PROTOCOL</div>
          <h2 className={styles.protocolTitle}>{protocol.judgmentLabel}</h2>
          <p className={styles.protocolReason}>{protocol.judgmentReason}</p>
        </div>
        <div className={`${styles.protocolStatus} ${protocol.canJudge ? styles.protocolStatusReady : styles.protocolStatusHold}`}>
          {protocol.canJudge ? '可以进入低成本验证' : '暂不能判断'}
        </div>
      </div>

      {protocol.missingInputs.length > 0 ? (
        <section className={styles.protocolSection}>
          <div className={styles.protocolSectionTitle}>{sectionTitle('Missing Inputs')}</div>
          <div className={styles.protocolPills}>
            {protocol.missingInputs.map((item) => <span key={item} className={styles.protocolPill}>{item}</span>)}
          </div>
        </section>
      ) : null}

      <div className={styles.protocolGrid}>
        <section className={styles.protocolSection}><div className={styles.protocolSectionTitle}>{sectionTitle('Market Context')}</div><div className={styles.protocolLabel}>阶段</div><div className={styles.protocolValue}>{protocol.marketContext.stage}</div><div className={styles.protocolLabel}>摘要</div><div className={styles.protocolValue}>{protocol.marketContext.summary}</div><div className={styles.protocolLabel}>不确定性</div><div className={styles.protocolValue}>{protocol.marketContext.uncertainty}</div></section>
        <section className={styles.protocolSection}><div className={styles.protocolSectionTitle}>{sectionTitle('User Segment')}</div><div className={styles.protocolLabel}>主要用户</div><div className={styles.protocolValue}>{protocol.userSegment.primaryUser}</div><div className={styles.protocolLabel}>可触达段</div><div className={styles.protocolValue}>{protocol.userSegment.reachableSegment}</div><div className={styles.protocolLabel}>判断理由</div><div className={styles.protocolValue}>{protocol.userSegment.reason}</div></section>
        <section className={styles.protocolSection}><div className={styles.protocolSectionTitle}>{sectionTitle('Trend Signal')}</div><div className={styles.protocolLabel}>信号</div><div className={styles.protocolValue}>{protocol.trendSignal.signal}</div><div className={styles.protocolLabel}>可迁移洞察</div><div className={styles.protocolValue}>{protocol.trendSignal.transferableInsight}</div></section>
        <section className={styles.protocolSection}><div className={styles.protocolSectionTitle}>{sectionTitle('Pain Point')}</div><div className={styles.protocolLabel}>假设</div><div className={styles.protocolValue}>{protocol.painPoint.hypothesis}</div><div className={styles.protocolLabel}>为什么重要</div><div className={styles.protocolValue}>{protocol.painPoint.whyItMatters}</div></section>
        <section className={styles.protocolSection}><div className={styles.protocolSectionTitle}>{sectionTitle('Competitor Pattern')}</div><div className={styles.protocolLabel}>可借鉴</div><div className={styles.protocolValue}>{protocol.competitorPattern.whatToBorrow}</div><div className={styles.protocolLabel}>要避免</div><div className={styles.protocolValue}>{protocol.competitorPattern.whatToAvoid}</div><div className={styles.protocolLabel}>空白机会</div><div className={styles.protocolValue}>{protocol.competitorPattern.openGap}</div></section>
        <section className={styles.protocolSection}><div className={styles.protocolSectionTitle}>{sectionTitle('Pricing Hypothesis')}</div><div className={styles.protocolLabel}>模型</div><div className={styles.protocolValue}>{protocol.pricingHypothesis.model}</div><div className={styles.protocolLabel}>测试区间</div><div className={styles.protocolValue}>{protocol.pricingHypothesis.testRange}</div><div className={styles.protocolLabel}>风险</div><div className={styles.protocolValue}>{protocol.pricingHypothesis.risk}</div></section>
        <section className={styles.protocolSection}><div className={styles.protocolSectionTitle}>{sectionTitle('Supply / Demand / Competition')}</div><div className={styles.protocolLabel}>需求信号</div><div className={styles.protocolValue}>{protocol.supplyDemand.demandSignal}</div><div className={styles.protocolLabel}>供给压力</div><div className={styles.protocolValue}>{protocol.supplyDemand.supplyPressure}</div><div className={styles.protocolLabel}>竞争强度</div><div className={styles.protocolValue}>{protocol.supplyDemand.competitionIntensity}</div></section>
      </div>

      <section className={styles.protocolSection}>
        <div className={styles.protocolSectionTitle}>{sectionTitle('Evidence Coverage')}</div>
        <div className={styles.evidenceCoverageGrid}>
          {protocol.evidenceCoverage.map((item) => (
            <article key={item.label} className={styles.evidenceItem}>
              <div className={styles.protocolLabel}>{item.label}</div>
              <span className={`${styles.evidenceStatus} ${styles[`evidence${item.status.charAt(0).toUpperCase() + item.status.slice(1)}` as keyof typeof styles]}`}>{STATUS_LABELS[item.status]}</span>
              <p className={styles.protocolValue}>{item.reason}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.protocolSection}>
        <div className={styles.protocolSectionTitle}>{sectionTitle('MVP Stage Plan')}</div>
        <div className={styles.mvpStageList}>
          {protocol.mvpStages.map((stage) => (
            <article key={stage.stage} className={styles.mvpStageCard}>
              <div className={styles.mvpStageHeader}>
                <strong>{stage.stage}</strong>
                <span className={styles.mvpStageMeta}>{stage.timebox}</span>
              </div>
              <div className={styles.protocolLabel}>目标</div>
              <div className={styles.protocolValue}>{stage.goal}</div>
              <div className={styles.protocolLabel}>动作</div>
              <ul className={styles.mvpActionList}>
                {stage.actions.map((action) => <li key={action}>{action}</li>)}
              </ul>
              <div className={styles.passCondition}><strong>通过标准</strong><p>{stage.passCondition}</p></div>
              <div className={styles.stopCondition}><strong>停止条件</strong><p>{stage.stopCondition}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.protocolSection}>
        <div className={styles.protocolSectionTitle}>{sectionTitle('Probability View')}</div>
        <div className={styles.probabilityGrid}>
          <div><div className={styles.protocolLabel}>判断标签</div><div className={styles.protocolValue}>{protocol.probabilityView.label}</div></div>
          <div><div className={styles.protocolLabel}>置信度</div><div className={styles.protocolValue}>{CONFIDENCE_LABELS[protocol.probabilityView.confidence]}</div></div>
          <div><div className={styles.protocolLabel}>正向因素</div><ul className={styles.factorList}>{protocol.probabilityView.positiveFactors.map((item) => <li key={item}>{item}</li>)}</ul></div>
          <div><div className={styles.protocolLabel}>负向因素</div><ul className={styles.factorList}>{protocol.probabilityView.negativeFactors.map((item) => <li key={item}>{item}</li>)}</ul></div>
        </div>
      </section>

      <section className={styles.protocolSection}>
        <div className={styles.protocolSectionTitle}>{sectionTitle('Stop Conditions')}</div>
        <ul className={styles.stopConditionList}>
          {protocol.finalStopConditions.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </section>
    </section>
  );
}
