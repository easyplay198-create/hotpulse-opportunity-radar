import type { MvpValidationStep } from '../../types/analyze';

function toSteps(steps?: MvpValidationStep[], fallback?: string[]) {
  if (Array.isArray(steps) && steps.length > 0) return steps;
  if (Array.isArray(fallback) && fallback.length > 0) {
    return fallback.map((step, index) => ({
      day: `Day ${index + 1}`,
      goal: step,
      action: step,
      successMetric: '完成阶段性验证',
      stopCondition: '如果没有有效反馈则暂停。',
      requiredResource: '轻量测试资源',
    }));
  }
  return [];
}

export function MvpValidationPlanPanel({ steps, fallback }: { steps?: MvpValidationStep[]; fallback?: string[] }) {
  const list = toSteps(steps, fallback);

  if (list.length === 0) {
    return (
      <section style={{ display: 'grid', gap: 12, padding: 20, borderRadius: 20, background: '#fff', border: '1px solid #e6edf6' }}>
        <h2 style={{ margin: 0 }}>7 天 MVP 路径</h2>
        <p style={{ margin: 0, color: '#64748b' }}>暂无可用路径，请先补充项目输入。</p>
      </section>
    );
  }

  return (
    <section style={{ display: 'grid', gap: 12, padding: 20, borderRadius: 20, background: '#fff', border: '1px solid #e6edf6' }}>
      <h2 style={{ margin: 0 }}>7 天 MVP 路径</h2>
      <div style={{ display: 'grid', gap: 10 }}>
        {list.map((item) => (
          <article key={`${item.day}-${item.goal}`} style={{ padding: 14, borderRadius: 16, background: '#f8fbff', border: '1px solid #e6edf6' }}>
            <strong>{item.day}</strong>
            <p style={{ margin: '6px 0 0', color: '#334155', lineHeight: 1.5 }}><strong>目标：</strong>{item.goal}</p>
            <p style={{ margin: '4px 0 0', color: '#334155', lineHeight: 1.5 }}><strong>动作：</strong>{item.action}</p>
            <p style={{ margin: '4px 0 0', color: '#334155', lineHeight: 1.5 }}><strong>成功指标：</strong>{item.successMetric}</p>
            <p style={{ margin: '4px 0 0', color: '#334155', lineHeight: 1.5 }}><strong>停止条件：</strong>{item.stopCondition}</p>
            <p style={{ margin: '4px 0 0', color: '#334155', lineHeight: 1.5 }}><strong>所需资源：</strong>{item.requiredResource}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
