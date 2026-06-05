import type { ClarifyingQuestion } from '../../types/analyze';

export function ClarifyingQuestionsPanel({ questions }: { questions?: ClarifyingQuestion[] }) {
  const list = Array.isArray(questions) ? questions : [];
  if (list.length === 0) return null;

  return (
    <section style={{ display: 'grid', gap: 12, padding: 20, borderRadius: 20, background: '#fff', border: '1px solid #e6edf6' }}>
      <h2 style={{ margin: 0 }}>需要你确认的关键问题</h2>
      <p style={{ margin: 0, color: '#64748b' }}>回答这些问题后，可以进一步提高验证准确度。</p>
      <div style={{ display: 'grid', gap: 12 }}>
        {list.map((item) => (
          <article key={item.id} style={{ padding: 14, borderRadius: 16, background: '#f8fbff', border: '1px solid #e6edf6' }}>
            <p style={{ margin: 0, fontWeight: 800, color: '#10203d' }}>{item.text}</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
              {item.options.map((option) => <span key={option} style={{ padding: '6px 10px', borderRadius: 999, background: '#eef4fb', color: '#244b86', fontSize: 12, fontWeight: 800 }}>{option}</span>)}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
