import type { ProviderStats } from '../types/hot';
import { summarizeProviderStatusLabel, type ProviderStatusVM } from './decisionViewModels';

function buildStatusFromProvider(name: string, stats?: { ok: boolean; count?: number; fetchedCount?: number; returnedCount?: number; error?: string; skippedReason?: string }): ProviderStatusVM {
  const hasCount = typeof stats?.count === 'number' || typeof stats?.fetchedCount === 'number' || typeof stats?.returnedCount === 'number';
  const hasCacheLikeData = typeof stats?.returnedCount === 'number' || typeof stats?.fetchedCount === 'number';
  const hasConfigProblem = Boolean(stats?.error || stats?.skippedReason || /token|config|missing/i.test(`${stats?.error ?? ''} ${stats?.skippedReason ?? ''}`));

  let status: ProviderStatusVM['status'] = 'unknown';
  if (stats?.ok) status = 'connected';
  else if (hasCacheLikeData) status = 'cache';
  else if (hasCount) status = 'sample';
  else if (hasConfigProblem) status = 'missing_config';
  else if (stats) status = 'pending';

  const count = stats?.count ?? stats?.fetchedCount ?? stats?.returnedCount;
  const note = hasConfigProblem
    ? '缺少配置'
    : status === 'connected'
      ? '已连接'
      : status === 'cache'
        ? '使用缓存'
        : status === 'sample'
          ? '样本信号'
          : '待接入';

  return {
    id: name.toLowerCase().replace(/\s+/g, '-'),
    label: name,
    status,
    statusLabel: summarizeProviderStatusLabel(status),
    count,
    note,
  };
}

export function buildProviderStatusVMs(providerStats?: ProviderStats): ProviderStatusVM[] {
  return [
    buildStatusFromProvider('Hacker News', providerStats?.hackerNews),
    buildStatusFromProvider('App Store', providerStats?.appStore),
    buildStatusFromProvider('GitHub', providerStats?.github),
    buildStatusFromProvider('Product Hunt', providerStats?.productHunt),
    buildStatusFromProvider('Local Seed', providerStats?.gdelt),
  ];
}
