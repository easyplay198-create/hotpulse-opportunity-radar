import { useState } from 'react';
import type { ProviderStatItem, ProviderStats } from '../types/hot';
import './DataSourceStatusPanel.css';

interface DataSourceStatusPanelProps {
  mode: 'real' | 'mock' | 'fallback';
  totalCount: number;
  providerStats?: ProviderStats;
}

const PROVIDERS: Array<{ key: keyof ProviderStats; label: string }> = [
  { key: 'hackerNews', label: 'Hacker News' },
  { key: 'appStore', label: 'Apple App Store' },
  { key: 'github', label: 'GitHub' },
  { key: 'productHunt', label: 'Product Hunt' },
  { key: 'gdelt', label: 'GDELT' },
];

function providerCount(stat?: ProviderStatItem) {
  return stat?.returnedCount ?? stat?.count ?? 0;
}

function providerStatus(stat?: ProviderStatItem) {
  if (!stat) return { label: '未返回状态', tone: 'muted' as const, detail: '' };
  if (stat.ok && providerCount(stat) > 0) return { label: '正常', tone: 'ok' as const, detail: '' };
  if (!stat.ok && stat.skippedReason) return { label: '未启用', tone: 'skipped' as const, detail: stat.skippedReason };
  if (!stat.ok && stat.error) return { label: '异常', tone: 'error' as const, detail: stat.error };
  return { label: stat.ok ? '无数据' : '未启用', tone: 'muted' as const, detail: '' };
}

function buildSummary(mode: DataSourceStatusPanelProps['mode'], providerStats?: ProviderStats) {
  if (mode === 'fallback') return '当前使用 fallback seed，不代表真实市场结论。';
  if (mode === 'mock') return '当前使用 mock 数据，用于验证信息结构，不代表真实市场结论。';
  if (!providerStats) return '真实数据源状态读取中。';

  const active = PROVIDERS
    .map(({ key, label }) => ({ label, count: providerCount(providerStats[key]), stat: providerStats[key] }))
    .filter((item) => item.count > 0)
    .map((item) => `${item.label} ${item.count}`);
  const skipped = PROVIDERS
    .filter(({ key }) => providerStats[key] && !providerStats[key]?.ok && providerStats[key]?.skippedReason)
    .map(({ label }) => `${label} 未启用`);

  return [...active, ...skipped].join(' / ') || 'real 模式已启用，但暂无 provider 明细。';
}

export function DataSourceStatusPanel({ mode, totalCount, providerStats }: DataSourceStatusPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const summary = buildSummary(mode, providerStats);

  return (
    <section className="data-source-status" aria-label="数据源状态">
      <div className="data-source-status__top">
        <div>
          <p className="data-source-status__eyebrow">数据源状态</p>
          <h2>当前模式：{mode}</h2>
          <p>{summary}</p>
        </div>
        <div className="data-source-status__count">
          <span>原始信号总数</span>
          <strong>{totalCount} 条</strong>
        </div>
      </div>

      <button type="button" className="data-source-status__toggle" onClick={() => setExpanded((value) => !value)}>
        {expanded ? '收起数据源明细' : '查看数据源明细'}
      </button>

      {expanded && (
        <div className="data-source-status__detail">
          {mode !== 'real' ? (
            <p className="data-source-status__note">
              {mode === 'fallback' ? '当前使用 fallback seed，不代表真实市场结论。' : '当前使用 mock 数据，不代表真实市场结论。'}
            </p>
          ) : (
            <ul className="data-source-status__providerList">
              {PROVIDERS.map(({ key, label }) => {
                const stat = providerStats?.[key];
                const status = providerStatus(stat);
                return (
                  <li key={key} className="data-source-status__providerRow">
                    <div>
                      <strong>{label}</strong>
                      {status.detail && <p>{status.detail}</p>}
                    </div>
                    <span className="data-source-status__returned">{providerCount(stat)} 条</span>
                    <span className={`data-source-status__badge data-source-status__badge--${status.tone}`}>{status.label}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
