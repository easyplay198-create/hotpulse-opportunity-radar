import { getActiveNavKey, type NavKey } from '../../lib/navActiveUtils';
import styles from './TopNav.module.css';

function currentSource() {
  const source = new URLSearchParams(window.location.search).get('source');
  return source === 'mock' || source === 'fallback' ? source : 'real';
}

interface NavItem {
  label: string;
  href: string;
  navKey: NavKey;
}

export function TopNav() {
  const source = currentSource();
  const activeKey = getActiveNavKey(window.location.pathname);
  const withSource = (path: string) =>
    path.includes('?') ? `${path}&source=${source}` : `${path}?source=${source}`;

  const navItems: NavItem[] = [
    { label: '首页', href: withSource('/'), navKey: 'home' },
    { label: '机会雷达', href: withSource('/opportunities'), navKey: 'opportunities' },
    { label: '验证工具', href: withSource('/analyze'), navKey: 'analyze' },
    { label: '我的报告', href: withSource('/report'), navKey: 'report' },
    { label: '执行支持', href: withSource('/resources'), navKey: 'resources' },
    { label: '验证案例', href: withSource('/cases'), navKey: 'cases' },
  ];

  return (
    <header className={styles.nav}>
      <div className={styles.brandRow}>
        <div>
          <h1 className={styles.title}>PRAXON</h1>
          <p className={styles.subtitle}>AI驱动的出海商机发现与验证系统</p>
        </div>
        <div className={styles.actions}>
          <a className={styles.ghostButton} href={withSource('/opportunities')}>查看机会雷达</a>
          <a className={styles.primaryButton} href={withSource('/analyze')}>开始验证</a>
        </div>
      </div>
      <nav className={styles.navLinks} aria-label="主导航">
        {navItems.map((item) => {
          const isActive = activeKey === item.navKey;
          return (
            <a
              key={item.label}
              href={item.href}
              className={isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink}
              aria-current={isActive ? 'page' : undefined}
            >
              {item.label}
            </a>
          );
        })}
      </nav>
    </header>
  );
}
