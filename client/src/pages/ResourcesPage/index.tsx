import { AppShell } from '../../components/layout/AppShell';
import { TopNav } from '../../components/layout/TopNav';
import { PagePurpose } from '../../components/visual/PagePurpose';

const RESOURCES = [
  { title: '支付', problem: '确认目标市场用户是否能顺畅完成试付或订阅。', timing: '当报告提示支付风险较高，或目标市场支付习惯不确定时。', test: '先做价格锚点、支付按钮点击和试付路径测试，不急着接完整计费系统。', risk: '不要把点击支付按钮等同于真实付费意愿。' },
  { title: '本地化', problem: '验证目标用户是否理解你的卖点、场景和 CTA。', timing: '当产品需要进入日本、东南亚、拉美等语言和文化差异明显市场时。', test: '先本地化 1 个落地页或 1 段核心流程，比较留资和访谈反馈。', risk: '翻译不等于本地化，场景表达错误会直接影响转化。' },
  { title: '上架', problem: '判断 App Store、插件市场或平台审核是否会成为进入瓶颈。', timing: '当报告提示合规、上架或平台规则风险时。', test: '先整理上架清单、政策要求和同类产品规则，不直接投入完整开发。', risk: '忽略平台规则可能导致 MVP 完成后无法上线。' },
  { title: '投流', problem: '测试第一批用户获取成本和关键词/素材方向。', timing: '当你已经有表达页，需要验证点击、留资或预约成本时。', test: '用小预算测试 2-3 组文案或目标人群，只观察早期信号。', risk: '小样本投放只能判断方向，不能代表稳定获客成本。' },
  { title: 'AI 成本', problem: '估算推理、token、图片或音视频生成成本是否压缩毛利。', timing: '当产品依赖大模型调用、生成式图片、语音或 Agent 工作流时。', test: '先测单次任务成本和用户可接受价格，再决定是否扩大功能范围。', risk: '不要在未测算单位经济前承诺低价无限使用。' },
];

export function ResourcesPage() {
  return (
    <AppShell>
      <div style={{ display: 'grid', gap: 24 }}>
        <TopNav />
        <PagePurpose title="执行资源说明" description="报告后的执行资源说明，不是强制服务，也不是销售广告。先验证，再决定是否投入。" />
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          {RESOURCES.map((item) => (
            <article key={item.title} style={{ display: 'grid', gap: 10, background: '#fff', border: '1px solid #e2e5ea', borderRadius: 18, padding: 18 }}>
              <span style={{ width: 'fit-content', padding: '5px 10px', borderRadius: 999, background: '#eef4fb', color: '#244b86', fontSize: 12, fontWeight: 800 }}>{item.title}</span>
              <p style={{ margin: 0, color: '#5c6370', lineHeight: 1.6 }}><strong>能解决的问题：</strong>{item.problem}</p>
              <p style={{ margin: 0, color: '#5c6370', lineHeight: 1.6 }}><strong>何时需要：</strong>{item.timing}</p>
              <p style={{ margin: 0, color: '#5c6370', lineHeight: 1.6 }}><strong>低成本测试：</strong>{item.test}</p>
              <p style={{ margin: 0, color: '#9a3412', lineHeight: 1.6 }}><strong>风险提醒：</strong>{item.risk}</p>
            </article>
          ))}
        </section>
      </div>
    </AppShell>
  );
}
