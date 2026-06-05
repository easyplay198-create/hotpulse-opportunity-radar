import type { MvpValidationStep } from '../../types/analyze';

export function MvpValidationPlanPanel({ steps, fallback }: { steps?: MvpValidationStep[]; fallback?: string[] }) {
  const list = Array.isArray(steps) && steps.length > 0 ? steps : (Array.isArray(fallback) ? fallback.map((item, index) => ({ day: `Day ${index + 1}`, goal: item, action: item, successMetric: '待确认', stopCondition: '待确认', requiredResource: '待确认' })) : []);

  if (list.length === 0) {
    return (
      <section style={{ display: 'grid', gap: 12, padding: 20, borderRadius: 20, background: '#fff', border: '1px solid #e6edf6' }}>
        <h2 style={{ margin: 0 }}>7 天 MVP 路径</h2>
        <p style={{ margin: 0, color: '#64748b' }}>当前没有可用的验证路径。</p>
      </section>
    );
  }

  return (
    <section style={{ display: 'grid', gap: 12, padding: 20, borderRadius: 20, background: '#fff', border: '1px solid #e6edf6' }}>
      <h2 style={{ margin: 0 }}>7 天 MVP 路径</h2>
      <div style={{ display: 'grid', gap: 10 }}>
        {list.map((item) => (
          <article key={`${item.day}-${item.goal}`} style={{ padding: 14, borderRadius: 16, background: '#f8fbff', border: '1px solid #e6edf6' }}>
            <p style={{ margin: 0, color: '#244b86', fontWeight: 800 }}>{item.day}</p>
            <p style={{ margin: '6px 0 0', color: '#10203d' }}><strong>目标：</strong>{item.goal}</p>
            <p style={{ margin: '4px 0 0', color: '#334155' }}><strong>动作：</strong>{item.action}</p>
            <p style={{ margin: '4px 0 0', color: '#334155' }}><strong>成功指标：</strong>{item.successMetric}</p>
            <p style={{ margin: '4px 0 0', color: '#334155' }}><strong>停止条件：</strong>{item.stopCondition}</p>
            <p style={{ margin: '4px 0 0', color: '#334155' }}><strong>所需资源：</strong>{item.requiredResource}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
