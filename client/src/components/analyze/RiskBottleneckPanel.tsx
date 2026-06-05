import type { RiskBottleneck } from '../../types/analyze';

export function RiskBottleneckPanel({ items }: { items?: RiskBottleneck[] }) {
  const list = Array.isArray(items) ? items : [];

  if (list.length === 0) {
    return (
      <section style={{ display: 'grid', gap: 12, padding: 20, borderRadius: 20, background: '#fff', border: '1px solid #e6edf6' }}>
        <h2 style={{ margin: 0 }}>风险卡点</h2>
        <p style={{ margin: 0, color: '#64748b' }}>当前风险需要通过补充条件进一步判断</p>
      </section>
    );
  }

  return (
    <section style={{ display: 'grid', gap: 12, padding: 20, borderRadius: 20, background: '#fff', border: '1px solid #e6edf6' }}>
      <h2 style={{ margin: 0 }}>风险卡点</h2>
      <div style={{ display: 'grid', gap: 10 }}>
        {list.slice(0, 3).map((item) => (
          <article key={`${item.title}-${item.level}`} style={{ padding: 14, borderRadius: 16, background: '#fff7ed', border: '1px solid #fed7aa' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <strong>{item.title}</strong>
              <span>{item.level}</span>
            </div>
            <p style={{ margin: '6px 0 0', color: '#9a3412', lineHeight: 1.5 }}><strong>为什么：</strong>{item.why}</p>
            <p style={{ margin: '4px 0 0', color: '#9a3412', lineHeight: 1.5 }}><strong>影响：</strong>{item.impact}</p>
            <p style={{ margin: '4px 0 0', color: '#9a3412', lineHeight: 1.5 }}><strong>低成本验证：</strong>{item.validationAction}</p>
            <p style={{ margin: '4px 0 0', color: '#9a3412', lineHeight: 1.5 }}><strong>动作判断：</strong>{item.stopOrAdjust}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
