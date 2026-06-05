import type { ProjectEvaluationItem } from '../../types/analyze';

export function ProjectEvaluationPanel({ items }: { items?: ProjectEvaluationItem[] }) {
  const list = Array.isArray(items) ? items : [];

  if (list.length === 0) {
    return (
      <section style={{ display: 'grid', gap: 12, padding: 20, borderRadius: 20, background: '#fff', border: '1px solid #e6edf6' }}>
        <h2 style={{ margin: 0 }}>项目评估</h2>
        <p style={{ margin: 0, color: '#64748b' }}>当前没有可用评估结果，请先补充输入。</p>
      </section>
    );
  }

  return (
    <section style={{ display: 'grid', gap: 12, padding: 20, borderRadius: 20, background: '#fff', border: '1px solid #e6edf6' }}>
      <h2 style={{ margin: 0 }}>项目评估</h2>
      <div style={{ display: 'grid', gap: 10 }}>
        {list.map((item) => (
          <article key={item.label} style={{ padding: 14, borderRadius: 16, background: '#f8fbff', border: '1px solid #e6edf6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <strong>{item.label}</strong>
              <span>{item.score}</span>
            </div>
            <div style={{ marginTop: 8, height: 8, borderRadius: 999, background: '#e2e8f0' }}>
              <div style={{ width: `${Math.max(0, Math.min(100, item.score))}%`, height: '100%', borderRadius: 999, background: item.score >= 70 ? '#16a34a' : item.score >= 40 ? '#f59e0b' : '#94a3b8' }} />
            </div>
            <p style={{ margin: '8px 0 0', color: '#64748b' }}>{item.explanation}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
