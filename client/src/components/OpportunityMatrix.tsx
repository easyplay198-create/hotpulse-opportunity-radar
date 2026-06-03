import type { HotItem } from '../types/hot';
import './OpportunityMatrix.css';

const PLOT_INSET = 10;

function plotPosition(value: number): number {
  const clamped = Math.max(0, Math.min(100, value));
  return PLOT_INSET + (clamped / 100) * (100 - PLOT_INSET * 2);
}

interface OpportunityMatrixProps {
  items: HotItem[];
  collapsed: boolean;
  onToggle: () => void;
  summaryText: string;
}

function buildDotLabel(item: HotItem, index: number): string {
  if (item.productType?.trim()) return item.productType;
  if (item.category?.trim()) return item.category;
  if (item.platformId?.trim()) return item.platformId.toUpperCase();
  return `机会 ${index + 1}`;
}

function getDotTone(item: HotItem): string {
  const text = `${item.productType ?? ''} ${item.category ?? ''} ${item.tags.join(' ')}`.toLowerCase();
  if (/game|游戏/.test(text)) return 'game';
  if (/developer|dev tool|github|api|workflow|开发者/.test(text)) return 'dev';
  if (/payment|支付|subscription|订阅|localization|本地化/.test(text)) return 'commerce';
  if (/saas|productivity|效率/.test(text)) return 'productivity';
  if (/ai app|app|应用/.test(text)) return 'ai-app';
  if (/ai tool|tool|工具/.test(text)) return 'ai-tool';
  return 'other';
}

export function OpportunityMatrix({ items, collapsed, onToggle, summaryText }: OpportunityMatrixProps) {
  if (items.length === 0) {
    return <p className="opp-matrix__empty">暂无机会数据</p>;
  }

  return (
    <div className="opp-matrix">
      <div className="opp-matrix__headerRow">
        <div>
          <h3 className="opp-matrix__title">机会进入判断摘要</h3>
          <p className="opp-matrix__summary">{summaryText}</p>
        </div>
        <button type="button" className="opp-matrix__toggle" onClick={onToggle}>
          {collapsed ? '查看辅助矩阵' : '收起辅助矩阵'}
        </button>
      </div>
      <div className="opp-matrix__statGrid">
        <div className="opp-matrix__statCard">
          <span className="opp-matrix__statLabel">可先试</span>
          <strong>{items.filter((item) => item.verdict === 'do_now').length}</strong>
        </div>
        <div className="opp-matrix__statCard">
          <span className="opp-matrix__statLabel">继续观察</span>
          <strong>{items.filter((item) => item.verdict === 'watch').length}</strong>
        </div>
        <div className="opp-matrix__statCard">
          <span className="opp-matrix__statLabel">暂缓进入</span>
          <strong>{items.filter((item) => item.verdict === 'skip').length}</strong>
        </div>
      </div>
      <div className="opp-matrix__categorySummary">
        <span>AI 应用 {items.filter((item) => /ai app|应用/.test(`${item.productType ?? ''} ${item.category ?? ''}`.toLowerCase())).length}</span>
        <span>AI 工具 {items.filter((item) => /ai tool|工具/.test(`${item.productType ?? ''} ${item.category ?? ''}`.toLowerCase())).length}</span>
        <span>开发者工具 {items.filter((item) => /developer|dev tool|github|api|workflow|开发者/.test(`${item.productType ?? ''} ${item.category ?? ''}`.toLowerCase())).length}</span>
        <span>游戏 {items.filter((item) => /game|游戏/.test(`${item.productType ?? ''} ${item.category ?? ''}`.toLowerCase())).length}</span>
        <span>其他 {items.filter((item) => !/ai app|应用|ai tool|工具|developer|dev tool|github|api|workflow|开发者|game|游戏|payment|支付|subscription|订阅|localization|本地化|saas|productivity|效率/.test(`${item.productType ?? ''} ${item.category ?? ''}`.toLowerCase())).length}</span>
      </div>
      {!collapsed && (
        <div className="opp-matrix__body">
          <div className="opp-matrix__yAxis" aria-hidden="true">
            <span className="opp-matrix__yAxisEnd">高</span>
            <span className="opp-matrix__yAxisTitle">机会分</span>
            <span className="opp-matrix__yAxisEnd">低</span>
          </div>
          <div className="opp-matrix__plotWrap">
            <p className="opp-matrix__hint">辅助矩阵仅用于观察机会分布，不作为最终进入结论。</p>
            <div className="opp-matrix__plot" aria-label="市场机会矩阵">
              <div className="opp-matrix__quadrants">
                <span className="opp-matrix__quadrant opp-matrix__quadrant--tl">优先验证</span>
                <span className="opp-matrix__quadrant opp-matrix__quadrant--tr">差异化进入</span>
                <span className="opp-matrix__quadrant opp-matrix__quadrant--bl">轻量观察</span>
                <span className="opp-matrix__quadrant opp-matrix__quadrant--br">暂缓进入</span>
              </div>
              <div className="opp-matrix__axis opp-matrix__axis--x" />
              <div className="opp-matrix__axis opp-matrix__axis--y" />
              {items.map((item, index) => {
                const competition = item.competitionRisk ?? 50;
                const left = plotPosition(competition);
                const bottom = plotPosition(item.valueScore);
                const label = buildDotLabel(item, index);
                const tone = getDotTone(item);

                return (
                  <span
                    key={item.id}
                    className={`opp-matrix__dot opp-matrix__dot--${tone}`}
                    style={{ left: `${left}%`, bottom: `${bottom}%` }}
                    title={`${item.title} · 产品类型 ${item.productType ?? item.category} · 进入建议 ${item.verdict} · 机会分 ${item.valueScore} · 竞争压力 ${competition}`}
                  >
                    {label}
                  </span>
                );
              })}
            </div>
            <p className="opp-matrix__xLabel">X 轴：竞争压力</p>
            <p className="opp-matrix__note">当前矩阵仅用于辅助观察，不作为最终进入结论。</p>
          </div>
        </div>
      )}
    </div>
  );
}
