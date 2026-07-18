import { useEffect, useMemo, useState } from 'react';
import { getHotspotList } from '../../api/getHotspotList';
import { getHotspotListFromApi } from '../../api/getHotspotListFromApi';
import { AppShell } from '../../components/layout/AppShell';
import { TopNav } from '../../components/layout/TopNav';
import { EvidenceMeter } from '../../components/visual/EvidenceMeter';
import { MetricPill } from '../../components/visual/MetricPill';
import { PagePurpose } from '../../components/visual/PagePurpose';
import { buildDailyIntelligenceBrief } from '../../lib/buildDailyIntelligenceBrief';
import { buildDiscoverableOpportunities } from '../../lib/buildDiscoverableOpportunities';
import type { DailyBriefSourceStatus, DailyIntelligenceBriefItem } from '../../lib/buildDailyIntelligenceBrief';
import type { HotItem } from '../../types/hot';

type SectionKey = 'todayNew' | 'rising' | 'worthValidating' | 'riskUp' | 'caseOrPattern';

const SECTIONS: Array<{ key: SectionKey; title: string }> = [
  { key: 'todayNew', title: '今日新增' },
  { key: 'rising', title: '升温方向' },
  { key: 'worthValidating', title: '值得验证' },
  { key: 'riskUp', title: '风险提醒' },
  { key: 'caseOrPattern', title: '模式观察' },
];

function sourceStatus(sourceParam: string | null): DailyBriefSourceStatus {
  if (sourceParam === 'mock') return 'mock';
  if (sourceParam === 'fallback') return 'fallback';
  return 'real';
}

function shortText(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function BriefItemCard({ item, dataSource }: { item: DailyIntelligenceBriefItem; dataSource: DailyBriefSourceStatus }) {
  const reportHref = item.id.includes('worth') ? `/opportunities?source=${dataSource}` : `/opportunities?tab=signals&source=${dataSource}`;
  return (
    <article style={{ display: 'grid', gap: 12, padding: 18, borderRadius: 20, background: '#fff', border: '1px solid #dbe6f6', boxShadow: '0 10px 22px rgba(15,23,42,.04)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
        <span style={{ display: 'inline-flex', padding: '5px 10px', borderRadius: 999, background: '#eef4fb', color: '#244b86', fontWeight: 800, fontSize: 12 }}>{shortText(item.source, 22)}</span>
        <EvidenceMeter strength={item.evidenceStrength} />
      </div>
      <h3 style={{ margin: 0, color: '#10203d', fontSize: 18 }}>{item.title}</h3>
      <p style={{ margin: 0, color: '#5a6678', lineHeight: 1.55 }}>{shortText(item.opportunityInsight, 60)}</p>
      <p style={{ margin: 0, color: '#5a6678' }}><strong>适合：</strong>{shortText(item.suitableFor, 30)}</p>
      <p style={{ margin: 0, color: '#5a6678' }}><strong>验证：</strong>{shortText(item.validationDirection, 50)}</p>
      <a href={reportHref} style={{ width: 'fit-content', borderRadius: 999, padding: '10px 14px', background: '#244b86', color: '#fff', fontWeight: 800, textDecoration: 'none' }}>{item.id.includes('worth') ? '查看商机雷达' : '查看市场信号榜'}</a>
    </article>
  );
}

export function BriefingPage() {
  const searchParams = new URLSearchParams(window.location.search);
  const sourceParam = searchParams.get('source');
  const [items, setItems] = useState<HotItem[]>([]);
  const [dataSource, setDataSource] = useState<DailyBriefSourceStatus>(sourceStatus(sourceParam));

  useEffect(() => {
    const load = async () => {
      if (sourceParam === 'fallback') {
        const fallback = await getHotspotList();
        setItems(fallback.items);
        setDataSource('fallback');
        return;
      }
      try {
        const data = await getHotspotListFromApi(sourceParam === 'mock' ? undefined : 'real');
        setItems(data.items);
        setDataSource(sourceParam === 'mock' ? 'mock' : 'real');
      } catch {
        const fallback = await getHotspotList();
        setItems(fallback.items);
        setDataSource('fallback');
      }
    };
    load();
  }, [sourceParam]);

  const opportunities = useMemo(() => buildDiscoverableOpportunities(items), [items]);
  const brief = useMemo(() => buildDailyIntelligenceBrief({ items, dataSource, discoverableOpportunities: opportunities }), [dataSource, items, opportunities]);

  return (
    <AppShell>
      <div style={{ display: 'grid', gap: 24 }}>
        <TopNav />
        <PagePurpose
          eyebrow="Daily Brief"
          title="今日出海机会简报"
          description="今天哪些信号发生变化？这里只展示轻量快报，不伪装成完整市场报告。"
          meta={<div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}><MetricPill label="当前数据源" value={dataSource} tone={dataSource === 'real' ? 'green' : 'amber'} /><MetricPill label="今日新增" value={brief.todayNew.length} /><MetricPill label="升温方向" value={brief.rising.length} /><MetricPill label="值得验证" value={brief.worthValidating.length} /><MetricPill label="风险提醒" value={brief.riskUp.length} tone="red" /></div>}
        />
        {dataSource === 'mock' ? <p style={{ color: '#9a3412', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 12, padding: 12 }}>当前为 mock 数据，仅用于验证页面结构，不代表真实市场结论。</p> : null}
        {dataSource === 'fallback' ? <p style={{ color: '#9a3412', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 12, padding: 12 }}>真实信号加载失败，当前展示本地兜底数据，仅用于原型演示。</p> : null}

        {SECTIONS.map((section) => {
          const sectionItems = brief[section.key].slice(0, 3);
          return (
            <section key={section.key} style={{ padding: 24, borderRadius: 24, background: '#fff', border: '1px solid #e6edf6' }}>
              <h2 style={{ margin: '0 0 16px', color: '#0f1f3d' }}>{section.title}</h2>
              {sectionItems.length === 0 ? <p style={{ color: '#64748b' }}>当前没有生成可靠条目，可能是数据源暂未返回、筛选过窄或信号证据不足。你可以查看市场信号或切换 source=real。</p> : null}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
                {sectionItems.map((item) => <BriefItemCard key={item.id} item={item} dataSource={dataSource} />)}
              </div>
            </section>
          );
        })}
      </div>
    </AppShell>
  );
}
