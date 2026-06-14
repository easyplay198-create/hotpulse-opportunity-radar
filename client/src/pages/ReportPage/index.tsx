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
  if (sourceParam === 'mock') return 'mock';
  if (sourceParam === 'fallback') return 'fallback';
  return 'real';
}

function dataSourceLabel(source: DataSource) {
  if (source === 'real') return '真实信号';
  if (source === 'fallback') return '本地备用';
  return '预验证样本';
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
        const data = await getHotspotListFromApi(sourceParam === 'mock' ? undefined : 'real');
        setItems(data.items);
        setDataSource(sourceParam === 'mock' ? 'mock' : 'real');
      } catch {
        const seed = await getHotspotList();
        setItems(seed.items);
        setDataSource('fallback');
      } finally {
        setLoading(false);
      }
    };
    void load();
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
          <PagePurpose
            title="我的报告"
            description="从机会雷达选择方向后，可在这里查看验证报告预览，并继续完善市场判断与验证动作。"
            meta={<span>当前数据：{dataSourceLabel(dataSource)}</span>}
          />
          <section style={{ padding: 24, borderRadius: 24, background: '#fff', border: '1px solid #e6edf6' }}>
            <h2 style={{ marginTop: 0, color: '#0f1f3d' }}>选择一个机会生成报告预览</h2>
            <p style={{ marginTop: 0, color: '#5c6370', lineHeight: 1.7 }}>
              报告会围绕目标市场、证据链、风险矩阵和验证动作展开，帮助你把机会判断推进到下一步。
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <a href={`/opportunities?source=${dataSource}`} style={buttonStyle}>去机会雷达选择</a>
              <a href={`/analyze?source=${dataSource}`} style={ghostButtonStyle}>验证自己的方向</a>
            </div>
          </section>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div style={{ display: 'grid', gap: 24 }}>
        <TopNav />
        <PagePurpose
          title="我的报告"
          description="基于当前选择的机会生成验证报告预览，帮助判断下一步是否继续。"
          meta={<span>当前数据：{dataSourceLabel(dataSource)}</span>}
        />
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <a href={`/opportunities?source=${dataSource}`} style={ghostButtonStyle}>返回机会雷达</a>
          <a href={`/opportunities?tab=signals&source=${dataSource}`} style={ghostButtonStyle}>查看市场信号榜</a>
          <button type="button" onClick={handleCopy} disabled={!reportItem} style={buttonStyle}>复制验证方案</button>
        </div>
        {loading ? (
          <section style={{ padding: 24, borderRadius: 24, background: '#fff', border: '1px solid #e6edf6' }}>
            <h1>正在加载报告...</h1>
            <p>当前数据：{dataSourceLabel(dataSource)}</p>
          </section>
        ) : reportItem ? (
          <OpportunityReportPreview item={reportItem} onBack={() => { window.location.href = `/opportunities?source=${dataSource}`; }} />
        ) : (
          <section style={{ padding: 24, borderRadius: 24, background: '#fff', border: '1px solid #e6edf6' }}>
            <h1>未找到该机会报告</h1>
            <p>请返回机会雷达重新选择，或进入验证工具补充你的项目方向。</p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <a href={`/opportunities?tab=signals&source=${dataSource}`} style={ghostButtonStyle}>查看市场信号榜</a>
              <a href={`/analyze?source=${dataSource}`} style={buttonStyle}>进入验证工具</a>
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
