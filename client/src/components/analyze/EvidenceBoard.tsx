import type { EvidenceBoardItem } from '../../types/analyze';

export function EvidenceBoard({ items, source }: { items?: EvidenceBoardItem[]; source: 'real' | 'mock' | 'fallback' }) {
  const evidence = Array.isArray(items) ? items : [];

  if (evidence.length === 0) {
    return (
      <section style={{ display: 'grid', gap: 12, padding: 20, borderRadius: 20, background: '#fff', border: '1px solid #e6edf6' }}>
        <h2 style={{ margin: 0 }}>证据链</h2>
        <p style={{ margin: 0, color: '#64748b' }}>当前没有足够真实外部证据，建议通过 MVP 补证</p>
      </section>
    );
  }

  return (
    <section style={{ display: 'grid', gap: 12, padding: 20, borderRadius: 20, background: '#fff', border: '1px solid #e6edf6' }}>
      <h2 style={{ margin: 0 }}>证据链</h2>
      <div style={{ display: 'grid', gap: 10 }}>
        {evidence.map((item) => {
          const handleClick = () => {
            if (item.url) {
              window.open(item.url, '_blank', 'noopener,noreferrer');
              return;
            }
            if (item.sourceItemId) {
              window.location.href = `/signals?source=${source}`;
            }
          };

          return (
            <article key={`${item.title}-${item.source}`} style={{ padding: 14, borderRadius: 16, background: '#f8fbff', border: '1px solid #e6edf6' }}>
              <p style={{ margin: 0, color: '#10203d', fontWeight: 800 }}>{item.title}</p>
              <p style={{ margin: '6px 0 0', color: '#334155' }}><strong>来源：</strong>{item.source} · <strong>类型：</strong>{item.sourceType} · <strong>强度：</strong>{item.evidenceStrength ?? 'low'}</p>
              <p style={{ margin: '4px 0 0', color: '#334155' }}><strong>支持：</strong>{item.supports}</p>
              {item.note ? <p style={{ margin: '4px 0 0', color: '#64748b' }}>{item.note}</p> : null}
              {item.sourceType === 'mock_signal' ? <p style={{ margin: '4px 0 0', color: '#9a3412' }}>结构演示，不代表真实市场结论</p> : null}
              <button type="button" onClick={handleClick} style={{ marginTop: 10, border: 'none', borderRadius: 999, padding: '8px 12px', background: '#244b86', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>查看来源</button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
