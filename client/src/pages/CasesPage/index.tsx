import { AppShell } from '../../components/layout/AppShell';
import { TopNav } from '../../components/layout/TopNav';
import { PagePurpose } from '../../components/visual/PagePurpose';

const CASES = [
  {
    title: '看到热度，但先停在预验证',
    scene: '团队发现海外社区讨论升温，准备直接投入完整产品开发。',
    lesson: '热度不是需求确认，先验证目标用户、付费意愿和可触达渠道。',
    action: '用 landing page、waitlist 和 3-5 个有效访谈确认是否继续。',
  },
  {
    title: '订阅工具先验证支付路径',
    scene: 'SaaS 工具准备进入新兴市场，沿用原有价格和支付方式。',
    lesson: '本地支付习惯、订阅接受度和价格敏感度会直接影响进入判断。',
    action: '测试 2-3 个价格锚点和支付按钮点击，再决定是否接入完整订阅。',
  },
  {
    title: '本地化不等于直接翻译',
    scene: 'AI 工具计划快速翻译多语言站点并同步投放。',
    lesson: '文案、案例、单位、价格和使用场景都需要单市场小样本验证。',
    action: '先制作一个本地化落地页，对比卖点和 CTA 的留资表现。',
  },
];

export function CasesPage() {
  return (
    <AppShell>
      <div style={{ display: 'grid', gap: 24 }}>
        <TopNav />
        <PagePurpose
          title="验证案例"
          description="展示典型项目如何验证、停止或调整方向，帮助团队避免把市场信号误当进入结论。"
        />
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          {CASES.map((item) => (
            <article key={item.title} style={{ display: 'grid', gap: 10, background: '#fff', border: '1px solid #e2e5ea', borderRadius: 18, padding: 18 }}>
              <span style={{ width: 'fit-content', padding: '5px 10px', borderRadius: 999, background: '#eef4fb', color: '#244b86', fontSize: 12, fontWeight: 800 }}>验证样例</span>
              <h2 style={{ margin: 0, fontSize: 18, color: '#10203d' }}>{item.title}</h2>
              <p style={{ margin: 0, color: '#5c6370', lineHeight: 1.6 }}><strong>场景：</strong>{item.scene}</p>
              <p style={{ margin: 0, color: '#5c6370', lineHeight: 1.6 }}><strong>判断：</strong>{item.lesson}</p>
              <p style={{ margin: 0, color: '#5c6370', lineHeight: 1.6 }}><strong>动作：</strong>{item.action}</p>
            </article>
          ))}
        </section>
      </div>
    </AppShell>
  );
}
