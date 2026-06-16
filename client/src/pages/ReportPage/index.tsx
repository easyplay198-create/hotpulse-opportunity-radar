import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { TopNav } from '../../components/layout/TopNav';
import { PagePurpose } from '../../components/visual/PagePurpose';
import { cleanAnalyzePresentationCopy, sourceTypeLabel } from '../../components/analyze/analyzePresentation';
import { deleteReport, getSavedReport, listSavedReports, type SavedReportV1 } from '../../lib/reportStorage';
import styles from './ReportPage.module.css';

type EvidenceView = {
  title: string;
  source: string;
  sourceType: string;
  strength: string;
  summary: string;
  url?: string;
};

type ActionStageView = {
  label: string;
  title: string;
  steps: string[];
  successMetric?: string;
  stopCondition?: string;
};

const MARKET_FALLBACK = '市场待确认';
const PRODUCT_FALLBACK = '产品类型待确认';
const CONFIDENCE_FALLBACK = '置信度待确认';

function formatDate(value?: string) {
  if (!value) return '时间待确认';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '时间待确认';
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function text(value: unknown, fallback = '') {
  return cleanAnalyzePresentationCopy(value, fallback);
}

function numberText(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? String(Math.round(value)) : '待确认';
}

function strengthLabel(value: unknown) {
  const labels: Record<string, string> = {
    high: '强证据',
    medium: '中等证据',
    low: '弱证据',
    missing: '证据待补充',
  };
  return labels[String(value || '')] ?? text(value, '证据强度待确认');
}

function reportTitle(report: SavedReportV1) {
  return text(report.summary.title, text(report.input.projectDescription, '未命名验证报告'));
}

function reportMarket(report: SavedReportV1) {
  return text(report.summary.targetMarket || report.input.targetMarket, MARKET_FALLBACK);
}

function reportProductType(report: SavedReportV1) {
  return text(report.summary.productType || report.input.productType, PRODUCT_FALLBACK);
}

function reportConfidence(report: SavedReportV1) {
  return text(report.summary.confidence, CONFIDENCE_FALLBACK);
}

function reportVerdict(report: SavedReportV1) {
  return text(report.summary.verdict, '持续观察');
}

function getVerdict(report: SavedReportV1) {
  return isRecord(report.snapshot.verdict) ? report.snapshot.verdict : {};
}

function getActionPlan(report: SavedReportV1) {
  return isRecord(report.snapshot.actionPlan) ? report.snapshot.actionPlan : {};
}

function getAssumptions(report: SavedReportV1) {
  return isRecord(report.snapshot.assumptions) ? report.snapshot.assumptions : {};
}

function getFirstPartyKnowledge(report: SavedReportV1) {
  return isRecord(report.snapshot.firstPartyKnowledge) ? report.snapshot.firstPartyKnowledge : {};
}

function getHypotheses(report: SavedReportV1) {
  return Array.isArray(report.snapshot.hypotheses) ? report.snapshot.hypotheses : [];
}

function getEvidence(report: SavedReportV1): EvidenceView[] {
  if (Array.isArray(report.snapshot.evidence) && report.snapshot.evidence.length > 0) {
    return report.snapshot.evidence
      .filter(isRecord)
      .map((item, index) => ({
        title: text(item.title, `证据 ${index + 1}`),
        source: text(item.source, '来源待确认'),
        sourceType: sourceTypeLabel(item.sourceType),
        strength: strengthLabel(item.strength),
        summary: text(item.summary, '暂无可展示证据'),
        url: typeof item.url === 'string' ? item.url : undefined,
      }));
  }

  return (report.snapshot.evidenceBoard ?? []).map((item, index) => ({
    title: text(item.title, `证据 ${index + 1}`),
    source: text(item.source, '来源待确认'),
    sourceType: sourceTypeLabel(item.sourceType),
    strength: strengthLabel(item.evidenceStrength),
    summary: text(item.supports || item.note, '暂无可展示证据'),
    url: item.url,
  }));
}

function sourceSummary(evidence: EvidenceView[]) {
  const sources = Array.from(new Set(evidence.map((item) => item.source).filter(Boolean)));
  return sources.length ? sources.slice(0, 4).join(' / ') : '来源待确认';
}

function assumptionLabel(key: string) {
  const labels: Record<string, string> = {
    productType: '产品类型',
    targetMarket: '目标市场',
    targetUser: '目标用户',
    audience: '目标用户',
    painPoint: '核心痛点',
    businessModel: '商业模式',
    acquisitionChannel: '获客渠道',
    acquisitionChannelDetail: '获客渠道细节',
    platformForm: '产品形态',
  };
  return labels[key] ?? cleanAnalyzePresentationCopy(key, key);
}

function knowledgeLabel(key: string) {
  const labels: Record<string, string> = {
    paymentFit: '支付适配',
    localizationCost: '本地化成本',
    complianceRisk: '合规风险',
    aiCostRisk: 'AI 成本',
    acquisitionRisk: '获客风险',
  };
  return labels[key] ?? cleanAnalyzePresentationCopy(key, key);
}

function knowledgeLevel(value: unknown) {
  const labels: Record<string, string> = {
    good: '条件较好',
    limited: '需要验证',
    blocked: '存在阻碍',
    unknown: '待确认',
  };
  return labels[String(value || '')] ?? '待确认';
}

function stageFromRecord(label: string, value: unknown): ActionStageView | null {
  if (!isRecord(value)) return null;
  const steps = Array.isArray(value.steps)
    ? value.steps.map((item) => text(item)).filter(Boolean)
    : Array.isArray(value.actions)
      ? value.actions.map((item) => text(item)).filter(Boolean)
      : [];
  return {
    label,
    title: text(value.title || value.name || value.goal || value.purpose, `${label} 行动`),
    steps,
    successMetric: text(value.successMetric || value.passCondition),
    stopCondition: text(value.stopCondition),
  };
}

function getActionStages(report: SavedReportV1): ActionStageView[] {
  const plan = getActionPlan(report);
  const stages = [
    stageFromRecord('24 小时', plan.twentyFourHours),
    stageFromRecord('7 天', plan.sevenDays),
    stageFromRecord('停止条件', plan.stopGate),
  ].filter(Boolean) as ActionStageView[];
  if (stages.length > 0) return stages;

  const mvpStages = report.snapshot.mvpValidationPlan ?? [];
  if (mvpStages.length > 0) {
    return mvpStages.slice(0, 3).map((item) => ({
      label: item.day,
      title: item.goal,
      steps: [item.action],
      successMetric: item.successMetric,
      stopCondition: item.stopCondition,
    }));
  }

  return (report.snapshot.sevenDayPlan ?? []).slice(0, 3).map((item, index) => ({
    label: index === 0 ? '24 小时' : '7 天',
    title: item,
    steps: [item],
  }));
}

function buildAnalyzeHref(report: SavedReportV1) {
  const description = report.input.projectDescription || report.summary.title;
  const targetMarket = reportMarket(report);
  const productType = reportProductType(report);
  const queryParts = [description];
  if (targetMarket !== MARKET_FALLBACK && !description.includes(targetMarket)) {
    queryParts.push(`目标市场：${targetMarket}`);
  }
  if (productType !== PRODUCT_FALLBACK && !description.includes(productType)) {
    queryParts.push(`产品类型：${productType}`);
  }
  const params = new URLSearchParams({
    source: report.snapshot.source === 'mock' || report.snapshot.source === 'fallback' ? report.snapshot.source : 'real',
    q: queryParts.join('，'),
  });
  if (targetMarket !== MARKET_FALLBACK) params.set('targetMarket', targetMarket);
  if (productType !== PRODUCT_FALLBACK) params.set('productType', productType);
  return `/analyze?${params.toString()}`;
}

function DeleteAction({
  reportId,
  pendingId,
  onAsk,
  onCancel,
  onConfirm,
}: {
  reportId: string;
  pendingId: string | null;
  onAsk: (id: string) => void;
  onCancel: () => void;
  onConfirm: (id: string) => void;
}) {
  if (pendingId !== reportId) {
    return <button type="button" className={styles.dangerButton} onClick={() => onAsk(reportId)}>删除</button>;
  }
  return (
    <span className={styles.inlineConfirm}>
      <span>确认删除？</span>
      <button type="button" onClick={() => onConfirm(reportId)}>确认</button>
      <button type="button" onClick={onCancel}>取消</button>
    </span>
  );
}

function EmptyState() {
  return (
    <section className={styles.emptyState}>
      <span className={styles.kicker}>Local Reports</span>
      <h2>尚未保存验证报告</h2>
      <p>完成一次项目验证后，点击“保存到我的报告”，即可在当前浏览器中回看结论和行动计划。</p>
      <div className={styles.actionRow}>
        <a className={styles.primaryButton} href="/analyze?source=real">开始验证自己的项目</a>
        <a className={styles.secondaryButton} href="/opportunities?source=real">去机会雷达选择机会</a>
      </div>
    </section>
  );
}

function ReportList({
  reports,
  pendingDeleteId,
  deleteError,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  reports: SavedReportV1[];
  pendingDeleteId: string | null;
  deleteError: string | null;
  onAskDelete: (id: string) => void;
  onCancelDelete: () => void;
  onConfirmDelete: (id: string) => void;
}) {
  if (reports.length === 0) return <EmptyState />;
  return (
    <section className={styles.reportGrid} aria-label="已保存报告">
      {deleteError ? <div className={styles.inlineError}>{deleteError}</div> : null}
      {reports.map((report) => (
        <article key={report.id} className={styles.reportCard}>
          <div className={styles.cardTopline}>
            <span>{formatDate(report.updatedAt)}</span>
            <strong>{reportVerdict(report)}</strong>
          </div>
          <h2>{reportTitle(report)}</h2>
          <p>{text(report.input.projectDescription, '暂无项目描述')}</p>
          <div className={styles.metaGrid}>
            <span>{reportMarket(report)}</span>
            <span>{reportProductType(report)}</span>
            <span>置信度：{reportConfidence(report)}</span>
            <span>证据：{report.summary.evidenceCount}</span>
            <span>综合分：{numberText(report.summary.score)}</span>
          </div>
          <div className={styles.cardActions}>
            <a className={styles.primaryButton} href={`/report?id=${encodeURIComponent(report.id)}`}>查看报告</a>
            <a className={styles.secondaryButton} href={buildAnalyzeHref(report)}>重新验证</a>
            <DeleteAction
              reportId={report.id}
              pendingId={pendingDeleteId}
              onAsk={onAskDelete}
              onCancel={onCancelDelete}
              onConfirm={onConfirmDelete}
            />
          </div>
        </article>
      ))}
    </section>
  );
}

function NotFoundState() {
  return (
    <section className={styles.emptyState}>
      <span className={styles.kicker}>Report Missing</span>
      <h2>未找到这份报告</h2>
      <p>该报告可能已被删除，或当前浏览器中没有对应的本地记录。</p>
      <div className={styles.actionRow}>
        <a className={styles.primaryButton} href="/report">返回“我的报告”</a>
        <a className={styles.secondaryButton} href="/analyze?source=real">开始新的验证</a>
      </div>
    </section>
  );
}

function ReportDetail({
  report,
  pendingDeleteId,
  deleteError,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  report: SavedReportV1;
  pendingDeleteId: string | null;
  deleteError: string | null;
  onAskDelete: (id: string) => void;
  onCancelDelete: () => void;
  onConfirmDelete: (id: string) => void;
}) {
  const verdict = getVerdict(report);
  const evidence = getEvidence(report);
  const assumptions = Object.entries(getAssumptions(report)).filter(([, value]) => text(value));
  const hypotheses = getHypotheses(report).filter(isRecord);
  const knowledge = Object.entries(getFirstPartyKnowledge(report)).filter(([, value]) => isRecord(value));
  const actionStages = getActionStages(report);
  const conclusion =
    text(report.snapshot.llmDraftNarrative?.verdictNarrative) ||
    text(verdict.reason) ||
    text(report.snapshot.recommendation?.summary, '当前结论需要结合证据覆盖继续验证。');
  const nextMove = text(verdict.nextMove || report.snapshot.recommendation?.nextStep, '补充真实用户样本和市场证据后再判断');
  const mainRisk = text(verdict.mainRisk || report.snapshot.riskBottlenecks?.[0]?.title, '主要风险待确认');
  const positiveReason = text(report.snapshot.recommendation?.summary || report.snapshot.llmDraftNarrative?.userFacingSummary, '暂无可展示证据');

  return (
    <div className={styles.detailStack}>
      <section className={styles.verdictHero}>
        <div>
          <span className={styles.kicker}>Final Verdict</span>
          <h1>{reportVerdict(report)}</h1>
          <p>{conclusion}</p>
        </div>
        <div className={styles.verdictMetrics}>
          <article>
            <span>综合分</span>
            <strong>{numberText(report.summary.score)}</strong>
          </article>
          <article>
            <span>置信度</span>
            <strong>{reportConfidence(report)}</strong>
          </article>
          <article>
            <span>当前建议</span>
            <strong>{nextMove}</strong>
          </article>
        </div>
      </section>

      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div>
            <span className={styles.kicker}>Why This Verdict</span>
            <h2>为什么得出该结论</h2>
          </div>
          <span>{report.summary.evidenceCount} 条证据</span>
        </div>
        <div className={styles.reasonGrid}>
          <article>
            <strong>主要正向依据</strong>
            <p>{positiveReason}</p>
          </article>
          <article>
            <strong>主要风险</strong>
            <p>{mainRisk}</p>
          </article>
          <article>
            <strong>证据来源</strong>
            <p>{sourceSummary(evidence)}</p>
          </article>
        </div>
        {evidence.length > 0 ? (
          <div className={styles.evidenceList}>
            {evidence.map((item, index) => (
              <article key={`${item.title}-${index}`}>
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.source} · {item.sourceType} · {item.strength}</span>
                </div>
                <p>{item.summary}</p>
                {item.url ? <a href={item.url} target="_blank" rel="noreferrer">打开原始来源</a> : null}
              </article>
            ))}
          </div>
        ) : (
          <p className={styles.mutedText}>暂无可展示证据</p>
        )}
      </section>

      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div>
            <span className={styles.kicker}>What To Validate</span>
            <h2>还需要继续验证什么</h2>
          </div>
        </div>
        <div className={styles.assumptionGrid}>
          {assumptions.length > 0 ? assumptions.map(([key, value]) => (
            <article key={key}>
              <span>{assumptionLabel(key)}</span>
              <strong>{text(value, '待确认')}</strong>
            </article>
          )) : <p className={styles.mutedText}>暂无可展示假设</p>}
        </div>
        {hypotheses.length > 0 ? (
          <div className={styles.hypothesisList}>
            {hypotheses.map((item, index) => (
              <article key={`${text(item.id, String(index))}-${index}`}>
                <strong>{text(item.title || item.statement || item.description, `假设 ${index + 1}`)}</strong>
                <p>{text(item.description || item.statement || item.whyItMatters, '待验证')}</p>
              </article>
            ))}
          </div>
        ) : null}
        {knowledge.length > 0 ? (
          <div className={styles.knowledgeGrid}>
            {knowledge.map(([key, rawValue]) => {
              const value = rawValue as Record<string, unknown>;
              return (
                <article key={key}>
                  <span>{knowledgeLabel(key)}</span>
                  <strong>{knowledgeLevel(value.level)}</strong>
                  <p>{text(value.summary, '暂无该维度的约束判断。')}</p>
                </article>
              );
            })}
          </div>
        ) : null}
      </section>

      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div>
            <span className={styles.kicker}>Next Step</span>
            <h2>下一步行动与停止条件</h2>
          </div>
        </div>
        <div className={styles.actionGrid}>
          {actionStages.length > 0 ? actionStages.map((stage) => (
            <article key={stage.label}>
              <span>{stage.label}</span>
              <strong>{stage.title}</strong>
              {stage.steps.length > 0 ? (
                <ul>
                  {stage.steps.slice(0, 4).map((item) => <li key={item}>{item}</li>)}
                </ul>
              ) : null}
              {stage.successMetric ? <p>成功标准：{stage.successMetric}</p> : null}
              {stage.stopCondition ? <p>停止条件：{stage.stopCondition}</p> : null}
            </article>
          )) : <p className={styles.mutedText}>暂无可展示行动计划</p>}
        </div>
        {deleteError ? <p className={styles.inlineError}>{deleteError}</p> : null}
        <div className={styles.detailActions}>
          <a className={styles.primaryButton} href={buildAnalyzeHref(report)}>重新验证</a>
          <a className={styles.secondaryButton} href="/report">返回我的报告</a>
          <DeleteAction
            reportId={report.id}
            pendingId={pendingDeleteId}
            onAsk={onAskDelete}
            onCancel={onCancelDelete}
            onConfirm={onConfirmDelete}
          />
        </div>
      </section>
    </div>
  );
}

export function ReportPage() {
  const searchParams = new URLSearchParams(window.location.search);
  const reportId = searchParams.get('id');
  const [reports, setReports] = useState<SavedReportV1[]>(() => listSavedReports());
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const selectedReport = useMemo(
    () => reportId ? reports.find((report) => report.id === reportId) ?? getSavedReport(reportId) : null,
    [reportId, reports],
  );

  useEffect(() => {
    setReports(listSavedReports());
  }, [reportId]);

  const handleConfirmDelete = (id: string) => {
    setDeleteError(null);
    const ok = deleteReport(id);
    if (!ok) {
      setDeleteError('删除失败，请确认当前浏览器允许写入本地存储。');
      return;
    }
    setPendingDeleteId(null);
    const nextReports = listSavedReports();
    setReports(nextReports);
    if (reportId === id) {
      window.history.replaceState(null, '', '/report');
    }
  };

  return (
    <AppShell>
      <div className={styles.page}>
        <TopNav />
        <PagePurpose
          title="我的报告"
          description="集中查看当前浏览器中保存的验证报告与后续行动。"
          meta={<span>这些报告仅保存在当前浏览器，清除浏览器数据后可能无法恢复。</span>}
        />
        <div className={styles.actionRow}>
          <a className={styles.primaryButton} href="/analyze?source=real">开始新的验证</a>
          <a className={styles.secondaryButton} href="/opportunities?source=real">去机会雷达选择方向</a>
        </div>
        {reportId ? (
          selectedReport ? (
            <ReportDetail
              report={selectedReport}
              pendingDeleteId={pendingDeleteId}
              deleteError={deleteError}
              onAskDelete={setPendingDeleteId}
              onCancelDelete={() => setPendingDeleteId(null)}
              onConfirmDelete={handleConfirmDelete}
            />
          ) : (
            <NotFoundState />
          )
        ) : (
          <ReportList
            reports={reports}
            pendingDeleteId={pendingDeleteId}
            deleteError={deleteError}
            onAskDelete={setPendingDeleteId}
            onCancelDelete={() => setPendingDeleteId(null)}
            onConfirmDelete={handleConfirmDelete}
          />
        )}
      </div>
    </AppShell>
  );
}
