import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildMvpValidationReportText } from '../src/lib/buildMvpValidationReportText.js';
import { toPublicBrandText } from '../src/lib/publicBrand.js';
import type { HotItem } from '../src/types/hot.js';

function reportItem(): HotItem {
  return {
    id: 'report-brand-1',
    platformId: 'knowledge-base',
    title: 'AI workflow opportunity',
    category: 'AI',
    heat: 60,
    interaction: 55,
    valueScore: 68,
    verdict: 'watch',
    summary: 'Test opportunity',
    tags: ['AI'],
    publishedAt: '2026-07-18T00:00:00.000Z',
    targetMarket: 'Japan',
    productType: 'AI 工具',
    dataTier: 'real',
    evidence: [{
      title: '市场进入知识库',
      source: 'HotPulse Market Knowledge',
      type: 'industry_report',
      evidenceStrength: 'medium',
      retrievedAt: '2026-07-18T00:00:00.000Z',
      url: null,
    }],
  };
}

describe('PRAXON public copy', () => {
  it('removes legacy brand names from copied report text', () => {
    const report = buildMvpValidationReportText(reportItem());

    assert.match(report, /PRAXON MVP 出海验证快评摘要/);
    assert.match(report, /PRAXON Market Knowledge/);
    assert.equal(/hotpulse|万道/i.test(report), false);
  });

  it('normalizes legacy dynamic text before public display', () => {
    assert.equal(toPublicBrandText('万道出海 · HotPulse'), '派克森商机雷达 · PRAXON');
  });
});
