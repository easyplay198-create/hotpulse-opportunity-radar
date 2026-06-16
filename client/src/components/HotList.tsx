import { useState } from 'react';
import type { HotItem, HotPlatform } from '../types/hot';
import { buildOpportunityWedge } from '../lib/buildOpportunityWedge';
import { buildMvpValidationReportText } from '../lib/buildMvpValidationReportText';
import './HotList.css';

const VERDICT_LABEL: Record<HotItem['verdict'], string> = {
  do_now: '优先验证',
  watch: '持续观察',
  skip: '暂不进入',
};

const WEDGE_ROLE_LABEL: Record<string, string> = {
  benchmark_competitor: '标杆竞品',
  market_signal: '市场信号',
  wedge_opportunity: '可切入机会',
  avoid_direct_entry: '暂不建议进入',
};

const WEDGE_HELP_TEXT: Record<string, string> = {
  benchmark_competitor: '查看为什么不建议正面进入',
  wedge_opportunity: '查看 MVP 验证路径',
  market_signal: '查看是否值得继续验证',
  avoid_direct_entry: '查看风险原因',
};

interface HotListProps {
  platforms: HotPlatform[];
  items: HotItem[];
}

export function HotList({ platforms, items }: HotListProps) {
  const platformMap = new Map(platforms.map((p) => [p.id, p.name]));
  const sorted = [...items].sort((a, b) => b.valueScore - a.valueScore);
  const [expanded, setExpanded] = useState(false);
  const [copyState, setCopyState] = useState<{ id: string | null; status: 'idle' | 'copying' | 'success' | 'error' }>({
    id: null,
    status: 'idle',
  });

  if (sorted.length === 0) {
    return <p className="hot-list__empty">暂无市场机会数据</p>;
  }

  const visibleItems = expanded ? sorted : sorted.slice(0, 8);

  return (
    <div className="hot-list">
      <p className="hot-list__meta">默认展示前 {Math.min(8, sorted.length)} 条 · 共 {sorted.length} 条</p>
      {visibleItems.map((item, index) => {
        const rank = index + 1;
        const isTopRank = rank <= 3;
        const wedge = buildOpportunityWedge(item);

        const handleCopy = async () => {
          const reportText = buildMvpValidationReportText(item);
          setCopyState({ id: item.id, status: 'copying' });
          try {
            await navigator.clipboard.writeText(reportText);
            setCopyState({ id: item.id, status: 'success' });
          } catch (error) {
            console.warn('复制验证方案失败', error);
            setCopyState({ id: item.id, status: 'error' });
          } finally {
            window.setTimeout(() => {
              setCopyState((current) => (current.id === item.id ? { id: null, status: 'idle' } : current));
            }, 2000);
          }
        };

        return (
          <article
            id={`opportunity-${item.id}`}
            key={item.id}
            className={`hot-card${isTopRank ? ' hot-card--top' : ''}`}
          >
            <div className="hot-card__scanRow">
              <span
                className={`hot-card__rank${isTopRank ? ' hot-card__rank--top' : ''}`}
              >
                #{rank}
              </span>
              <div className="hot-card__decision">
                <span className="hot-card__fieldLabel">进入建议</span>
                <span className={`hot-card__verdict hot-card__verdict--${item.verdict}`}>
                  {VERDICT_LABEL[item.verdict]}
                </span>
              </div>
              <div className="hot-card__score">
                <span className="hot-card__fieldLabel">机会分</span>
                <span className="hot-card__scoreValue">{item.valueScore}</span>
              </div>
            </div>

            <div className="hot-card__header">
              {item.evidence?.[0]?.url ? (
                <a
                  className="hot-card__titleLink"
                  href={item.evidence[0].url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <h3 className="hot-card__title">{item.title}</h3>
                </a>
              ) : (
                <h3 className="hot-card__title">{item.title}</h3>
              )}
              <span className="hot-card__badge">
                信号来源 {platformMap.get(item.platformId) ?? item.platformId}
              </span>
            </div>

            {(item.targetMarket || item.productType) && (
              <div className="hot-card__diagnosisMeta">
                {item.targetMarket && <span>目标市场 {item.targetMarket}</span>}
                {item.productType && <span>产品类型 {item.productType}</span>}
              </div>
            )}

            <p className="hot-card__summary">{item.summary}</p>

            <p className="hot-card__wedgeSummary">{wedge.displaySummary}</p>
            <div className="hot-card__wedgeMeta">
              <span className="hot-card__wedgeTag">{WEDGE_ROLE_LABEL[wedge.opportunityRole]}</span>
              <span>轻量验证适配度 {Math.round(wedge.wedgeScore)}</span>
            </div>
            <p className="hot-card__wedgeMiniLine"><strong>痛点洞察：</strong>{wedge.painPointInsights[0]}</p>
            <p className="hot-card__wedgeMiniLine"><strong>切入建议：</strong>{wedge.wedgeSuggestions[0]}</p>

            <div className="hot-card__actionRow">
              <div className="hot-card__primaryActionWrap">
                <a
                  className="hot-card__viewReportLink hot-card__viewReportLink--primary"
                  href={`/report?id=${item.id}&source=${new URLSearchParams(window.location.search).get('source') === 'real' ? 'real' : new URLSearchParams(window.location.search).get('source') === 'fallback' ? 'fallback' : 'mock'}`}
                  onClick={() => {
                    sessionStorage.setItem('returnToOpportunityId', item.id);
                    sessionStorage.setItem('returnScrollY', String(window.scrollY));
                  }}
                >
                  查看验证报告
                </a>
                <span className="hot-card__viewReportHint">
                  {WEDGE_HELP_TEXT[wedge.opportunityRole]}
                </span>
              </div>
              <button
                type="button"
                className={`hot-card__copyButton${copyState.id === item.id ? ` hot-card__copyButton--${copyState.status}` : ''}`}
                onClick={handleCopy}
              >
                {copyState.id === item.id && copyState.status === 'copying'
                  ? '复制中...'
                  : copyState.id === item.id && copyState.status === 'success'
                    ? '已复制'
                    : copyState.id === item.id && copyState.status === 'error'
                      ? '复制失败'
                      : '复制验证方案'}
              </button>
            </div>

            {(item.evidence?.length ?? 0) > 0 && (
              <div className="hot-card__evidence">
                <p className="hot-card__evidenceTitle">核心证据</p>
                <ul className="hot-card__evidenceList">
                  {item.evidence!.slice(0, 1).map((ev) => (
                    <li key={`${item.id}-${ev.url}`}>
                      <span>{ev.source}</span>
                      <span>{ev.evidenceStrength}</span>
                      {ev.url ? <a href={ev.url} target="_blank" rel="noreferrer">查看原始来源</a> : null}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="hot-card__tags">
              {item.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="hot-card__tag">
                  {tag}
                </span>
              ))}
            </div>
          </article>
        );
      })}
      {sorted.length > 8 && (
        <button
          type="button"
          className="hot-list__moreButton"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? '收起市场信号' : `查看更多市场信号（共 ${sorted.length} 条）`}
        </button>
      )}
    </div>
  );
}
