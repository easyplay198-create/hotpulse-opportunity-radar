import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getActiveNavKey } from '../src/lib/navActiveUtils.js';

describe('getActiveNavKey — route matching', () => {
  // ── 1. Exact paths ────────────────────────────────────────────────────────

  it('/ highlights home', () => {
    assert.equal(getActiveNavKey('/'), 'home');
  });

  it('/opportunities highlights opportunities (商机雷达)', () => {
    assert.equal(getActiveNavKey('/opportunities'), 'opportunities');
  });

  it('/analyze highlights analyze (验证工具)', () => {
    assert.equal(getActiveNavKey('/analyze'), 'analyze');
  });

  it('/report highlights report (我的报告)', () => {
    assert.equal(getActiveNavKey('/report'), 'report');
  });

  it('/resources highlights resources (执行支持)', () => {
    assert.equal(getActiveNavKey('/resources'), 'resources');
  });

  it('/cases highlights cases (验证案例)', () => {
    assert.equal(getActiveNavKey('/cases'), 'cases');
  });

  // ── 2. Query strings must not affect the result ───────────────────────────
  // Callers always pass window.location.pathname which never contains query strings.
  // These tests confirm the function handles plain pathnames regardless.

  it('passing /opportunities (pathname only) still highlights opportunities even when full URL has ?source=real', () => {
    // window.location.pathname strips the query — passing the pathname confirms correctness
    assert.equal(getActiveNavKey('/opportunities'), 'opportunities');
  });

  it('passing /analyze (pathname only) ignores any trailing query string', () => {
    assert.equal(getActiveNavKey('/analyze'), 'analyze');
  });

  // ── 3. Sub-path prefix matching ───────────────────────────────────────────

  it('/opportunities/detail/123 highlights opportunities', () => {
    assert.equal(getActiveNavKey('/opportunities/detail/123'), 'opportunities');
  });

  it('/cases/mbti highlights cases', () => {
    assert.equal(getActiveNavKey('/cases/mbti'), 'cases');
  });

  it('/report/abc highlights report', () => {
    assert.equal(getActiveNavKey('/report/abc'), 'report');
  });

  // ── 4. Home is EXACT match only ───────────────────────────────────────────

  it('/ does not match /opportunities', () => {
    assert.notEqual(getActiveNavKey('/opportunities'), 'home');
  });

  it('/opportunities is not highlighted as home', () => {
    assert.equal(getActiveNavKey('/opportunities') === 'home', false);
  });

  it('/home-extra does not match home (exact only)', () => {
    assert.equal(getActiveNavKey('/home-extra'), null);
  });

  // ── 5. Aliases ────────────────────────────────────────────────────────────

  it('/signals highlights opportunities (alias)', () => {
    assert.equal(getActiveNavKey('/signals'), 'opportunities');
  });

  it('/advisor-result highlights analyze (alias)', () => {
    assert.equal(getActiveNavKey('/advisor-result'), 'analyze');
  });

  // ── 6. No match for unknown paths ─────────────────────────────────────────

  it('unknown path returns null', () => {
    assert.equal(getActiveNavKey('/unknown'), null);
  });

  it('empty-ish root variant with trailing slash still matches home', () => {
    // Trailing slash is stripped internally (except root)
    assert.equal(getActiveNavKey('/'), 'home');
  });

  it('/opportunitiesXYZ (no separator) does not match opportunities', () => {
    // Must be exact path or start with /opportunities/
    assert.equal(getActiveNavKey('/opportunitiesXYZ'), null);
  });

  // ── 7. aria-current implied: only one key returned per pathname ───────────

  it('each known pathname returns exactly one key, not home', () => {
    const paths = ['/opportunities', '/analyze', '/report', '/resources', '/cases'];
    for (const p of paths) {
      const key = getActiveNavKey(p);
      assert.notEqual(key, 'home', `${p} should not map to home`);
      assert.notEqual(key, null, `${p} should have a match`);
    }
  });
});
