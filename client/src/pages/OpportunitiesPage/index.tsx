import { useEffect, useMemo, useState } from 'react';
import { getHotspotList } from '../../api/getHotspotList';
import { getHotspotListFromApi } from '../../api/getHotspotListFromApi';
import { AppShell } from '../../components/layout/AppShell';
import { TopNav } from '../../components/layout/TopNav';
import { buildDiscoverableOpportunities, type DiscoverableOpportunity } from '../../lib/buildDiscoverableOpportunities';
import { buildOpportunityRanking } from '../../lib/buildOpportunityRanking';
import type { HotItem } from '../../types/hot';

type DataSource = 'real' | 'mock' | 'fallback';
type Filter = 'all' | 'priority' | 'watch' | 'highEvidence' | 'highRisk';

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'priority', label: '优先验证' },
  { id: 'watch', label: '持续观察' },
  { id: 'highEvidence', label: '高证据' },
  { id: 'highRisk', label: '高风险' },
];

function dedupOpportunities(items: DiscoverableOpportunity[]) {
  const dedup = new Map<string, DiscoverableOpportunity>();
  for (const item of items) {
    const key = item.title || item.sourceItemId;
    const existing = dedup.get(key);
    if (!existing || item.discoveryScore > existing.discoveryScore) dedup.set(key, item);
  }
  return [...dedup.values()];
}

function sourceName(sourceParam: string | null): DataSource {
  if (sourceParam === 'real') return 'real';
  if (sourceParam === 'fallback') return 'fallback';
  return 'mock';
}

function filterOpportunity(item: DiscoverableOpportunity, filter: Filter) {
  if (filter === 'priority') return item.discoveryScore >= 70;
  if (filter === 'watch') return item.discoveryScore < 70;
  if (filter === 'highEvidence') return item.confidenceLevel === 'high';
  if (filter === 'highRisk') return item.confidenceLevel === 'low' || item.discoveryScore < 65;
  return true;
}

export function OpportunitiesPage() {
  const searchParams = new URLSearchParams(window.location.search);
  const sourceParam = searchParams.get('source');
  const [items, setItems] = useState<HotItem[]>([]);
  const [dataSource, setDataSource] = useState<DataSource>(sourceName(sourceParam));
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    const load = async () => {
      if (sourceParam === 'fallback') {
        const seed = await getHotspotList();
        setItems(seed.items);
        setDataSource('fallback');
        return;
      }
      try {
        const data = await getHotspotListFromApi(sourceParam === 'real' ? 'real' : undefined);
        setItems(data.items);
        setDataSource(sourceParam === 'real' ? 'real' : 'mock');
      } catch {
        const seed = await getHotspotList();
        setItems(seed.items);
        setDataSource('fallback');
      }
    };
    load();
  }, [sourceParam]);

  const allOpportunities = useMemo(() => dedupOpportunities(buildDiscoverableOpportunities(items)), [items]);
  const ranking = useMemo(() => buildOpportunityRanking(allOpportunities), [allOpportunities]);
  const opportunities = useMemo(
    () => allOpportunities.filter((item) => filterOpportunity(item, filter)).sort((a, b) => (ranking.get(b.id)?.rankingScore ?? b.discoveryScore) - (ranking.get(a.id)?.rankingScore ?? a.discoveryScore)).slice(0, 10),
    [allOpportunities, filter, ranking],
  );
  const highEvidenceCount = allOpportunities.filter((item) => item.confidenceLevel === 'high').length;
  const sourceQuery = `source=${dataSource}`;

  return (
    <AppShell>
      <div>
        <TopNav />
        <section style={{ padding: '24px 0' }}>
          <h1>可验证机会库</h1>
          <p>这里展示从当前市场信号中派生的可追溯机会，适合继续查看关联验证报告。</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '16px 0', alignItems: 'center' }}>
            <span style={{ padding: '6px 10px', borderRadius: 999, background: '#eef4fb', color: '#244b86', fontWeight: 800 }}>当前数据源：{dataSource}</span>
            <span style={{ color: '#5c6370' }}>原始信号数量：{items.length}</span>
            <span style={{ color: '#5c6370' }}>可转译机会数量：{allOpportunities.length}</span>
            <span style={{ color: '#5c6370' }}>高证据机会数量：{highEvidenceCount}</span>
          </div>
          {dataSource === 'mock' ? <p style={{ color: '#9a3412', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 12, padding: 12 }}>当前为 mock 数据，仅用于验证页面结构，不代表真实市场结论。</p> : null}
          {dataSource === 'fallback' ? <p style={{ color: '#9a3412', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 12, padding: 12 }}>真实信号加载失败，当前展示本地兜底数据，仅用于原型演示。</p> : null}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '18px 0' }}>
            {FILTERS.map((item) => <button key={item.id} type="button" onClick={() => setFilter(item.id)} style={{ border: 'none', borderRadius: 999, padding: '9px 12px', background: filter === item.id ? '#244b86' : '#eef4fb', color: filter === item.id ? '#fff' : '#244b86', fontWeight: 800, cursor: 'pointer' }}>{item.label}</button>)}
          </div>

          {opportunities.length === 0 ? (
            <section style={{ marginTop: 20, padding: 20, borderRadius: 18, background: '#fff', border: '1px solid #e6edf6' }}>
              <h2>当前没有生成可靠机会</h2>
              <p>可能是：真实数据源暂时未返回、当前筛选条件过窄、当前信号缺少足够证据链。</p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <a href={`/signals?${sourceQuery}`} style={{ color: '#244b86', fontWeight: 800 }}>查看完整市场信号</a>
                <a href="/opportunities?source=real" style={{ color: '#244b86', fontWeight: 800 }}>切换 source=real</a>
                <button type="button" onClick={() => setFilter('all')} style={{ border: 'none', background: 'transparent', color: '#244b86', fontWeight: 800, cursor: 'pointer' }}>清空筛选条件</button>
                <a href={`/analyze?${sourceQuery}`} style={{ color: '#244b86', fontWeight: 800 }}>回到验证工具</a>
              </div>
            </section>
          ) : (
            <div style={{ display: 'grid', gap: 14, marginTop: 20 }}>
              {opportunities.map((opportunity) => {
                const rank = ranking.get(opportunity.id);
                return (
                  <article key={opportunity.id} id={`opportunity-${opportunity.sourceItemId}`} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: 18 }}>
                    <h2 style={{ margin: '0 0 8px', color: '#10203d' }}>{opportunity.title}</h2>
                    <p style={{ margin: 0, color: '#5c6370' }}>{opportunity.targetMarket} / {opportunity.targetUser}</p>
                    <p><strong>机会缺口：</strong>{opportunity.opportunityGap}</p>
                    <p><strong>置信度：</strong>{opportunity.confidenceLevel} / <strong>发现分：</strong>{opportunity.discoveryScore} / <strong>排序分：</strong>{rank?.rankingScore ?? opportunity.discoveryScore}</p>
                    <p><strong>同类信号数量：</strong>{rank?.similarSignalCount ?? 1} / <strong>覆盖来源：</strong>{rank?.sourceCoverage.join(' / ') || '待补充'}</p>
                    <p><strong>推荐理由：</strong>{rank?.recommendationReasons.join(' ')}</p>
                    <p><strong>排序依据：</strong>{rank?.rankingReason}</p>
                    <p><strong>验证假设：</strong>{opportunity.validationHypothesis}</p>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {opportunity.evidenceChain.slice(0, 2).map((evidence) => (
                        <span key={`${opportunity.id}-${evidence.source}-${evidence.title}`} style={{ color: '#5c6370' }}>{evidence.source} · {evidence.strength} · {evidence.title}</span>
                      ))}
                    </div>
                    <button type="button" onClick={() => window.location.href = `/report?id=${opportunity.sourceItemId}&source=${dataSource}`} style={{ marginTop: 14, border: 'none', borderRadius: 999, padding: '10px 14px', background: '#244b86', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>查看关联报告</button>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
