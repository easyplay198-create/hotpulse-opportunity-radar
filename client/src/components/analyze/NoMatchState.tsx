import type { RejectedSignal } from '../../types/analyze';

export function NoMatchState({ evidenceGaps, rejectedSignals, nextStep }: { evidenceGaps?: string[]; rejectedSignals?: RejectedSignal[]; nextStep?: string }) {
  const gaps = evidenceGaps && evidenceGaps.length > 0
    ? evidenceGaps
    : ['当前证据不足，建议先补充目标市场、产品形态和变现方式，再做小样本验证。'];
  const rejected = (rejectedSignals ?? []).slice(0, 3);

  return (
    <section style={{ display: 'grid', gap: 16, padding: 20, borderRadius: 22, background: '#fff7ed', border: '1px solid #fed7aa' }}>
      <h2 style={{ margin: 0, color: '#9a3412' }}>当前没有找到足够相关的可追溯机会</h2>
      <p style={{ margin: 0, color: '#9a3412', lineHeight: 1.7 }}>HotPulse 不建议基于无关信号做进入判断。</p>
      <div style={{ display: 'grid', gap: 10 }}>
        <h3 style={{ margin: 0, color: '#9a3412', fontSize: 16 }}>证据缺口</h3>
        <ul style={{ margin: 0, paddingLeft: 18, color: '#9a3412', lineHeight: 1.7 }}>
          {gaps.map((gap) => <li key={gap}>{gap}</li>)}
        </ul>
      </div>
      {rejected.length > 0 ? (
        <div style={{ display: 'grid', gap: 10 }}>
          <h3 style={{ margin: 0, color: '#9a3412', fontSize: 16 }}>已排除的无关信号</h3>
          {rejected.map((item) => (
            <article key={`${item.title}-${item.finalRelevanceScore}`} style={{ padding: 14, borderRadius: 16, background: '#fff', border: '1px solid #fecaca' }}>
              <strong>{item.title}</strong>
              <p style={{ margin: '6px 0 0', color: '#9a3412' }}>相关性分：{item.finalRelevanceScore} · {item.rejectionReason}</p>
            </article>
          ))}
        </div>
      ) : null}
      <p style={{ margin: 0, color: '#9a3412', lineHeight: 1.7 }}><strong>下一步：</strong>{nextStep || '先明确目标市场、产品形态和变现方式，再用 landing page、访谈和小预算测试验证需求。'}</p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" style={{ border: 'none', borderRadius: 999, padding: '10px 14px', background: '#244b86', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>继续补充条件</button>
        <a href="/opportunities?tab=signals&source=real" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, padding: '10px 14px', background: '#eef4fb', color: '#244b86', fontWeight: 800, textDecoration: 'none' }}>查看市场信号榜</a>
      </div>
    </section>
  );
}
