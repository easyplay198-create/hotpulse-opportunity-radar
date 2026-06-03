import type { DiscoverableOpportunity } from '../lib/buildDiscoverableOpportunities';
import './TopOpportunityBoard.css';

const STATUS_LABEL: Record<'do_now' | 'watch' | 'skip', string> = {
  do_now: '优先验证',
  watch: '持续观察',
  skip: '暂缓',
};

const SOURCE_LABEL: Record<string, string> = {
  real: '真实信号派生 · 需验证',
  mock: '样例 / mock · 非市场结论',
  fallback: '样例 / fallback · 非市场结论',
};

interface TopOpportunityBoardProps {
  opportunities: DiscoverableOpportunity[];
  dataSource: 'real' | 'mock' | 'fallback';
}

function getOpportunitySourceLabel(dataSource: 'real' | 'mock' | 'fallback') {
  return SOURCE_LABEL[dataSource];
}

export function TopOpportunityBoard({ opportunities, dataSource }: TopOpportunityBoardProps) {
  const topThree = opportunities.slice(0, 3);

  if (topThree.length === 0) {
    return null;
  }

  return (
    <section className="top-opp-board" aria-label="今日最值得看的市场机会">
      <div className="top-opp-board__header">
        <div>
          <p className="top-opp-board__eyebrow">Market Opportunity Radar</p>
          <h2>今日最值得看的 3 个市场机会</h2>
          <p>先看今天最值得验证的 3 个机会，再看背后的信号和证据。</p>
        </div>
      </div>

      <div className="top-opp-board__grid">
        {topThree.map((item, index) => (
          <article key={item.id} className={`top-opp-board__card${index === 0 ? ' top-opp-board__card--featured' : ''}`}>
            <div className="top-opp-board__topRow">
              <span className="top-opp-board__rank">#{index + 1}</span>
              <span className={`top-opp-board__status top-opp-board__status--${item.confidenceLevel}`}>
                {STATUS_LABEL[item.confidenceLevel === 'high' ? 'do_now' : item.confidenceLevel === 'medium' ? 'watch' : 'skip']}
              </span>
              <span className="top-opp-board__score">机会分 {item.discoveryScore}</span>
            </div>
            <h3>{item.title}</h3>
            <p className="top-opp-board__meta">目标市场：{item.targetMarket} · 产品类型：{item.category}</p>
            <p className="top-opp-board__why"><strong>为什么值得看：</strong>{item.whyNow}</p>
            <p className="top-opp-board__why"><strong>建议验证点：</strong>{item.validationHypothesis}</p>
            <p className="top-opp-board__source">{getOpportunitySourceLabel(dataSource)}</p>
            <a className="top-opp-board__button" href={`?source=${dataSource === 'real' ? 'real' : 'mock'}&report=${item.sourceItemId}`}>
              查看验证报告
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}
