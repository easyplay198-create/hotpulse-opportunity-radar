import type { HotItem } from '../../types/hot';
import './VisualPrimitives.css';

type RiskInput = { label: string; value: number };

function normalizeRisks(input: { item?: HotItem; risks?: RiskInput[] }): RiskInput[] {
  if (input.risks) return input.risks;
  const item = input.item;
  return [
    { label: '支付', value: item?.paymentRisk ?? 0 },
    { label: '本地化', value: item?.localizationRisk ?? 0 },
    { label: '合规', value: item?.complianceRisk ?? 0 },
    { label: '获客', value: item?.acquisitionRisk ?? 0 },
    { label: 'AI 成本', value: item?.aiCostRisk ?? 0 },
  ];
}

export function RiskMiniBars(props: { item?: HotItem; risks?: RiskInput[] }) {
  const risks = normalizeRisks(props);
  return (
    <div className="riskMiniBars">
      {risks.map((risk) => (
        <div className="riskMiniBars__row" key={risk.label}>
          <span>{risk.label}</span>
          <div className="riskMiniBars__track"><span style={{ width: `${Math.max(0, Math.min(100, risk.value))}%`, background: risk.value >= 70 ? '#dc2626' : risk.value >= 40 ? '#f59e0b' : '#16a34a' }} /></div>
          <strong>{risk.value}</strong>
        </div>
      ))}
    </div>
  );
}
