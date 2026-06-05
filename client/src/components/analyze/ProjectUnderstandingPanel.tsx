import type { ProjectUnderstanding } from '../../types/analyze';

function valueOrPending(value?: string | number | null) {
  if (value === undefined || value === null || value === '') return '待补充';
  return value;
}

export function ProjectUnderstandingPanel({ understanding }: { understanding?: ProjectUnderstanding }) {
  if (!understanding) return null;
  return (
    <section style={{ display: 'grid', gap: 12, padding: 20, borderRadius: 20, background: '#fff', border: '1px solid #e6edf6' }}>
      <h2 style={{ margin: 0 }}>系统理解</h2>
      <div style={{ display: 'grid', gap: 6, color: '#334155', lineHeight: 1.5 }}>
        <p><strong>产品类型：</strong>{valueOrPending(understanding.productCategory)}</p>
        <p><strong>目标用户：</strong>{valueOrPending(understanding.targetAudience)}</p>
        <p><strong>目标市场：</strong>{valueOrPending(understanding.targetMarket)}</p>
        <p><strong>商业模式：</strong>{valueOrPending(understanding.businessModel)}</p>
        <p><strong>已知条件：</strong>{Array.isArray(understanding.knownConditions) && understanding.knownConditions.length > 0 ? understanding.knownConditions.join(' / ') : '待补充'}</p>
        <p><strong>缺失条件：</strong>{Array.isArray(understanding.missingConditions) && understanding.missingConditions.length > 0 ? understanding.missingConditions.join(' / ') : '待补充'}</p>
        <p><strong>置信度：</strong>{Math.round((understanding.confidence || 0) * 100)}%</p>
      </div>
    </section>
  );
}
