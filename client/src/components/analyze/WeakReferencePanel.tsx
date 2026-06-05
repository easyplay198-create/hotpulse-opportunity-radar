import type { AnalyzeResponse } from '../../types/analyze';

export function WeakReferencePanel({ result }: { result: AnalyzeResponse }) {
  const weakSignals = (result.matchedSignals ?? []).filter((item) => {
    const score = item.relevanceScore ?? item.valueScore ?? 0;
    return score >= 45 && score < 65;
  });

  if (weakSignals.length === 0) return null;

  return (
    <section style={{ display: 'grid', gap: 12, padding: 20, borderRadius: 20, background: '#fff7ed', border: '1px solid #fed7aa' }}>
      <h2 style={{ margin: 0 }}>弱相关参考，不参与进入判断</h2>
      <p style={{ margin: 0, color: '#9a3412' }}>下面信号仅供参考，不作为推荐依据。</p>
      <div style={{ display: 'grid', gap: 10 }}>
        {weakSignals.slice(0, 3).map((item) => (
          <article key={item.id} style={{ padding: 14, borderRadius: 16, background: '#fff', border: '1px solid #fed7aa' }}>
            <strong>{item.title}</strong>
            <p style={{ margin: '6px 0 0', color: '#9a3412' }}>{item.evidence?.[0]?.source ?? item.platformId} · 相关性 {item.relevanceScore ?? item.valueScore ?? 0}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
