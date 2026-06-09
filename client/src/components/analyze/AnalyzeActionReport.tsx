import type { AnalyzeResponse } from '../../types/analyze';
import { buildAnalyzeDecisionVM, type AnalyzeDecisionVM } from '../../viewModels';
import { ActionPlaybook, DecisionBar, EvidenceTimeline, RiskMatrix } from '../ui';
import styles from '../../pages/AnalyzePage/AnalyzePage.module.css';

type SourceType = 'real' | 'mock' | 'fallback';

function sourceLabel(source: SourceType) {
  if (source === 'real') return '真实数据';
  if (source === 'fallback') return '缓存数据';
  return '示例数据';
}

function compactList(items: string[] | undefined, fallback: string[]): string[] {
  const clean = Array.isArray(items)
    ? items.map((item) => String(item || '').trim()).filter(Boolean)
    : [];

  return clean.length > 0 ? clean.slice(0, 3) : fallback.slice(0, 3);
}

function buildSafeDecision(vm: AnalyzeDecisionVM) {
  const evidenceCount = Array.isArray(vm.evidenceTimeline) ? vm.evidenceTimeline.length : 0;
  const signalCount = Array.isArray(vm.marketSignals) ? vm.marketSignals.length : 0;
  const lowSignalResult = evidenceCount === 0 && signalCount === 0 && vm.decision.score <= 0;

  if (!lowSignalResult) return vm.decision;

  return {
    ...vm.decision,
    verdict: 'insufficient_evidence' as const,
    verdictLabel: '证据不足',
    scoreBand: 'watch' as const,
    summary: '当前信号不足，建议先补充目标市场、用户场景和竞品方向。',
    nextAction: '补充目标市场、目标用户和竞品方向后重新验证。',
  };
}

function metricLabel(count: number, unit: string) {
  return `${count} ${unit}`;
}

export function AnalyzeActionReport({
  result,
  source,
}: {
  result: AnalyzeResponse | null;
  source: SourceType;
}) {
  if (!result) return null;

  const vm = buildAnalyzeDecisionVM(result);
  const decision = buildSafeDecision(vm);

  const evidenceTimeline = Array.isArray(vm.evidenceTimeline) ? vm.evidenceTimeline.slice(0, 5) : [];
  const riskItems = Array.isArray(vm.riskItems) ? vm.riskItems.slice(0, 6) : [];
  const actionPlaybook = Array.isArray(vm.actionPlaybook) ? vm.actionPlaybook.slice(0, 5) : [];
  const marketSignals = Array.isArray(vm.marketSignals) ? vm.marketSignals.slice(0, 3) : [];

  const overview = compactList(vm.opportunityOverview, [
    decision.summary,
    `数据来源：${sourceLabel(source)}`,
    decision.nextAction,
  ]);

  const openQuestions = compactList(vm.openQuestions, ['当前仍缺少真实用户反馈。', '目标市场和付费场景需要继续确认。', '需要补充可追溯证据。']);
  const assumptions = compactList(vm.assumptions, ['目标用户存在明确痛点。', '当前方案存在可验证切口。', '小样本验证可以降低误判。']);
  const traceSteps = compactList(vm.traceSteps, ['理解输入方向', '匹配市场信号', '生成风险和行动建议']);

  return (
    <section className={styles.decisionCanvas} aria-label="Analyze decision canvas">
      <div className={styles.canvasHeader}>
        <div>
          <span className={styles.canvasEyebrow}>Decision Canvas</span>
          <h2 className={styles.canvasTitle}>验证结果</h2>
        </div>
        <span className={styles.canvasSource}>{sourceLabel(source)}</span>
      </div>

      <DecisionBar decision={decision} risks={riskItems} />

      <div className={styles.canvasGrid}>
        <main className={styles.canvasMain}>
          <section className={styles.canvasPanel}>
            <div className={styles.panelHeader}>
              <span className={styles.panelKicker}>Opportunity</span>
              <h3>机会快照</h3>
            </div>
            <ul className={styles.overviewList}>
              {overview.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className={styles.canvasPanel}>
            <div className={styles.panelHeader}>
              <span className={styles.panelKicker}>Signals</span>
              <h3>市场信号摘要</h3>
            </div>
            <div className={styles.metricGrid}>
              <div className={styles.metricTile}>
                <strong>{metricLabel(evidenceTimeline.length, '条')}</strong>
                <span>Evidence</span>
              </div>
              <div className={styles.metricTile}>
                <strong>{decision.confidenceLabel}</strong>
                <span>Confidence</span>
              </div>
              <div className={styles.metricTile}>
                <strong>{metricLabel(marketSignals.length, '个')}</strong>
                <span>Signals</span>
              </div>
            </div>
          </section>

          <EvidenceTimeline items={evidenceTimeline} maxItems={5} />
        </main>

        <aside className={styles.canvasSide}>
          <RiskMatrix risks={riskItems} />
          <ActionPlaybook actions={actionPlaybook} maxItems={5} />
        </aside>
      </div>

      <section className={styles.lowPriorityDrawer} aria-label="低权重补充信息">
        <details>
          <summary>需要确认的问题</summary>
          <ul>
            {openQuestions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </details>

        <details>
          <summary>关键假设</summary>
          <ul>
            {assumptions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </details>

        <details>
          <summary>分析过程</summary>
          <ul>
            {traceSteps.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </details>
      </section>
    </section>
  );
}
