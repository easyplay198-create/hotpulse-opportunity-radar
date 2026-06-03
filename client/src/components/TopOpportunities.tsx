import type { HotItem } from '../types/hot';
import './TopOpportunities.css';

const VERDICT_LABEL: Record<HotItem['verdict'], string> = {
  do_now: '优先验证',
  watch: '持续观察',
  skip: '暂不进入',
};

function getPriorityReason(item: HotItem): string | null {
  return item.reasonPositive?.[0] ?? item.entryFocus?.[0] ?? null;
}

interface TopOpportunitiesProps {
  items: HotItem[];
}

export function TopOpportunities({ items }: TopOpportunitiesProps) {
  const top3 = [...items].sort((a, b) => b.valueScore - a.valueScore).slice(0, 3);

  if (top3.length === 0) {
    return null;
  }

  return (
    <div className="top-opps">
      {top3.map((item, index) => {
        const priorityReason = getPriorityReason(item);

        return (
          <article key={item.id} className={`top-opp-card${index === 0 ? ' top-opp-card--featured' : ''}`}>
            <div className="top-opp-card__head">
              <span className={`top-opp-card__rank${index === 0 ? ' top-opp-card__rank--top' : ''}`}>
                #{index + 1}
              </span>
              <div className="top-opp-card__decision">
                <span className="top-opp-card__decisionLabel">系统判断</span>
                <span className={`top-opp-card__verdict top-opp-card__verdict--${item.verdict}`}>
                  {VERDICT_LABEL[item.verdict]}
                </span>
              </div>
              <span className="top-opp-card__score">
                <strong>{item.valueScore}</strong>
                <span>机会分</span>
              </span>
            </div>
            <h3 className="top-opp-card__title">{item.title}</h3>
            <div className="top-opp-card__meta">
              {item.targetMarket && <span>目标市场 {item.targetMarket}</span>}
              {item.productType && <span>产品类型 {item.productType}</span>}
            </div>
            {priorityReason && (
              <p className="top-opp-card__priorityReason">优先原因：{priorityReason}</p>
            )}
            {(item.entryFocus?.length ?? 0) > 0 && (
              <p className="top-opp-card__focus">
                第一步：{item.entryFocus!.slice(0, 2).join(' · ')}
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}
