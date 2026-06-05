import styles from './TopNav.module.css';

function currentSource() {
  const source = new URLSearchParams(window.location.search).get('source');
  return source === 'real' || source === 'mock' || source === 'fallback' ? source : 'mock';
}

export function TopNav() {
  const source = currentSource();
  const withSource = (path: string) => (path.includes('?') ? `${path}&source=${source}` : `${path}?source=${source}`);

  const navItems = [
    { label: '首页', href: withSource('/') },
    { label: '今日简报', href: withSource('/briefing') },
    { label: '机会库', href: withSource('/opportunities') },
    { label: '验证工具', href: withSource('/analyze') },
    { label: '案例观察', href: withSource('/cases') },
    { label: '资源中心', href: withSource('/resources') },
    { label: '市场信号榜', href: withSource('/signals') },
    { label: '报告页', href: withSource('/report') },
  ];

  return (
    <header className={styles.nav}>
      <div className={styles.brandRow}>
        <div>
          <h1 className={styles.title}>HotPulse</h1>
          <p className={styles.subtitle}>出海商机雷达与验证系统</p>
        </div>
        <div className={styles.actions}>
          <a className={styles.ghostButton} href={withSource('/analyze')}>登录</a>
          <a className={styles.primaryButton} href={withSource('/analyze')}>开始分析</a>
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
