import styles from './TopNav.module.css';

function currentSource() {
  const source = new URLSearchParams(window.location.search).get('source');
  return source === 'mock' || source === 'fallback' ? source : 'real';
}

export function TopNav() {
  const source = currentSource();
  const withSource = (path: string) => (path.includes('?') ? `${path}&source=${source}` : `${path}?source=${source}`);

  const navItems = [
    { label: '首页', href: withSource('/') },
    { label: '机会雷达', href: withSource('/opportunities') },
    { label: '验证工具', href: withSource('/analyze') },
    { label: '我的报告', href: withSource('/report') },
    { label: '执行支持', href: withSource('/resources') },
    { label: '验证案例', href: withSource('/cases') },
  ];

  return (
    <header className={styles.nav}>
      <div className={styles.brandRow}>
        <div>
          <h1 className={styles.title}>HotPulse</h1>
          <p className={styles.subtitle}>出海企业情报站 + MVP 前市场验证系统</p>
        </div>
        <div className={styles.actions}>
          <a className={styles.ghostButton} href={withSource('/opportunities')}>查看机会雷达</a>
          <a className={styles.primaryButton} href={withSource('/analyze')}>开始验证</a>
        </div>
      </div>
      <nav className={styles.navLinks} aria-label="主导航">
        {navItems.map((item) => (
          <a key={item.label} href={item.href} className={styles.navLink}>{item.label}</a>
        ))}
      </nav>
    </header>
  );
}
