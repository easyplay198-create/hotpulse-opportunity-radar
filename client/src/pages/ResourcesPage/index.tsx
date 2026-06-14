import { AppShell } from '../../components/layout/AppShell';
import { TopNav } from '../../components/layout/TopNav';
import styles from './ResourcesPage.module.css';

const RESOURCES = [
  {
    title: '市场进入判断',
    risk: '对应风险：目标市场、用户细分或进入优先级不清楚。',
    selfServe: '可自行执行：整理目标用户假设、访谈对象和停止条件。',
    optional: '支持方向：进入路径拆解、验证顺序和风险检查。',
  },
  {
    title: '本地化与支付适配',
    risk: '对应风险：语言、价格、支付方式和用户习惯没有验证。',
    selfServe: '可自行执行：测试本地化落地页、价格锚点和支付意愿。',
    optional: '支持方向：本地化检查、支付路径预审和价格反馈整理。',
  },
  {
    title: '上架与测试执行',
    risk: '对应风险：上架规则、投放素材或小预算测试动作不明确。',
    selfServe: '可自行执行：准备 24h / 7d 验证任务并记录结果。',
    optional: '支持方向：落地页、访谈、上架预审和小预算测试清单。',
  },
];

export function ResourcesPage() {
  return (
    <AppShell>
      <div className={styles.page}>
        <TopNav />
        <section className={styles.headerCard}>
          <div className={styles.kicker}>Execution Support</div>
          <h1 className={styles.title}>执行支持</h1>
          <p className={styles.subtitle}>
            决定继续之后，把验证结论拆成市场进入、本地化支付和上架测试等下一步动作。
          </p>
          <div className={styles.noteRow}>
            <span>先验证，再执行</span>
            <span>不包含订单系统</span>
            <span>不替代团队判断</span>
          </div>
        </section>

        <section className={styles.grid} aria-label="执行支持方向">
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
