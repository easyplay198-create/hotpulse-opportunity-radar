import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { TopNav } from '../../components/layout/TopNav';
import { HotList } from '../../components/HotList';
import { MetricPill } from '../../components/visual/MetricPill';
import { PagePurpose } from '../../components/visual/PagePurpose';
import { getHotspotList } from '../../api/getHotspotList';
import { getHotspotListFromApi } from '../../api/getHotspotListFromApi';
import type { EvidenceStrength, HotItem, HotPlatform } from '../../types/hot';

type DataSource = 'real' | 'mock' | 'fallback';
type SortKey = 'score' | 'evidence' | 'risk' | 'published';

const SOURCE_FILTERS = ['全部', 'Hacker News', 'Apple App Store', 'GitHub', 'Product Hunt', 'GDELT', '本地 seed'];

function evidenceRank(strength?: EvidenceStrength) {
  if (strength === 'high') return 3;
  if (strength === 'medium') return 2;
  if (strength === 'low') return 1;
  return 0;
}

function strongestEvidence(item: HotItem) {
  return Math.max(...(item.evidence ?? []).map((evidence) => evidenceRank(evidence.evidenceStrength)), 0);
}

function riskScore(item: HotItem) {
  return Math.max(item.paymentRisk ?? 0, item.localizationRisk ?? 0, item.complianceRisk ?? 0, item.acquisitionRisk ?? 0, item.aiCostRisk ?? 0, item.competitionRisk ?? 0);
}

function itemSources(item: HotItem) {
  return (item.evidence ?? []).map((evidence) => evidence.source);
}

export function SignalsPage() {
  const searchParams = new URLSearchParams(window.location.search);
  const sourceParam = searchParams.get('source');
  const [platforms, setPlatforms] = useState<HotPlatform[]>([]);
  const [items, setItems] = useState<HotItem[]>([]);
  const [dataSource, setDataSource] = useState<DataSource>(sourceParam === 'real' ? 'real' : sourceParam === 'fallback' ? 'fallback' : 'mock');
  const [sourceFilter, setSourceFilter] = useState('全部');
  const [sortKey, setSortKey] = useState<SortKey>('score');

  useEffect(() => {
    const load = async () => {
      if (sourceParam === 'fallback') {
        const seed = await getHotspotList();
        setPlatforms(seed.platforms);
        setItems(seed.items);
        setDataSource('fallback');
        return;
      }

      try {
        const data = await getHotspotListFromApi(sourceParam === 'real' ? 'real' : undefined);
        setPlatforms(data.platforms);
        setItems(data.items);
        setDataSource(sourceParam === 'real' ? 'real' : 'mock');
      } catch {
        const seed = await getHotspotList();
        setPlatforms(seed.platforms);
        setItems(seed.items);
        setDataSource('fallback');
      }
    };

    load();
  }, [sourceParam]);

  const visibleItems = useMemo(() => {
    const filtered = items.filter((item) => {
      if (sourceFilter === '全部') return true;
      if (sourceFilter === '本地 seed') return dataSource === 'fallback' || dataSource === 'mock';
      return itemSources(item).includes(sourceFilter);
    });
    return [...filtered].sort((a, b) => {
      if (sortKey === 'evidence') return strongestEvidence(b) - strongestEvidence(a);
      if (sortKey === 'risk') return riskScore(b) - riskScore(a);
      if (sortKey === 'published') return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      return b.valueScore - a.valueScore;
    });
  }, [dataSource, items, sortKey, sourceFilter]);

  const sourceCount = new Set(items.flatMap((item) => itemSources(item))).size;
  const highEvidenceCount = items.filter((item) => strongestEvidence(item) >= 3).length;

  return (
    <AppShell>
      <div>
        <TopNav />
        <section style={{ padding: '24px 0' }}>
          <PagePurpose
            title="市场信号榜"
            description="原始信号从哪里来，证据强度如何？这里只展示原始信号、来源和排序，不生成长篇进入判断。"
            meta={<div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}><MetricPill label="当前数据源" value={dataSource} tone={dataSource === 'real' ? 'green' : 'amber'} /><MetricPill label="原始信号" value={items.length} /><MetricPill label="来源数量" value={sourceCount} /><MetricPill label="高证据" value={highEvidenceCount} tone="green" /></div>}
          />
          {dataSource === 'mock' ? <p style={{ color: '#9a3412', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 12, padding: 12 }}>当前为 mock 数据，仅用于验证页面结构，不代表真实市场结论。</p> : null}
          {dataSource === 'fallback' ? <p style={{ color: '#9a3412', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 12, padding: 12 }}>真实信号加载失败，当前展示本地兜底数据，仅用于原型演示。</p> : null}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '18px 0' }}>
            {SOURCE_FILTERS.map((source) => <button key={source} type="button" onClick={() => setSourceFilter(source)} style={{ border: 'none', borderRadius: 999, padding: '8px 12px', background: sourceFilter === source ? '#244b86' : '#eef4fb', color: sourceFilter === source ? '#fff' : '#244b86', fontWeight: 800, cursor: 'pointer' }}>{source}</button>)}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '0 0 18px' }}>
            {[['score', '机会分'], ['evidence', '证据强度'], ['risk', '风险高低'], ['published', '发布时间']].map(([key, label]) => <button key={key} type="button" onClick={() => setSortKey(key as SortKey)} style={{ border: 'none', borderRadius: 999, padding: '8px 12px', background: sortKey === key ? '#244b86' : '#f3f7fd', color: sortKey === key ? '#fff' : '#244b86', fontWeight: 800, cursor: 'pointer' }}>{label}</button>)}
          </div>
          <HotList platforms={platforms} items={visibleItems} />
        </section>
      </div>
    </AppShell>
  );
}
