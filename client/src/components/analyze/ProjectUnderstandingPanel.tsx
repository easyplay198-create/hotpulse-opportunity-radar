import type { ProjectUnderstanding } from '../../types/analyze';

export function ProjectUnderstandingPanel({ understanding }: { understanding?: ProjectUnderstanding }) {
  if (!understanding) return null;
  return (
    <section style={{ display: 'grid', gap: 12, padding: 20, borderRadius: 20, background: '#fff', border: '1px solid #e6edf6' }}>
      <h2 style={{ margin: 0 }}>系统理解</h2>
      <div style={{ display: 'grid', gap: 8, color: '#334155', lineHeight: 1.6 }}>
        <p><strong>产品类型：</strong>{understanding.productCategory}</p>
        <p><strong>目标用户：</strong>{understanding.targetAudience}</p>
        <p><strong>目标市场：</strong>{understanding.targetMarket}</p>
        <p><strong>商业模式：</strong>{understanding.businessModel}</p>
        <p><strong>已知条件：</strong>{understanding.knownConditions?.length ? understanding.knownConditions.join(' / ') : '暂无'}</p>
        <p><strong>缺失条件：</strong>{understanding.missingConditions?.length ? understanding.missingConditions.join(' / ') : '暂无'}</p>
        <p><strong>置信度：</strong>{Math.round((understanding.confidence || 0) * 100)}%</p>
      </div>
    </section>
  );
}
