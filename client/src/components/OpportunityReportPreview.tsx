import type { HotItem } from '../types/hot';
import { buildMvpValidationPlan } from '../lib/buildMvpValidationPlan';
import { buildOpportunityWedge } from '../lib/buildOpportunityWedge';
import { buildMvpValidationReportText } from '../lib/buildMvpValidationReportText';
import './OpportunityReportPreview.css';

interface OpportunityReportPreviewProps {
  item: HotItem;
  onBack: (id: string) => void;
}

function getVerdictLabel(verdict: HotItem['verdict']) {
  if (verdict === 'do_now') return '优先验证';
  if (verdict === 'watch') return '持续观察';
  return '暂不进入';
}

export function OpportunityReportPreview({ item, onBack }: OpportunityReportPreviewProps) {
  const plan = buildMvpValidationPlan(item);
  const wedge = buildOpportunityWedge(item);
  const evidence = item.evidence?.slice(0, 2) ?? [];
  const reportText = buildMvpValidationReportText(item);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(reportText);
    } catch (error) {
      console.warn('复制验证方案失败', error);
    }
  };

  const handleBack = () => {
    sessionStorage.setItem('returnToOpportunityId', item.id);
    sessionStorage.setItem('returnScrollY', String(window.scrollY));
    onBack(item.id);
  };

  return (
    <div className="report-preview">
      <div className="report-preview__topbar">
        <button type="button" className="report-preview__backButton" onClick={handleBack}>
          返回机会雷达
        </button>
      </div>

      <section className="report-preview__hero">
        <p className="report-preview__eyebrow">MVP 出海验证快评</p>
        <h1 className="report-preview__title">{item.title}</h1>
        <div className="report-preview__meta">
          <span>目标市场：{item.targetMarket ?? '暂无明确数据'}</span>
          <span>产品类型：{item.productType ?? '暂无明确数据'}</span>
          <span>机会分：{item.valueScore ?? 0}</span>
          <span>当前建议：{getVerdictLabel(item.verdict)}</span>
        </div>
        <button type="button" className="report-preview__copyButton" onClick={handleCopy}>
          复制验证方案
        </button>
      </section>

      <section className="report-preview__grid">
        <article className="report-preview__card report-preview__card--wedge">
          <h2>小团队可切入判断</h2>
          <div className="report-preview__wedgeTag">{wedge.opportunityRole === 'benchmark_competitor' ? '标杆竞品' : wedge.opportunityRole === 'wedge_opportunity' ? '可切入机会' : wedge.opportunityRole === 'avoid_direct_entry' ? '暂不建议进入' : '市场信号'}</div>
          <p className="report-preview__wedgeSummary">{wedge.displaySummary}</p>
          <div className="report-preview__bar"><div className="report-preview__barFill" style={{ width: `${Math.round(wedge.wedgeScore)}%` }} /></div>
          <div className="report-preview__section"><strong>小团队可切入度：</strong>{Math.round(wedge.wedgeScore)}</div>
          <div className="report-preview__section">
            <strong>痛点洞察：</strong>
            <ul className="report-preview__bulletList">
              {wedge.painPointInsights.slice(0, 3).map((text) => <li key={text}>{text}</li>)}
            </ul>
          </div>
          <div className="report-preview__section">
            <strong>切入建议：</strong>
            <ul className="report-preview__bulletList">
              {wedge.wedgeSuggestions.slice(0, 3).map((text) => <li key={text}>{text}</li>)}
            </ul>
          </div>
        </article>

        <article className="report-preview__card">
          <h2>真实信号</h2>
          {evidence.length === 0 ? (
            <p>暂无明确数据</p>
          ) : (
            <ul className="report-preview__list">
              {evidence.map((ev) => (
                <li key={ev.url} className="report-preview__listItem">
                  <div>来源：{ev.source ?? '暂无明确数据'}</div>
                  <div>类型：{ev.type ?? '暂无明确数据'}</div>
                  <div>证据强度：{ev.evidenceStrength ?? '暂无明确数据'}</div>
                  <div>时间：{ev.retrievedAt ?? '暂无明确数据'}</div>
                  <a href={ev.url} target="_blank" rel="noreferrer">原始链接</a>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="report-preview__card">
          <h2>进入风险</h2>
          <ul className="report-preview__facts">
            <li>支付适配：{item.paymentFit ?? '暂无明确数据'}</li>
            <li>支付风险：{item.paymentRisk ?? '暂无明确数据'}</li>
            <li>本地化风险：{item.localizationRisk ?? '暂无明确数据'}</li>
            <li>合规风险：{item.complianceRisk ?? '暂无明确数据'}</li>
            <li>获客风险：{item.acquisitionRisk ?? '暂无明确数据'}</li>
            <li>AI 成本风险：{item.aiCostRisk ?? '暂无明确数据'}</li>
            <li>市场进入备注：{item.marketEntryNotes?.slice(0, 2).join(' · ') ?? '暂无明确数据'}</li>
          </ul>
        </article>

        <article className="report-preview__card">
          <h2>MVP 验证计划</h2>
          <div className="report-preview__section"><strong>验证目标：</strong>{plan.validationGoal}</div>
          <div className="report-preview__section"><strong>建议渠道：</strong>{plan.suggestedChannel}</div>
          <div className="report-preview__section"><strong>预算区间：</strong>{plan.budgetRange}</div>
          <div className="report-preview__section">
            <strong>7 天计划：</strong>
            <ol className="report-preview__list report-preview__list--ordered">
              {plan.sevenDayPlan.map((step) => <li key={step}>{step}</li>)}
            </ol>
          </div>
          <div className="report-preview__section"><strong>成功指标：</strong>{plan.successMetric}</div>
          <div className="report-preview__section"><strong>停止条件：</strong>{plan.stopCondition}</div>
        </article>

        <article className="report-preview__card report-preview__card--note">
          <p>真实信号仅代表可追溯线索，不等于完整市场结论。建议先做小样本验证，再决定是否投入开发、投放或上架。</p>
        </article>
      </section>
    </div>
  );
}
