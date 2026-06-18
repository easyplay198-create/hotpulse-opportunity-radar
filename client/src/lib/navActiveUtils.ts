/**
 * Centralized navigation active-state matching logic.
 * Takes window.location.pathname (never includes query string) and returns
 * which nav item should be highlighted.
 */

export type NavKey = 'home' | 'opportunities' | 'analyze' | 'report' | 'resources' | 'cases';

interface NavRoute {
  key: NavKey;
  /**
   * Canonical paths for this nav item.
   * 'home' is exact-matched; all others use prefix matching
   * so sub-paths like /opportunities/detail still activate the parent.
   */
  paths: string[];
  /** When true, only exact equality is considered (used for '/'). */
  exact?: boolean;
}

const NAV_ROUTES: NavRoute[] = [
  { key: 'home', paths: ['/'], exact: true },
  { key: 'opportunities', paths: ['/opportunities', '/signals'] },
  { key: 'analyze', paths: ['/analyze', '/advisor-result'] },
  { key: 'report', paths: ['/report'] },
  { key: 'resources', paths: ['/resources'] },
  { key: 'cases', paths: ['/cases'] },
];

/**
 * Returns the NavKey that should be marked active for the given pathname,
 * or null when no route matches.
 *
 * @param pathname - window.location.pathname (no query string, no hash)
 */
export function getActiveNavKey(pathname: string): NavKey | null {
  // Strip trailing slash except for the root path itself
  const p = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;

  for (const route of NAV_ROUTES) {
    if (route.exact) {
      if (route.paths.includes(p)) return route.key;
    } else {
      if (route.paths.some((rp) => p === rp || p.startsWith(rp + '/'))) {
        return route.key;
      }
    }
  }
  return null;
}
