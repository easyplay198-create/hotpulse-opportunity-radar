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

function meterClass(status: MarketMvpResearchProtocol['evidenceCoverage'][number]['status']) {
  if (status === 'covered') return styles.evidenceFillCovered;
  if (status === 'weak') return styles.evidenceFillWeak;
  if (status === 'missing') return styles.evidenceFillMissing;
  return styles.evidenceFillInferred;
}

function meterValue(status: MarketMvpResearchProtocol['evidenceCoverage'][number]['status']) {
  if (status === 'covered') return '100%';
  if (status === 'weak') return '45%';
  if (status === 'inferred') return '35%';
  return '10%';
}

function readinessStatus(status: MarketMvpResearchProtocol['evidenceCoverage'][number]['status']) {
  if (status === 'covered') return 'ready';
  if (status === 'weak') return 'weak';
  if (status === 'missing') return 'missing';
  return 'inferred';
}

function mapLabel(label: string) {
  if (label === '用户输入完整度') return '输入完整度';
  if (label === '目标用户痛点') return '痛点';
  if (label === '价格假设') return '价格';
  if (label === '获客渠道') return '渠道';
  if (label === '竞品借鉴假设') return '竞品';
  if (label === '合规 / 平台风险') return '合规';
  return label;
}

export function MarketMvpResearchProtocolPanel({ protocol }: Props) {
  const readiness = protocol.evidenceCoverage.slice(0, 5);
  const hypothesisCards = [
    { title: '市场背景假设', eyebrow: 'Market Context', verdict: protocol.marketContext.stage, status: protocol.canJudge ? 'ready' : 'missing', keyLine: protocol.marketContext.summary },
    { title: '用户画像假设', eyebrow: 'User Segment', verdict: `痛点 ${painLabel(protocol.userSegment.painIntensity)}`, status: protocol.userSegment.painIntensity === 'unknown' ? 'weak' : 'ready', keyLine: protocol.userSegment.primaryUser },
    { title: '趋势 / 偏好信号', eyebrow: 'Trend Signal', verdict: protocol.trendSignal.evidenceStatus === 'covered' ? '可借鉴' : '待补证', status: protocol.trendSignal.evidenceStatus, keyLine: protocol.trendSignal.signal },
    { title: '痛点假设', eyebrow: 'Pain Point', verdict: protocol.painPoint.strength === 'strong' ? '强' : protocol.painPoint.strength === 'medium' ? '中' : '待验证', status: protocol.painPoint.strength === 'unknown' ? 'weak' : 'inferred', keyLine: protocol.painPoint.hypothesis },
    { title: '竞品可借鉴模式', eyebrow: 'Competitor Pattern', verdict: protocol.competitorPattern.evidenceStatus === 'covered' ? '可借鉴' : '待找到', status: protocol.competitorPattern.evidenceStatus, keyLine: protocol.competitorPattern.openGap },
    { title: '价格与商业模式假设', eyebrow: 'Pricing Hypothesis', verdict: '待测试', status: protocol.probabilityView.confidence === 'high' ? 'covered' : 'weak', keyLine: protocol.pricingHypothesis.testRange },
    { title: '供需与竞争判断', eyebrow: 'Supply / Demand', verdict: protocol.supplyDemand.competitionIntensity === 'high' ? '竞争强' : protocol.supplyDemand.competitionIntensity === 'medium' ? '竞争中' : '待验证', status: protocol.supplyDemand.competitionIntensity === 'unknown' ? 'inferred' : 'covered', keyLine: protocol.supplyDemand.demandSignal },
  ];

  const passSignals = protocol.mvpStages.map((stage) => stage.passCondition);

  return (
    <section className={styles.protocolPanel} aria-label="市场 MVP 调研协议">
      <div className={styles.protocolHeader}>
        <div className={styles.protocolHeaderMain}>
          <div className={styles.protocolKicker}>Market MVP Validation Console</div>
          <h2 className={styles.protocolTitle}>{protocol.judgmentLabel}</h2>
          <p className={styles.protocolReason}>{protocol.judgmentReason}</p>
        </div>
        <div className={`${styles.protocolBadge} ${protocol.canJudge ? styles.protocolBadgeReady : styles.protocolBadgeHold}`}>
          {protocol.canJudge ? 'Ready' : 'Hold'}
        </div>
      </div>

      <div className={styles.decisionBar} aria-label="决策条">
        <div className={styles.decisionBarItem}>
          <span>输入完整度</span>
          <strong>{protocol.missingInputs.length === 0 ? 'ready' : protocol.missingInputs.length <= 2 ? 'weak' : 'missing'}</strong>
        </div>
        <div className={styles.decisionBarItem}>
          <span>证据覆盖度</span>
          <strong>{protocol.evidenceCoverage.filter((item) => item.status === 'covered').length}/6</strong>
        </div>
        <div className={styles.decisionBarItem}>
          <span>可测试性</span>
          <strong>{protocol.canJudge ? 'ready' : 'missing'}</strong>
        </div>
      </div>

      <section className={styles.readinessStrip} aria-label="验证前置条件">
        {readiness.map((item) => (
          <article key={item.label} className={`${styles.readinessItem} ${styles[`readinessItem--${readinessStatus(item.status)}`]}`}>
            <span className={styles.readinessDot} aria-hidden="true" />
            <div>
              <strong>{mapLabel(item.label)}</strong>
              <p>{statusLabel(item.status)}</p>
            </div>
          </article>
        ))}
      </section>

      {protocol.missingInputs.length > 0 ? (
        <section className={styles.protocolSection}>
          <div className={styles.protocolLabel}>Missing Inputs</div>
          <div className={styles.protocolValue}>{protocol.missingInputs.join(' · ')}</div>
        </section>
      ) : null}

      <section className={styles.hypothesisMap} aria-label="假设地图">
        {hypothesisCards.map((card) => (
          <article key={card.title} className={`${styles.hypothesisCard} ${styles[`hypothesisCard--${card.status}`]}`}>
            <div className={styles.hypothesisEyebrow}>{card.eyebrow}</div>
            <div className={styles.hypothesisTopRow}>
              <h3>{card.title}</h3>
              <span className={styles.hypothesisStatus}>{card.verdict}</span>
            </div>
            <p>{card.keyLine}</p>
          </article>
        ))}
      </section>

      <section className={styles.protocolSection}>
        <div className={styles.protocolLabel}>Evidence Coverage Board</div>
        <div className={styles.evidenceCoverageGrid}>
          {protocol.evidenceCoverage.map((item) => (
            <article key={item.label} className={styles.evidenceItem}>
              <div className={`${styles.evidenceStatus} ${item.status === 'covered' ? styles.evidenceCovered : item.status === 'weak' ? styles.evidenceWeak : item.status === 'missing' ? styles.evidenceMissing : styles.evidenceInferred}`}>
                <span>{statusLabel(item.status)}</span>
              </div>
              <strong>{mapLabel(item.label)}</strong>
              <p>{item.reason}</p>
              <div className={styles.evidenceMeter} aria-hidden="true">
                <span className={styles.evidenceTrack}>
                  <span className={`${styles.evidenceFill} ${meterClass(item.status)}`} style={{ width: meterValue(item.status) }} />
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.protocolSection}>
        <div className={styles.protocolLabel}>MVP Stage Timeline</div>
        <div className={styles.stageTimeline}>
          {protocol.mvpStages.map((stage, index) => (
            <article key={stage.stage} className={styles.mvpStageCard}>
              <div className={styles.stageNode}>
                <div className={styles.stageNumber}>{String(index + 1).padStart(2, '0')}</div>
                <div className={styles.stageMeta}>
                  <div className={styles.stageMetaTop}>
                    <strong>{stage.stage}</strong>
                    <span>{stage.timebox}</span>
                  </div>
                  <p>{stage.goal}</p>
                </div>
              </div>
              <div className={styles.stageSplit}>
                <section>
                  <div className={styles.protocolLabel}>Actions</div>
                  <ul className={styles.mvpActionList}>
                    {stage.actions.map((action) => <li key={action}>{action}</li>)}
                  </ul>
                </section>
                <section className={styles.passStopGrid}>
                  <div className={styles.passBox}>
                    <strong>Pass</strong>
                    <p>{stage.passCondition}</p>
                  </div>
                  <div className={styles.stopBox}>
                    <strong>Stop</strong>
                    <p>{stage.stopCondition}</p>
                  </div>
                </section>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.protocolSection}>
        <div className={styles.protocolLabel}>Pass / Stop Guardrails</div>
        <div className={styles.guardrailGrid}>
          <article className={styles.guardrailPass}>
            <h3>继续条件 / Pass Signals</h3>
            <ul>
              {passSignals.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </article>
          <article className={styles.guardrailStop}>
            <h3>停止条件 / Stop Signals</h3>
            <ul className={styles.stopConditionList}>
              {protocol.finalStopConditions.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </article>
        </div>
      </section>

      <section className={styles.protocolSection}>
        <div className={styles.protocolLabel}>Confidence Panel</div>
        <div className={styles.confidencePanel}>
          <div className={styles.confidenceTopRow}>
            <div>
              <div className={styles.protocolValue}>当前判断：{protocol.probabilityView.label}</div>
              <div className={styles.protocolValue}>信心等级：{confidenceLabel(protocol.probabilityView.confidence)}</div>
            </div>
            <div className={styles.confidenceMeter} aria-label={`信心等级 ${confidenceLabel(protocol.probabilityView.confidence)}`}>
              <span className={`${styles.confidenceSegment} ${protocol.probabilityView.confidence !== 'low' ? styles.confidenceSegmentActive : ''}`} />
              <span className={`${styles.confidenceSegment} ${protocol.probabilityView.confidence === 'medium' || protocol.probabilityView.confidence === 'high' ? styles.confidenceSegmentActive : ''}`} />
              <span className={`${styles.confidenceSegment} ${protocol.probabilityView.confidence === 'high' ? styles.confidenceSegmentActive : ''}`} />
            </div>
          </div>
          <div className={styles.confidenceColumns}>
            <section>
              <div className={styles.protocolLabel}>正向因素</div>
              <div className={styles.protocolPills}>
                {protocol.probabilityView.positiveFactors.map((item) => <span key={item} className={styles.protocolPill}>{item}</span>)}
              </div>
            </section>
            <section>
              <div className={styles.protocolLabel}>负向因素</div>
              <div className={styles.protocolPills}>
                {protocol.probabilityView.negativeFactors.map((item) => <span key={item} className={styles.protocolPill}>{item}</span>)}
              </div>
            </section>
          </div>
        </div>
      </section>
    </section>
  );
}
