import type { ParsedIntent } from '../../types/analyze';

export function IntentUnderstandingCard({ parsedIntent }: { parsedIntent?: ParsedIntent }) {
  if (!parsedIntent) return null;

  return (
    <section style={{ display: 'grid', gap: 12, padding: 20, borderRadius: 22, background: '#fff', border: '1px solid #e6edf6' }}>
      <h2 style={{ margin: 0, color: '#10203d' }}>系统理解的验证方向</h2>
      <div style={{ display: 'grid', gap: 8, color: '#556274', lineHeight: 1.6 }}>
        <p><strong>产品类型：</strong>{parsedIntent.productCategory}</p>
        <p><strong>目标市场：</strong>{parsedIntent.targetMarket}</p>
        <p><strong>目标用户：</strong>{parsedIntent.audience}</p>
        <p><strong>商业模式：</strong>{parsedIntent.businessModel}</p>
        <p><strong>置信度：</strong>{Math.round(parsedIntent.confidence * 100)}%</p>
        <p><strong>解释：</strong>{parsedIntent.interpretationNote}</p>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {parsedIntent.sensitivityFlags.map((flag) => <span key={flag} style={{ padding: '6px 10px', borderRadius: 999, background: '#eef4fb', color: '#244b86', fontSize: 12, fontWeight: 800 }}>{flag}</span>)}
      </div>
    </section>
  );
}
