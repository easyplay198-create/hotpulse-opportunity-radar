import type { HotItem } from '../types/hot';
import { buildMvpValidationPlan } from '../lib/buildMvpValidationPlan';
import { buildOpportunityWedge } from '../lib/buildOpportunityWedge';
import { buildMvpValidationReportText } from '../lib/buildMvpValidationReportText';
import { readMigratedStorageItem, STORAGE_KEY_MIGRATIONS } from '../lib/storageMigration';
import { ReportHeroConclusion } from './report/ReportHeroConclusion';
import { ReportScoreSummary } from './report/ReportScoreSummary';
import { ReportRiskBars } from './report/ReportRiskBars';
import { ReportEvidenceTimeline } from './report/ReportEvidenceTimeline';
import { ReportValidationRoadmap } from './report/ReportValidationRoadmap';
import { ReportDecisionMatrix } from './report/ReportDecisionMatrix';
import { ReportExecutionCards } from './report/ReportExecutionCards';
import './report/ReportVisual.css';
import './OpportunityReportPreview.css';

interface OpportunityReportPreviewProps {
  item: HotItem;
  onBack?: (id: string) => void;
}

function getVerdictLabel(verdict: HotItem['verdict']) {
  if (verdict === 'do_now') return '优先验证';
  if (verdict === 'watch') return '持续观察';
  return '暂不进入';
}

export function OpportunityReportPreview({ item, onBack }: OpportunityReportPreviewProps) {
  const plan = buildMvpValidationPlan(item);
  const wedge = buildOpportunityWedge(item);
  const evidence = item.evidence ?? [];
  const reportText = buildMvpValidationReportText(item);
  const verificationDifficulty = Math.max(0, Math.min(100, Math.round(((item.acquisitionRisk ?? 40) + (item.complianceRisk ?? 40) + (item.aiCostRisk ?? 40)) / 3)));
  const evidenceLabel = evidence[0]?.evidenceStrength ?? 'medium';
  const riskLevel = (value: number): '低' | '中' | '高' => (value >= 70 ? '高' : value >= 40 ? '中' : '低');
  const risks = [
    { label: '支付风险', value: item.paymentRisk ?? 0, level: riskLevel(item.paymentRisk ?? 0), explanation: '用户是否愿意为该方案付费。', suggestion: '先验证付费意愿，再决定价格和订阅方式。' },
    { label: '本地化风险', value: item.localizationRisk ?? 0, level: riskLevel(item.localizationRisk ?? 0), explanation: '语言、文化或 UX 适配要求。', suggestion: '先做 1 个市场文案版本，不要一次本地化全产品。' },
    { label: '合规风险', value: item.complianceRisk ?? 0, level: riskLevel(item.complianceRisk ?? 0), explanation: '上架、支付或行业监管门槛。', suggestion: '先做合规清单，不要直接进入高监管场景。' },
    { label: '获客风险', value: item.acquisitionRisk ?? 0, level: riskLevel(item.acquisitionRisk ?? 0), explanation: '获取第一批用户的成本。', suggestion: '先用小预算测试点击和留资，不要重投放。' },
    { label: 'AI 成本风险', value: item.aiCostRisk ?? 0, level: riskLevel(item.aiCostRisk ?? 0), explanation: 'token / 推理成本是否压缩毛利。', suggestion: '先测算单次调用成本，再决定是否扩大。' },
  ];
  const roadmap = plan.sevenDayPlan.map((step, index) => ({
    stage: `阶段 ${index + 1}`,
    action: step,
    output: index === 0 ? 'Landing / demo page' : index === 1 ? '本地化文案或竞品表' : index === 2 ? '首批反馈记录' : index === 3 ? '行为数据汇总' : '进入/暂停判断',
    decision: index === 0 ? '是否完成最小表达' : index === 1 ? '是否形成可测假设' : index === 2 ? '是否拿到第一批反馈' : index === 3 ? '是否有足够转化迹象' : '继续、调整或暂停',
  }));
  const execCards = [
    { title: '支付 / 订阅验证', description: '先用 Stripe、Paddle 或本地支付方案测试付费意向。' },
    { title: '本地化文案测试', description: '先翻译 1 个 landing page，不要直接本地化全产品。' },
    { title: '小预算投放验证', description: '先做 $50-$200 小预算点击测试，检查留资和反馈。' },
  ];
  const handleCopy = async () => { try { await navigator.clipboard.writeText(reportText); } catch (error) { console.warn('复制验证方案失败', error); } };
  const handleBack = () => {
    const savedScroll = Number(readMigratedStorageItem(sessionStorage, STORAGE_KEY_MIGRATIONS.returnScrollY) || '0');
    const savedPath = readMigratedStorageItem(sessionStorage, STORAGE_KEY_MIGRATIONS.returnPath) || '/';
    const savedItemId = readMigratedStorageItem(sessionStorage, STORAGE_KEY_MIGRATIONS.returnItemId);
    if (window.history.length > 1) window.history.back(); else if (onBack) onBack(item.id); else window.location.href = savedPath;
    window.setTimeout(() => {
      window.scrollTo(0, savedScroll || 0);
      if (savedItemId) document.getElementById(`opportunity-${savedItemId}`)?.scrollIntoView({ block: 'center' });
    }, 0);
  };

  return (
    <div className="report-preview">
      <div className="report-preview__topbar">
        <button type="button" className="report-preview__backButton" onClick={handleBack}>返回商机雷达</button>
      </div>

      <ReportHeroConclusion
        title={item.title}
        verdictLabel={getVerdictLabel(item.verdict)}
        targetMarket={item.targetMarket ?? 'Global'}
        productType={item.productType ?? '未注明'}
        opportunityScore={item.valueScore ?? 0}
        wedgeScore={Math.round(wedge.wedgeScore)}
        conclusion={wedge.displaySummary}
        minimumAction={plan.validationGoal}
        onCopy={handleCopy}
        onBack={handleBack}
      />

      <ReportScoreSummary
        opportunityScore={item.valueScore ?? 0}
        wedgeScore={Math.round(wedge.wedgeScore)}
        evidenceLabel={evidenceLabel}
        validationDifficulty={verificationDifficulty}
      />

      <ReportRiskBars risks={risks} />
      <ReportEvidenceTimeline evidence={evidence} />
      <ReportValidationRoadmap steps={roadmap} />
      <ReportDecisionMatrix competitionPressure={item.competitionRisk ?? 0} wedgeScore={Math.round(wedge.wedgeScore)} />
      <ReportExecutionCards items={execCards} />
    </div>
  );
}
