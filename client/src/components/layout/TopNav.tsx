import styles from './TopNav.module.css';

export function TopNav() {
  return (
    <header className={styles.nav}>
      <h1 className={styles.title}>万道出海 · 机会雷达</h1>
      <p className={styles.subtitle}>
        面向 AI 应用、工具出海、游戏出海团队，帮助快速理解目标市场、判断进入机会、降低前期决策成本。
      </p>
      <p className={styles.hint}>HotPulse Market Opportunity Radar · Mock 数据原型 · 2026-05-29</p>
    </header>
  );
}
