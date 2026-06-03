import type { DiscoverableOpportunity } from '../lib/buildDiscoverableOpportunities';
import './DiscoverableOpportunityList.css';

interface DiscoverableOpportunityListProps {
  opportunities: DiscoverableOpportunity[];
  source: 'real' | 'mock' | 'fallback';
}

export function DiscoverableOpportunityList({ opportunities, source }: DiscoverableOpportunityListProps) {
  if (opportunities.length === 0) {
    return (
      <p className="discoverable-list__empty">
        当前真实信号不足以生成可追溯机会，请查看市场信号榜或切换 source=real。
      </p>
    );
  }

  const sourceParam = source === 'real' ? 'real' : 'mock';

  return (
    <div className="discoverable-list">
      <p className="discoverable-list__meta">当前生成 {opportunities.length} 条可追溯机会</p>
      {opportunities.map((opportunity) => (
        <article key={opportunity.id} className="discoverable-card">
          <div className="discoverable-card__top">
            <span className="discoverable-card__trend">{opportunity.trendTag}</span>
            <span className="discoverable-card__score">发现分 {opportunity.discoveryScore}</span>
          </div>
          <h3 className="discoverable-card__title">{opportunity.title}</h3>
          <div className="discoverable-card__meta">
            <span>目标市场：{opportunity.targetMarket}</span>
            <span>目标用户：{opportunity.targetUser}</span>
          </div>
          <p><strong>推断痛点：</strong>{opportunity.inferredPainPoint}</p>
          <p><strong>可切入缺口：</strong>{opportunity.opportunityGap}</p>
          <p><strong>为什么现在：</strong>{opportunity.whyNow}</p>
          <p><strong>验证假设：</strong>{opportunity.validationHypothesis}</p>
          <div className="discoverable-card__evidence">
            <span>证据链 {opportunity.evidenceChain.length} 条</span>
            <span>
              {opportunity.evidenceChain.map((item) => item.source).join(' / ')}
            </span>
          </div>
          <p className="discoverable-card__benchmarks">
            标杆竞品：{opportunity.benchmarkNames.length > 0 ? opportunity.benchmarkNames.join(' / ') : '暂无明确标杆'}
          </p>
          <a className="discoverable-card__button" href={`?source=${sourceParam}&report=${opportunity.sourceItemId}`}>
            查看关联验证报告
          </a>
        </article>
      ))}
    </div>
  );
}
