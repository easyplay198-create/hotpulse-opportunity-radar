import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { TopNav } from '../../components/layout/TopNav';
import { OpportunityReportPreview } from '../../components/OpportunityReportPreview';
import { getHotspotList } from '../../api/getHotspotList';
import { getHotspotListFromApi } from '../../api/getHotspotListFromApi';
import { buildMvpValidationReportText } from '../../lib/buildMvpValidationReportText';
import { PagePurpose } from '../../components/visual/PagePurpose';
import type { HotItem } from '../../types/hot';

type DataSource = 'real' | 'mock' | 'fallback';

function sourceStatus(sourceParam: string | null): DataSource {
  if (sourceParam === 'real') return 'real';
  if (sourceParam === 'fallback') return 'fallback';
  return 'mock';
}

const buttonStyle = { display: 'inline-flex', padding: '10px 14px', borderRadius: 999, background: '#244b86', color: '#fff', textDecoration: 'none', fontWeight: 800, border: 'none', cursor: 'pointer' };
const ghostButtonStyle = { ...buttonStyle, background: '#eef4fb', color: '#244b86' };

export function ReportPage() {
  const searchParams = new URLSearchParams(window.location.search);
  const itemId = searchParams.get('id');
  const sourceParam = searchParams.get('source');
  const [items, setItems] = useState<HotItem[]>([]);
  const [dataSource, setDataSource] = useState<DataSource>(sourceStatus(sourceParam));
  const [loading, setLoading] = useState(Boolean(itemId));

  useEffect(() => {
    if (!itemId) return;
    const load = async () => {
      try {
        if (sourceParam === 'fallback') {
          const seed = await getHotspotList();
          setItems(seed.items);
          setDataSource('fallback');
          return;
        }
        const data = await getHotspotListFromApi(sourceParam === 'real' ? 'real' : undefined);
        setItems(data.items);
        setDataSource(sourceParam === 'real' ? 'real' : 'mock');
      } catch {
        const seed = await getHotspotList();
        setItems(seed.items);
        setDataSource('fallback');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [itemId, sourceParam]);

  const reportItem = useMemo(() => items.find((item) => item.id === itemId), [itemId, items]);

  const handleCopy = async () => {
    if (!reportItem) return;
    await navigator.clipboard.writeText(buildMvpValidationReportText(reportItem));
  };

  if (!itemId) {
    return (
      <AppShell>
        <div style={{ display: 'grid', gap: 24 }}>
          <TopNav />
          <PagePurpose title="HotPulse 出海验证报告" description="这个机会是否值得进入，下一步怎么做？选择一个可追溯机会，或先从验证工具生成你的第一份报告。" meta={<span>当前数据源：{dataSource}</span>} />
          <section style={{ padding: 24, borderRadius: 24, background: '#fff', border: '1px solid #e6edf6' }}>
            <h2 style={{ marginTop: 0, color: '#0f1f3d' }}>选择报告来源</h2>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <a href={`/opportunities?source=${dataSource}`} style={buttonStyle}>从机会库选择报告</a>
              <a href={`/analyze?source=${dataSource}`} style={ghostButtonStyle}>去验证我的想法</a>
            </div>
          </section>
          <section style={{ padding: 24, borderRadius: 24, background: '#fff', border: '1px solid #e6edf6' }}>
            <p style={{ margin: '0 0 8px', color: '#244b86', fontWeight: 800 }}>报告样本预览 · 非市场结论</p>
            <h2 style={{ margin: 0, color: '#0f1f3d' }}>AI 工具出海东南亚市场免费内测诊断报告</h2>
            <p style={{ color: '#5c6370', lineHeight: 1.7 }}>展示报告结构：目标市场、证据链、风险矩阵、7 天验证动作。这是报告结构样本，不代表真实市场结论。</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, margin: '16px 0' }}>
              {['目标市场', '证据链', '风险矩阵', '7 天验证动作'].map((item) => <span key={item} style={{ padding: 14, borderRadius: 16, background: '#f8fbff', border: '1px solid #e6edf6', color: '#244b86', fontWeight: 800 }}>{item}</span>)}
            </div>
            <a href="/report?source=mock" style={ghostButtonStyle}>查看样本结构</a>
          </section>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div style={{ display: 'grid', gap: 24 }}>
        <TopNav />
        <PagePurpose title="机会验证报告" description="这个机会是否值得进入，下一步怎么做？" meta={<span>当前数据源：{dataSource}</span>} />
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <a href={`/opportunities?source=${dataSource}`} style={ghostButtonStyle}>返回机会库</a>
          <a href={`/signals?source=${dataSource}`} style={ghostButtonStyle}>查看原始信号</a>
          <button type="button" onClick={handleCopy} disabled={!reportItem} style={buttonStyle}>复制验证方案</button>
        </div>
        {loading ? (
          <section style={{ padding: 24, borderRadius: 24, background: '#fff', border: '1px solid #e6edf6' }}>
            <h1>正在加载报告...</h1>
            <p>当前数据源：{dataSource}</p>
          </section>
        ) : reportItem ? (
          <OpportunityReportPreview item={reportItem} onBack={() => window.location.href = `/opportunities?source=${dataSource}`} />
        ) : (
          <section style={{ padding: 24, borderRadius: 24, background: '#fff', border: '1px solid #e6edf6' }}>
            <h1>未找到该机会报告</h1>
            <p>请返回机会库重新选择。</p>
            <p>当前没有生成可靠机会，可能是：真实数据源暂时未返回、当前筛选条件过窄、当前信号缺少足够证据链。</p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <a href={`/signals?source=${dataSource}`} style={ghostButtonStyle}>查看完整市场信号</a>
              <a href="/opportunities?source=real" style={ghostButtonStyle}>切换 source=real</a>
              <a href={`/analyze?source=${dataSource}`} style={buttonStyle}>回到验证工具</a>
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
