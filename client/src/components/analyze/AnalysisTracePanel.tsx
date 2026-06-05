import type { AnalysisTraceItem } from '../../types/analyze';

export function AnalysisTracePanel({ analysisTrace, rejectedCount }: { analysisTrace?: AnalysisTraceItem[]; rejectedCount?: number }) {
  const trace = Array.isArray(analysisTrace) ? analysisTrace : [];

  return (
    <section style={{ display: 'grid', gap: 12, padding: 20, borderRadius: 20, background: '#fff', border: '1px solid #e6edf6' }}>
      <h2 style={{ margin: 0 }}>分析过程</h2>
      {trace.length === 0 ? <p style={{ margin: 0, color: '#64748b' }}>等待开始分析</p> : null}
      <div style={{ display: 'grid', gap: 10 }}>
        {trace.map((item) => (
          <article key={`${item.step}-${item.action}`} style={{ padding: 14, borderRadius: 16, background: '#f8fbff', border: '1px solid #e6edf6' }}>
            <p style={{ margin: 0, color: '#244b86', fontWeight: 800 }}>{item.step} · {item.status}</p>
            <p style={{ margin: '6px 0 0', color: '#334155' }}><strong>动作：</strong>{item.action}</p>
            <p style={{ margin: '4px 0 0', color: '#334155' }}><strong>发现：</strong>{item.finding}</p>
            <p style={{ margin: '4px 0 0', color: '#64748b' }}><strong>不确定性：</strong>{item.uncertainty}</p>
          </article>
        ))}
      </div>
      <p style={{ margin: 0, color: '#64748b' }}>排除无关信号：{rejectedCount ?? 0} 条</p>
    </section>
  );
}
