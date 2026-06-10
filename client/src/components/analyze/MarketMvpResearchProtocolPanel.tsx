import type { MarketMvpResearchProtocol } from '../../lib/marketMvpResearchProtocol';
import styles from '../../pages/AnalyzePage/AnalyzePage.module.css';

type Props = {
  protocol: MarketMvpResearchProtocol;
};

function statusLabel(status: MarketMvpResearchProtocol['evidenceCoverage'][number]['status']) {
  if (status === 'covered') return '已覆盖';
  if (status === 'weak') return '弱证据';
  if (status === 'missing') return '缺失';
  return '推断';
}

function confidenceLabel(confidence: MarketMvpResearchProtocol['probabilityView']['confidence']) {
  if (confidence === 'high') return '高';
  if (confidence === 'medium') return '中';
  return '低';
}

function painLabel(value: MarketMvpResearchProtocol['userSegment']['painIntensity']) {
  if (value === 'high') return '高';
  if (value === 'medium') return '中';
  if (value === 'low') return '低';
  return '待验证';
}

export function MarketMvpResearchProtocolPanel({ protocol }: Props) {
  return (
    <section className={styles.protocolPanel} aria-label="市场 MVP 调研协议">
      <div className={styles.protocolHeader}>
        <div>
          <div className={styles.protocolStatus}>{protocol.canJudge ? '可以进入低成本 MVP 验证' : '暂不能判断'}</div>
          <h2 className={styles.protocolTitle}>{protocol.judgmentLabel}</h2>
          <p className={styles.protocolReason}>{protocol.judgmentReason}</p>
        </div>
      </div>

      {protocol.missingInputs.length > 0 ? (
        <section className={styles.protocolSection}>
          <div className={styles.protocolLabel}>Missing Inputs</div>
          <div className={styles.protocolValue}>{protocol.missingInputs.join(' · ')}</div>
        </section>
      ) : null}

      <div className={styles.protocolGrid}>
        <section className={styles.protocolSection}><div className={styles.protocolLabel}>Market Context</div><div className={styles.protocolValue}>{protocol.marketContext.summary}</div><div className={styles.protocolValue}>{protocol.marketContext.uncertainty}</div></section>
        <section className={styles.protocolSection}><div className={styles.protocolLabel}>User Segment</div><div className={styles.protocolValue}>{protocol.userSegment.primaryUser}</div><div className={styles.protocolValue}>痛点强度：{painLabel(protocol.userSegment.painIntensity)}</div><div className={styles.protocolValue}>{protocol.userSegment.reachableSegment}</div><div className={styles.protocolValue}>{protocol.userSegment.reason}</div></section>
        <section className={styles.protocolSection}><div className={styles.protocolLabel}>Trend Signal</div><div className={styles.protocolValue}>{protocol.trendSignal.signal}</div><div className={styles.protocolValue}>{protocol.trendSignal.transferableInsight}</div></section>
        <section className={styles.protocolSection}><div className={styles.protocolLabel}>Pain Point</div><div className={styles.protocolValue}>{protocol.painPoint.hypothesis}</div><div className={styles.protocolValue}>{protocol.painPoint.whyItMatters}</div></section>
        <section className={styles.protocolSection}><div className={styles.protocolLabel}>Competitor Pattern</div><div className={styles.protocolValue}>{protocol.competitorPattern.whatToBorrow}</div><div className={styles.protocolValue}>{protocol.competitorPattern.openGap}</div><div className={styles.protocolValue}>{protocol.competitorPattern.whatToAvoid}</div></section>
        <section className={styles.protocolSection}><div className={styles.protocolLabel}>Pricing Hypothesis</div><div className={styles.protocolValue}>{protocol.pricingHypothesis.model}</div><div className={styles.protocolValue}>{protocol.pricingHypothesis.testRange}</div><div className={styles.protocolValue}>{protocol.pricingHypothesis.risk}</div></section>
        <section className={styles.protocolSection}><div className={styles.protocolLabel}>Supply / Demand / Competition</div><div className={styles.protocolValue}>{protocol.supplyDemand.demandSignal}</div><div className={styles.protocolValue}>{protocol.supplyDemand.supplyPressure}</div><div className={styles.protocolValue}>竞争强度：{protocol.supplyDemand.competitionIntensity === 'high' ? '高' : protocol.supplyDemand.competitionIntensity === 'medium' ? '中' : protocol.supplyDemand.competitionIntensity === 'low' ? '低' : '待验证'}</div></section>
      </div>

      <section className={styles.protocolSection}>
        <div className={styles.protocolLabel}>Evidence Coverage</div>
        <div className={styles.evidenceCoverageGrid}>
          {protocol.evidenceCoverage.map((item) => (
            <article key={item.label} className={styles.evidenceItem}>
              <div className={`${styles.evidenceStatus} ${item.status === 'covered' ? styles.evidenceCovered : item.status === 'weak' ? styles.evidenceWeak : item.status === 'missing' ? styles.evidenceMissing : styles.evidenceInferred}`}>{statusLabel(item.status)}</div>
              <strong>{item.label}</strong>
              <p>{item.reason}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.protocolSection}>
        <div className={styles.protocolLabel}>MVP Stage Plan</div>
        <div className={styles.mvpStageList}>
          {protocol.mvpStages.map((stage) => (
            <article key={stage.stage} className={styles.mvpStageCard}>
              <div className={styles.mvpStageHeader}>
                <strong>{stage.stage}</strong>
                <span className={styles.mvpStageMeta}>{stage.timebox}</span>
              </div>
              <p>{stage.goal}</p>
              <ul className={styles.mvpActionList}>
                {stage.actions.map((action) => <li key={action}>{action}</li>)}
              </ul>
              <section className={styles.passCondition}><strong>通过标准</strong><p>{stage.passCondition}</p></section>
              <section className={styles.stopCondition}><strong>停止条件</strong><p>{stage.stopCondition}</p></section>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.protocolSection}>
        <div className={styles.protocolLabel}>Probability View</div>
        <div className={styles.protocolValue}>当前判断：{protocol.probabilityView.label}</div>
        <div className={styles.protocolValue}>信心等级：{confidenceLabel(protocol.probabilityView.confidence)}</div>
        <div className={styles.protocolPills}>
          {protocol.probabilityView.positiveFactors.map((item) => <span key={item} className={styles.protocolPill}>{item}</span>)}
        </div>
        <div className={styles.protocolPills}>
          {protocol.probabilityView.negativeFactors.map((item) => <span key={item} className={styles.protocolPill}>{item}</span>)}
        </div>
      </section>

      <section className={styles.protocolSection}>
        <div className={styles.protocolLabel}>Stop Conditions</div>
        <ul className={styles.stopConditionList}>
          {protocol.finalStopConditions.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </section>
    </section>
  );
}
