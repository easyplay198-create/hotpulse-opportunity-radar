import { AppShell } from '../../components/layout/AppShell';
import { TopNav } from '../../components/layout/TopNav';
import { PagePurpose } from '../../components/visual/PagePurpose';

const CASES = [
  {
    title: '机会误判案例',
    scene: '团队看到海外社区讨论升温，准备直接投入完整产品开发。',
    mistake: '把热点讨论当成明确需求，没有确认目标人群和付费意向。',
    reminder: 'HotPulse 会提示该方向仍需证据链补充，不能只凭单一热度进入。',
    action: '先做 landing page + waitlist，验证点击、留资和 3-5 个有效访谈。',
  },
  {
    title: '支付风险案例',
    scene: '订阅型工具准备进入新兴市场，默认沿用欧美价格和支付方式。',
    mistake: '忽略本地支付习惯、订阅接受度和价格敏感度。',
    reminder: 'HotPulse 会把支付适配列入风险矩阵，提示先验证支付路径。',
    action: '测试 2-3 个价格锚点和支付按钮点击，不急着接完整订阅系统。',
  },
  {
    title: '本地化风险案例',
    scene: 'AI 工具准备直接翻译全站并投放多个国家。',
    mistake: '把翻译等同于本地化，没有验证具体场景表达是否有效。',
    reminder: 'HotPulse 会提示先做单市场、单场景、单页面的小样本文案测试。',
    action: '制作 1 个本地化落地页，对比标题、卖点和 CTA 的留资表现。',
  },
];

export function CasesPage() {
  return (
    <AppShell>
      <div style={{ display: 'grid', gap: 24 }}>
        <TopNav />
        <PagePurpose title="案例与模式观察" description="案例观察正在内测中，当前仅展示方法论样例，不伪装成真实客户案例。" />
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          {CASES.slice(0, 3).map((item) => (
            <article key={item.title} style={{ display: 'grid', gap: 10, background: '#fff', border: '1px solid #e2e5ea', borderRadius: 18, padding: 18 }}>
              <span style={{ width: 'fit-content', padding: '5px 10px', borderRadius: 999, background: '#eef4fb', color: '#244b86', fontSize: 12, fontWeight: 800 }}>方法论样例</span>
              <h2 style={{ margin: 0, fontSize: 18, color: '#10203d' }}>{item.title}</h2>
              <p style={{ margin: 0, color: '#5c6370', lineHeight: 1.6 }}><strong>场景：</strong>{item.scene}</p>
              <p style={{ margin: 0, color: '#5c6370', lineHeight: 1.6 }}><strong>误判点：</strong>{item.mistake}</p>
              <p style={{ margin: 0, color: '#5c6370', lineHeight: 1.6 }}><strong>提前提醒：</strong>{item.reminder}</p>
              <p style={{ margin: 0, color: '#5c6370', lineHeight: 1.6 }}><strong>验证动作：</strong>{item.action}</p>
            </article>
          ))}
        </section>
      </div>
    </AppShell>
  );
}
