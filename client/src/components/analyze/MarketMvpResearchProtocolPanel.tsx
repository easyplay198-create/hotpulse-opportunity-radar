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

function statusTone(status: MarketMvpResearchProtocol['evidenceCoverage'][number]['status']) {
  return status === 'covered' ? 'framed' : status === 'weak' ? 'weak' : status === 'missing' ? 'missing' : 'planned';
}

function meterValue(status: MarketMvpResearchProtocol['evidenceCoverage'][number]['status']) {
  if (status === 'covered') return '100%';
  if (status === 'weak') return '45%';
  if (status === 'inferred') return '35%';
  return '10%';
}

function shortText(text: string, max = 42) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function confidenceLabel(confidence: MarketMvpResearchProtocol['probabilityView']['confidence']) {
  if (confidence === 'high') return '高';
  if (confidence === 'medium') return '中';
  return '低';
}

function exampleList() {
  return [
    'AI 图片工具出海日本，面向独立设计师，订阅制，核心痛点是低成本生成电商素材',
    '英语学习 App 进入日本市场，面向大学生和职场新人，订阅制，验证付费意愿',
    '陪伴型机器狗进入日本市场，面向独居老人家庭，硬件销售 + AI 陪伴订阅，验证养老陪伴场景',
  ];
}

export function MarketMvpResearchProtocolPanel({ protocol }: Props) {
  if (!protocol.canJudge) {
    const missingCards = [
      { label: '目标市场', reason: '没有目标市场，无法判断竞品、价格和渠道。', example: '示例：日本 / 东南亚 / 美国 / 欧美' },
      { label: '目标用户', reason: '没有目标用户，无法判断痛点是否真实。', example: '示例：独居老人家庭 / 独立设计师 / 大学生和职场新人' },
      { label: '使用场景 / 核心痛点', reason: '没有明确场景，无法判断需求是否值得继续投入。', example: '示例：低成本生成电商素材 / 养老陪伴 / 英语口语练习' },
      { label: '商业模式 / 付费方式', reason: '没有付费方式，无法测试价格接受度。', example: '示例：订阅制 / 硬件销售 + 订阅 / 一次性付费' },
    ];

    return (
      <section className={styles.consoleShell} aria-label="信息补齐工作台">
        <div className={styles.protocolHeader}>
          <div className={styles.protocolHeaderMain}>
            <div className={styles.protocolKicker}>Market MVP Validation Flow Canvas</div>
            <h2 className={styles.missingWorkspaceTitle}>暂不能进入市场 MVP 验证</h2>
            <p className={styles.missingWorkspaceText}>当前输入还不足以形成可靠的市场假设。请先补齐关键条件，否则继续分析会误导判断。</p>
          </div>
          <div className={`${styles.protocolBadge} ${styles.protocolBadgeHold}`}>
            Hold / 信息不足
          </div>
        </div>

        <section className={styles.missingWorkspace}>
          <div className={styles.missingWorkspaceHeader}>
            <div className={styles.missingStatusBadge}>信息不足</div>
            <p className={styles.missingWorkspaceText}>信息越完整，验证结果越可靠。</p>
          </div>

          <div className={styles.missingGrid}>
            {missingCards.map((card) => (
              <article key={card.label} className={styles.missingCard}>
                <div className={styles.missingCardTitle}>{card.label}</div>
                <div className={styles.missingCardStatus}>待补充</div>
                <div className={styles.missingCardReason}>{card.reason}</div>
                <div className={styles.missingCardExample}>{card.example}</div>
              </article>
            ))}
          </div>

          <section className={styles.completionFormula}>
            <span className={styles.formulaToken}>我想验证</span>
            <p>
              【<span className={styles.formulaToken}>产品类型</span>】进入【<span className={styles.formulaToken}>目标市场</span>】，面向【
              <span className={styles.formulaToken}>目标用户</span>】，通过【<span className={styles.formulaToken}>商业模式</span>】，解决【
              <span className={styles.formulaToken}>核心痛点</span>】。
            </p>
          </section>

          <section className={styles.examplePromptList}>
            <div className={styles.protocolKicker}>Example Prompts</div>
            {exampleList().map((item) => (
              <div key={item} className={styles.examplePromptItem}>{item}</div>
            ))}
          </section>
        </section>
      </section>
    );
  }

  const coverageCount = protocol.evidenceCoverage.filter((item) => item.status === 'covered').length;
  const maxRisk = protocol.probabilityView.negativeFactors[0] ?? '待补齐证据';
  const nextStage = protocol.mvpStages[0];

  const tracks = [
    { title: '市场', summary: shortText(protocol.marketContext.summary, 22), status: statusTone(protocol.evidenceCoverage[0]?.status ?? 'missing') },
    { title: '用户', summary: shortText(protocol.userSegment.primaryUser, 22), status: statusTone(protocol.evidenceCoverage[2]?.status ?? 'missing') },
    { title: '痛点', summary: shortText(protocol.painPoint.hypothesis, 22), status: statusTone(protocol.evidenceCoverage[2]?.status ?? 'missing') },
    { title: '价格', summary: shortText(protocol.pricingHypothesis.testRange, 22), status: statusTone(protocol.evidenceCoverage[3]?.status ?? 'missing') },
    { title: '竞品', summary: shortText(protocol.competitorPattern.openGap, 22), status: statusTone(protocol.evidenceCoverage[1]?.status ?? 'missing') },
    { title: '渠道', summary: shortText(protocol.supplyDemand.demandSignal, 22), status: statusTone(protocol.evidenceCoverage[4]?.status ?? 'missing') },
  ] as const;

  const stages = protocol.mvpStages.slice(0, 3);

  return (
    <section className={styles.consoleShell} aria-label="Market MVP Validation Flow Canvas">
      <div className={styles.protocolHeader}>
        <div className={styles.protocolHeaderMain}>
          <div className={styles.protocolKicker}>Market MVP Validation Flow Canvas</div>
          <h2 className={styles.protocolTitle}>{protocol.judgmentLabel}</h2>
          <p className={styles.protocolReason}>{shortText(protocol.judgmentReason, 32)}</p>
        </div>
        <div className={`${styles.protocolBadge} ${styles.protocolBadgeReady}`}>Ready</div>
      </div>

      <section className={styles.validationSummaryBar}>
        <article className={styles.summaryItem}><span className={styles.summaryLabel}>当前状态</span><strong className={styles.summaryValue}>{shortText(protocol.judgmentLabel, 12)}</strong><div className={styles.summaryHint}>{shortText(protocol.judgmentReason, 16)}</div><span className={styles.summaryDot} /></article>
        <article className={styles.summaryItem}><span className={styles.summaryLabel}>证据覆盖</span><strong className={styles.summaryValue}>{coverageCount}/6</strong><div className={styles.summaryHint}>覆盖越高，判断越稳。</div><span className={styles.summaryDot} /></article>
        <article className={styles.summaryItem}><span className={styles.summaryLabel}>最大风险</span><strong className={styles.summaryValue}>{shortText(maxRisk, 12)}</strong><div className={styles.summaryHint}>先修最弱项。</div><span className={styles.summaryDot} /></article>
        <article className={styles.summaryItem}><span className={styles.summaryLabel}>下一步实验</span><strong className={styles.summaryValue}>{shortText(nextStage?.stage ?? '待补齐', 12)}</strong><div className={styles.summaryHint}>{shortText(nextStage?.goal ?? '先补齐输入。', 16)}</div><span className={styles.summaryDot} /></article>
      </section>

      <div className={styles.flowCanvasLayout}>
        <section className={styles.flowMatrix}>
          <div className={styles.flowMatrixHeader}>
            <span>Hypothesis Tracks</span>
            <div className={styles.flowStageCells}><span>已框定</span><span>待实验</span><span>证据收集</span><span>决策门槛</span></div>
          </div>
          {tracks.map((track, index) => (
            <div key={track.title} className={styles.flowTrackRow}>
              <div className={styles.flowTrackLabel}><strong>{track.title}</strong><span>{track.summary}</span></div>
              <div className={styles.flowStageCells}>
                {['framed', 'planned', 'weak', 'pending'].map((stage) => (
                  <div key={stage} className={`${styles.flowCell} ${styles[`flowNode${stage[0].toUpperCase()}${stage.slice(1)}`]}`}>
                    <span className={styles.flowNode} />
                    <small>{index === 0 && stage === 'framed' ? '框定' : index === 0 && stage === 'planned' ? '实验' : index === 0 && stage === 'weak' ? '弱证据' : index === 0 && stage === 'pending' ? '门槛' : ''}</small>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>

        <aside className={styles.decisionRail}>
          <div className={styles.decisionRailCard}>
            <div className={styles.protocolKicker}>Next Action</div>
            <div className={styles.nextActionCard}>
              <strong>{nextStage?.stage ?? '补齐输入后验证'}</strong>
              <p>{shortText(nextStage?.goal ?? '先补齐关键输入。', 34)}</p>
              <span>{nextStage?.timebox ?? '当前不进入市场测试'}</span>
            </div>
          </div>
          <div className={styles.decisionRailCard}>
            <div className={styles.protocolKicker}>Why This First</div>
            <p>价格和渠道判断都依赖痛点是否真实，因此先验证痛点与需求。</p>
          </div>
          <div className={styles.decisionRailCard}>
            <div className={styles.protocolKicker}>Stop Gate</div>
            <div className={styles.stopGateCard}>{shortText(nextStage?.stopCondition ?? protocol.finalStopConditions[0] ?? '继续生成会误导决策', 42)}</div>
          </div>
        </aside>
      </div>

      <section className={styles.experimentPath}>
        <div className={styles.experimentPathHeader}>
          <div className={styles.protocolKicker}>MVP Experiment Path</div>
          <h3 className={styles.panelTitle}>三阶段验证路径</h3>
        </div>
        <div className={styles.experimentStepCard}>
          {stages.map((stage, index) => (
            <article key={stage.stage} className={styles.experimentStepBody}>
              <div className={styles.experimentStepNumber}>{String(index + 1).padStart(2, '0')}</div>
              <div className={styles.experimentStepText}>
                <div className={styles.experimentStepTitleRow}><strong>{shortText(stage.stage, 18)}</strong><span>{stage.timebox}</span></div>
                <div className={styles.experimentColumns}>
                  <div className={styles.experimentColumn}><span className={styles.protocolLabel}>验证假设</span><p>{shortText(stage.goal, 36)}</p></div>
                  <div className={styles.experimentColumn}><span className={styles.protocolLabel}>测试动作</span><ul>{stage.actions.slice(0, 2).map((action) => <li key={action}>{shortText(action, 22)}</li>)}</ul></div>
                  <div className={styles.experimentGateRow}><div className={styles.passMiniGate}><strong>通过</strong><p>{shortText(stage.passCondition, 22)}</p></div><div className={styles.stopMiniGate}><strong>停止</strong><p>{shortText(stage.stopCondition, 22)}</p></div></div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <details className={styles.collapsedProtocolDetails}>
        <summary>查看完整协议细节</summary>
        <div className={styles.legacyReferenceDetails}>
          <section className={styles.evidenceImpactBoard}>
            <div className={styles.panelHeaderRow}><div><div className={styles.protocolKicker}>Evidence Coverage</div><h3 className={styles.panelTitle}>证据对判断的影响</h3></div></div>
            <div className={styles.evidenceImpactGrid}>
              {protocol.evidenceCoverage.map((item) => (
                <article key={item.label} className={`${styles.evidenceImpactItem} ${styles[`evidenceImpactItem--${item.status}`]}`}>
                  <div className={styles.evidenceImpactTopRow}><strong>{item.label}</strong><span className={styles.evidenceStatusPill}>{statusLabel(item.status)}</span></div>
                  <div className={styles.evidenceImpactMeta}>影响：{item.label.includes('市场') ? '市场' : item.label.includes('用户') || item.label.includes('痛点') ? '用户' : item.label.includes('价格') ? '价格' : item.label.includes('渠道') ? '渠道' : '合规'}</div>
                  <p>{shortText(item.reason, 36)}</p>
                  <div className={styles.evidenceMeter}><span className={styles.impactTrack}><span className={styles.impactFill} style={{ width: meterValue(item.status) }} /></span></div>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.confidenceConsole}>
            <div className={styles.panelHeaderRow}><div><div className={styles.protocolKicker}>Probability</div><h3 className={styles.panelTitle}>信心与偏向</h3></div><div className={styles.protocolValue}>当前信心：{confidenceLabel(protocol.probabilityView.confidence)}</div></div>
            <div className={styles.confidenceSegments} aria-hidden="true">{[0, 1, 2].map((index) => <span key={index} className={`${styles.confidenceSegment} ${index < (protocol.probabilityView.confidence === 'high' ? 3 : protocol.probabilityView.confidence === 'medium' ? 2 : 1) ? styles.confidenceSegmentActive : ''}`} />)}</div>
            <div className={styles.confidenceColumns}>
              <section><div className={styles.protocolLabel}>正向因素</div><div className={styles.protocolPills}>{protocol.probabilityView.positiveFactors.map((item) => <span key={item} className={styles.protocolPill}>{shortText(item, 22)}</span>)}</div></section>
              <section><div className={styles.protocolLabel}>负向因素</div><div className={styles.protocolPills}>{protocol.probabilityView.negativeFactors.map((item) => <span key={item} className={styles.protocolPill}>{shortText(item, 22)}</span>)}</div></section>
            </div>
          </section>

          <section className={styles.guardrailConsole}>
            <div className={styles.panelHeaderRow}><div><div className={styles.protocolKicker}>Stop Conditions</div><h3 className={styles.panelTitle}>决策门</h3></div></div>
            <div className={styles.guardrailGrid}>
              <article className={styles.guardrailColumn}><h4>继续信号</h4><ul>{protocol.mvpStages.map((stage) => stage.passCondition).slice(0, 4).map((item, index) => <li key={`${item}-${index}`}>{shortText(item, 34)}</li>)}</ul></article>
              <article className={styles.guardrailColumn}><h4>停止信号</h4><ul>{protocol.finalStopConditions.slice(0, 4).map((item, index) => <li key={`${item}-${index}`}>{shortText(item, 34)}</li>)}</ul></article>
            </div>
          </section>
        </div>
      </details>

      <details className={styles.legacyReferenceDetails}>
        <summary>查看旧版评分参考</summary>
        <p>以下为旧版评分视图，仅作为补充参考，最终判断以 Market MVP Flow Canvas 为主。</p>
      </details>
    </section>
  );
}
