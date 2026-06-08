import type { AnalyzeResponse } from '../../types/analyze';
import styles from '../../pages/AnalyzePage/AnalyzePage.module.css';

function badgeLabel(value?: string) {
  if (value === 'high') return '强';
  if (value === 'medium') return '中';
  if (value === 'low') return '弱';
  return '无';
}

function clampText(value: unknown, fallback: string) {
  if (typeof value !== 'string') return fallback;
  return value.trim() || fallback;
}

function meterWidth(level: 'high' | 'medium' | 'low' | 'none') {
  if (level === 'high') return '92%';
  if (level === 'medium') return '62%';
  if (level === 'low') return '32%';
  return '12%';
}

export function AnalyzeActionReport({ result, source }: { result: AnalyzeResponse | null; source: 'real' | 'mock' | 'fallback' }) {
  if (!result) return null;

  const evidenceCount = result.evidenceBoard?.length ?? 0;
  const rejectedCount = result.relevanceScores?.rejectedSignals?.length ?? 0;
  const matchScore = result.recommendation?.matchScore ?? 0;
  const evidenceStrength = (result.recommendation?.evidenceStrength ?? 'low') as 'high' | 'medium' | 'low';
  const dataConfidence = source === 'real' ? 'high' : source === 'mock' ? 'low' : 'medium';
  const maxUncertainty = result.riskBottlenecks?.[0]?.why || '用户、痛点、付费三项仍未闭环';
  const nextStep = result.recommendation?.nextStep || '继续补充信息，再做小样本验证';
  const recommendationLabel = source === 'real' ? '继续小样本验证' : source === 'mock' ? '需要补充信息' : '暂缓';

  const evidenceGaps = [
    {
      label: '缺什么证据',
      text: result.evidenceGaps?.[0] || '缺少真实用户反馈和可追溯信号。',
      why: '当前证据还不足以支撑进入判断。',
      how: '补 3-5 条访谈或真实行为记录。',
      impact: '可提升结论可信度。',
    },
    {
      label: '为什么不能直接下结论',
      text: result.riskBottlenecks?.[0]?.what || '关键风险未被验证。',
      why: '存在市场、获客或付费不确定性。',
      how: '先验证最小可行动作。',
      impact: '避免过早投入资源。',
    },
    {
      label: '怎么补',
      text: result.recommendation?.summary || '先做小样本验证。',
      why: '需要更强的证据链。',
      how: '做 landing page、访谈和触达测试。',
      impact: '有助于区分继续/暂停/转向。',
    },
  ];

  const hypotheses = [
    {
      title: '目标用户假设',
      statement: clampText(result.projectUnderstanding?.targetAudience, '目标用户尚未明确'),
      strength: badgeLabel(result.recommendation?.evidenceStrength),
      action: '访谈 3-5 位目标用户',
      standard: '2/5 人能清晰描述痛点',
    },
    {
      title: '痛点强度假设',
      statement: result.recommendation?.summary || '痛点强度需要验证',
      strength: evidenceCount > 2 ? '中' : '弱',
      action: '测试问题是否高频且紧迫',
      standard: 'landing page 有点击或留资',
    },
    {
      title: '付费意愿假设',
      statement: '先验证是否愿意为结果付费',
      strength: rejectedCount > 0 ? '弱' : '无',
      action: '做价格锚点和付费表达测试',
      standard: '找到至少 3 条真实市场信号',
    },
  ];

  const actionCards = [
    {
      title: 'Landing page 一句话',
      body: `帮助 ${result.projectUnderstanding?.targetAudience || '目标用户'} 更快完成 ${result.projectUnderstanding?.productCategory || '核心任务'}。`,
    },
    {
      title: '冷启动触达文案 1 条',
      body: '我在验证一个轻量方案，想请你花 3 分钟聊一下你现在怎么处理这个问题。',
    },
  ];

  const interviewQuestions = [
    '你上次遇到这个问题是什么时候？',
    '现在用什么方式解决？',
    '最让你头疼的部分是什么？',
    '如果有更简单方案，你会怎么用？',
    '什么情况下你愿意尝试新工具？',
  ];

  const keywords = [
    result.recommendation?.targetMarket || 'target market',
    result.projectUnderstanding?.productCategory || 'AI SaaS',
    'pain point',
    'pricing',
    'alternative tools',
  ];

  const judgmentColumns = {
    continue: ['2/5 访谈痛点清楚', 'landing 有点击留资', '3 条真实信号'],
    pause: ['无明确目标用户', '无人表达痛点', '无可追溯证据'],
    pivot: ['痛点对但市场不对', '定价不成立', '获客成本过高'],
  };

  return (
    <section className={styles.actionReport}>
      <div className={styles.actionVersion}>Analyze Action Report v1</div>

      <section className={styles.decisionCard}>
        <div className={styles.sectionHeaderRow}>
          <span className={styles.badgePrimary}>{recommendationLabel}</span>
          <span className={styles.badgeNeutral}>证据充分度 {badgeLabel(evidenceStrength)}</span>
          <span className={styles.badgeNeutral}>数据可信度 {dataConfidence}</span>
        </div>
        <div className={styles.meterRow}>
          <div className={styles.meterBlock}>
            <span>证据充分度</span>
            <div className={styles.meterTrack}><span style={{ width: meterWidth(evidenceStrength) }} /></div>
          </div>
          <div className={styles.meterBlock}>
            <span>数据可信度</span>
            <div className={styles.meterTrack}><span style={{ width: meterWidth(dataConfidence === 'high' ? 'high' : dataConfidence === 'medium' ? 'medium' : 'low') }} /></div>
          </div>
        </div>
        <div className={styles.decisionGrid}>
          <article className={styles.decisionTile}><strong>最大不确定性</strong><p>{maxUncertainty}</p></article>
          <article className={styles.decisionTile}><strong>下一步动作</strong><p>{nextStep}</p></article>
          <article className={styles.decisionTile}><strong>当前建议</strong><p>{clampText(result.recommendation?.verdict, '持续观察')}</p></article>
        </div>
      </section>

      <section className={styles.gapSection}>
        <div className={styles.sectionTitleRow}><h2>证据缺口</h2><span className={styles.badgeNeutral}>结构演示，不代表真实市场结论</span></div>
        <div className={styles.gapList}>
          {evidenceGaps.map((gap) => (
            <article key={gap.label} className={styles.gapRow}>
              <strong>{gap.label}</strong>
              <p>{gap.text}</p>
              <span>{gap.why}</span>
              <span>{gap.how}</span>
              <span>{gap.impact}</span>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.hypothesisSection}>
        <div className={styles.sectionTitleRow}><h2>关键假设</h2></div>
        <div className={styles.hypothesisGrid}>
          {hypotheses.map((item) => (
            <article key={item.title} className={styles.hypothesisCard}>
              <span className={styles.badgeNeutral}>{item.title}</span>
              <p>{item.statement}</p>
              <div className={styles.chipRow}><span className={styles.badgePrimary}>证据强度 {item.strength}</span></div>
              <div className={styles.cardMeta}><strong>验证动作</strong><span>{item.action}</span></div>
              <div className={styles.cardMeta}><strong>成功标准</strong><span>{item.standard}</span></div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.actionPackSection}>
        <div className={styles.sectionTitleRow}><h2>下一步行动包</h2></div>
        <div className={styles.actionPackGrid}>
          {actionCards.map((card) => (
            <article key={card.title} className={styles.actionCard}>
              <span className={styles.badgeNeutral}>{card.title}</span>
              <div className={styles.copyBlock}>{card.body}</div>
            </article>
          ))}

          <article className={styles.actionCard}>
            <span className={styles.badgeNeutral}>访谈问题 5 条</span>
            <ul className={styles.checklist}>
              {interviewQuestions.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </article>

          <article className={styles.actionCard}>
            <span className={styles.badgeNeutral}>搜索关键词 5 个</span>
            <div className={styles.keywordCloud}>
              {keywords.map((keyword) => <span key={keyword} className={styles.keywordChip}>{keyword}</span>)}
            </div>
          </article>

          <article className={styles.actionCard}>
            <span className={styles.badgeNeutral}>24 小时执行清单</span>
            <ul className={styles.checklist}>
              <li>Draft one landing page</li>
              <li>Collect 5 user conversations</li>
              <li>Post in one target channel</li>
              <li>Record every evidence item</li>
            </ul>
          </article>
        </div>
      </section>

      <section className={styles.judgeSection}>
        <div className={styles.sectionTitleRow}><h2>判定标准</h2></div>
        <div className={styles.judgeGrid}>
          {(['continue', 'pause', 'pivot'] as const).map((key) => (
            <article key={key} className={styles.judgeColumn}>
              <strong>{key === 'continue' ? '继续' : key === 'pause' ? '暂停' : '转向'}</strong>
              <div className={styles.judgeList}>
                {judgmentColumns[key].map((item) => <span key={item}>{item}</span>)}
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
