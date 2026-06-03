import type { SmallTeamOpportunity } from '../lib/buildSmallTeamOpportunities';
import './SmallTeamOpportunityList.css';

interface SmallTeamOpportunityListProps {
  opportunities: SmallTeamOpportunity[];
  source: 'real' | 'mock' | 'fallback';
}

export function SmallTeamOpportunityList({ opportunities, source }: SmallTeamOpportunityListProps) {
  if (opportunities.length === 0) {
    return <p className="small-opportunity-list__empty">暂无可验证机会假设</p>;
  }

  const sourceParam = source === 'real' ? 'real' : 'mock';

  return (
    <div className="small-opportunity-list">
      {opportunities.map((opportunity, index) => (
        <article key={opportunity.id} className="small-opportunity-card">
          <div className="small-opportunity-card__top">
            <span className="small-opportunity-card__rank">#{index + 1}</span>
            <span className="small-opportunity-card__score">小团队可切入度 {opportunity.wedgeScore}</span>
          </div>
          <h3 className="small-opportunity-card__title">{opportunity.title}</h3>
          <div className="small-opportunity-card__meta">
            <span>目标市场：{opportunity.targetMarket}</span>
            <span>目标用户：{opportunity.targetCustomer}</span>
          </div>
          <p className="small-opportunity-card__line"><strong>推断痛点：</strong>{opportunity.painPoint}</p>
          <p className="small-opportunity-card__line"><strong>可切入缺口：</strong>{opportunity.wedge}</p>
          <p className="small-opportunity-card__line"><strong>验证角度：</strong>{opportunity.validationAngle}</p>
          <div className="small-opportunity-card__signals">
            <span>证据来源：{opportunity.evidenceSources.join(' / ')}</span>
            <span>标杆竞品：{opportunity.benchmarkNames.length > 0 ? opportunity.benchmarkNames.join(' / ') : '暂无明确标杆'}</span>
          </div>
          <p className="small-opportunity-card__risk">{opportunity.riskSummary}</p>
          <a
            className="small-opportunity-card__button"
            href={`?source=${sourceParam}&report=${opportunity.sourceItemId}`}
          >
            查看关联验证报告
          </a>
        </article>
      ))}
    </div>
  );
}
