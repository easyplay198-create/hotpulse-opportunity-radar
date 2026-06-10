import { AppShell } from '../../components/layout/AppShell';
import { TopNav } from '../../components/layout/TopNav';
import styles from './ResourcesPage.module.css';

const RESOURCES = [
  {
    title: '本地化验证支持',
    risk: '对应风险：目标市场表达不确定。',
    selfServe: '你可以自己做：翻译 landing page，测试 3 个卖点，访谈 5 个目标用户。',
    optional: '可选协助：本地化验证支持。',
  },
  {
    title: '支付闭环验证支持',
    risk: '对应风险：付费意愿和收款路径未验证。',
    selfServe: '你可以自己做：设置最小付费页，测试 3 个价格点，收集付费反馈。',
    optional: '可选协助：支付闭环验证支持。',
  },
  {
    title: '应用上架预审支持',
    risk: '对应风险：商店审核、权限、隐私政策和合规不确定。',
    selfServe: '你可以自己做：检查权限、隐私政策、商店文案和包体风险。',
    optional: '可选协助：上架预审支持。',
  },
  {
    title: 'AI 成本结构检查',
    risk: '对应风险：token 成本影响毛利和定价。',
    selfServe: '你可以自己做：测算单用户调用成本、免费额度、付费墙和毛利区间。',
    optional: '可选协助：AI 成本结构检查。',
  },
  {
    title: '7 天验证执行支持',
    risk: '对应风险：团队没有时间或经验完成首轮验证。',
    selfServe: '你可以自己做：按照行动计划执行，记录验证结果，按停止条件判断是否继续。',
    optional: '可选协助：7 天验证执行支持。',
  },
];

export function ResourcesPage() {
  return (
    <AppShell>
      <div className={styles.page}>
        <TopNav />
        <section className={styles.headerCard}>
          <div className={styles.kicker}>Execution Support</div>
          <h1 className={styles.title}>验证后的可选执行支持</h1>
          <p className={styles.subtitle}>
            HotPulse 不会在判断前推服务。只有当验证结果显示值得继续推进，且某个风险或行动项需要执行支持时，这些资源才作为可选协助出现。
          </p>
          <div className={styles.noteRow}>
            <span>不是必须购买</span>
            <span>先完成验证</span>
            <span>不建议进入时不推荐执行服务</span>
            <span>用户可以自己执行</span>
          </div>
        </section>

        <section className={styles.grid} aria-label="验证后的可选执行支持">
          {RESOURCES.map((item) => (
            <article key={item.title} className={styles.card}>
              <h2>{item.title}</h2>
              <p><strong>{item.risk}</strong></p>
              <p>{item.selfServe}</p>
              <p className={styles.optional}>{item.optional}</p>
            </article>
          ))}
        </section>
      </div>
    </AppShell>
  );
}
