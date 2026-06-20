import { useEffect, useMemo, useState } from 'react';
import { fetchOpportunities } from '../../api/fetchOpportunities';
import { buildHotspotListFromItems, getHotspotList } from '../../api/getHotspotList';
import { resolveResponseDataTierOrThrow } from '../../api/getHotspotListFromApi';
import {
  normalizeCachedOpportunitiesEntry,
  type OpportunitiesCacheEntry,
  type OpportunitiesCacheStore,
  type OpportunitiesDataSource,
} from '../../lib/opportunitiesCache';
import { AppShell } from '../../components/layout/AppShell';
import { TopNav } from '../../components/layout/TopNav';
import type { EvidenceItem, EvidenceStrength, HotItem, ProviderStats } from '../../types/hot';
import {
  buildAnalyzeHrefFromOpportunity,
  getCardObservations,
  getDrawerObservedRows,
  getKnowledgeBaseEntries,
  mapDataTierLabel,
  pickCardPrimarySource,
  PUBLIC_SIGNAL_PRESETS,
  PUBLIC_SORT_OPTIONS,
  RISK_PROVENANCE_LABEL,
  RISK_RULE_DISCLAIMER,
  shouldShowMarket,
  sortByInternalScore,
  type PublicSignalPreset,
  type PublicSortKey,
} from './presentation';
import styles from './OpportunitiesPage.module.css';

type DataSource = OpportunitiesDataSource;
type RadarTab = 'opportunities' | 'signals';
type StrengthFilter = 'all' | EvidenceStrength;
type SortKey = PublicSortKey;
type SignalPreset = PublicSignalPreset;

interface RadarOpportunity {
  item: HotItem;
  id: string;
  title: string;
  sourceLabel: string;
  sourceNames: string[];
  dataTier: DataSource;
  heat: number;
  evidenceStrength: EvidenceStrength | 'unknown';
  evidenceRank: number;
  targetMarket: string;
  hasKnownMarket: boolean;
  productType: string;
  positiveReason: string;
  riskReason: string;
  retrievedAt?: string;
  retrievedAtTime: number;
  evidence: EvidenceItem[];
}

interface FilterState {
  keyword: string;
  source: string;
  strength: StrengthFilter;
  market: string;
  sort: SortKey;
}

const ALL = 'all';
const UNKNOWN_MARKET = '市场待确认';
const OPPORTUNITIES_CACHE_KEY = 'hotpulse.opportunitiesCache.v1';

function sourceFromSearch(): DataSource {
  const source = new URLSearchParams(window.location.search).get('source');
  if (source === 'mock') return 'mock';
  if (source === 'fallback') return 'fallback';
  return 'real';
}

function initialTab(): RadarTab {
  const params = new URLSearchParams(window.location.search);
  if (window.location.pathname === '/signals') return 'signals';
  return params.get('tab') === 'signals' ? 'signals' : 'opportunities';
}

function readOpportunitiesCache(source: DataSource): OpportunitiesCacheEntry | null {
  try {
    const raw = window.sessionStorage.getItem(OPPORTUNITIES_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OpportunitiesCacheStore;
    return normalizeCachedOpportunitiesEntry(parsed?.[source], source);
  } catch {
    window.sessionStorage.removeItem(OPPORTUNITIES_CACHE_KEY);
  }
  return null;
}

function writeOpportunitiesCache(entry: OpportunitiesCacheEntry) {
  try {
    const raw = window.sessionStorage.getItem(OPPORTUNITIES_CACHE_KEY);
    const current = raw ? JSON.parse(raw) as OpportunitiesCacheStore : {};
    window.sessionStorage.setItem(OPPORTUNITIES_CACHE_KEY, JSON.stringify({
      ...(current && typeof current === 'object' ? current : {}),
      [entry.source]: entry,
    }));
  } catch {
    window.sessionStorage.removeItem(OPPORTUNITIES_CACHE_KEY);
  }
}

function dataSourceLabel(source: DataSource) {
  return mapDataTierLabel(source);
}

function strengthRank(strength?: EvidenceStrength) {
  if (strength === 'high') return 3;
  if (strength === 'medium') return 2;
  if (strength === 'low') return 1;
  return 0;
}

function validTime(value?: string) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function newestEvidenceTime(evidence: EvidenceItem[]) {
  return evidence.reduce((latest, item) => Math.max(latest, validTime(item.retrievedAt)), 0);
}

function formatTime(value?: string) {
  if (!value) return '采集时间待确认';
  const time = validTime(value);
  if (!time) return '采集时间待确认';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(time));
}

function cleanMarket(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (/^(global|unknown|n\/a|na)$/i.test(trimmed)) return null;
  if (['未明确', '待确认', '市场待确认'].includes(trimmed)) return null;
  return trimmed;
}

function bestEvidenceStrength(evidence: EvidenceItem[]) {
  let best: EvidenceStrength | 'unknown' = 'unknown';
  let bestRank = 0;
  for (const item of evidence) {
    const rank = strengthRank(item.evidenceStrength);
    if (rank > bestRank) {
      best = item.evidenceStrength;
      bestRank = rank;
    }
  }
  return { best, bestRank };
}

function compactText(value: string | undefined, fallback: string, limit = 58) {
  const text = value?.replace(/\s+/g, ' ').trim() || fallback;
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function safeExternalUrl(value?: string | null) {
  const raw = value?.trim();
  if (!raw) return null;

  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (url.hostname === 'example.com' || url.hostname.endsWith('.example.com')) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function riskReason(item: HotItem) {
  const explicitRisk = item.riskFlags?.find((risk) => risk.trim());
  if (explicitRisk) return explicitRisk;

  const risks = [
    { label: '支付路径待验证', value: item.paymentRisk ?? 0 },
    { label: '本地化表达待验证', value: item.localizationRisk ?? 0 },
    { label: '合规或平台规则待确认', value: item.complianceRisk ?? 0 },
    { label: '获客成本待验证', value: item.acquisitionRisk ?? 0 },
    { label: 'AI 成本结构待测算', value: item.aiCostRisk ?? 0 },
    { label: '竞争压力较高', value: item.competitionRisk ?? 0 },
  ].sort((a, b) => b.value - a.value);

  const topRisk = risks[0];
  return topRisk && Number.isFinite(topRisk.value) && topRisk.value > 0 ? topRisk.label : '主要风险待确认';
}

function sourceNamesFor(item: HotItem) {
  const names = new Set<string>();
  if (item.platformId?.trim()) names.add(item.platformId.trim());
  for (const evidence of item.evidence ?? []) {
    if (evidence.source?.trim()) names.add(evidence.source.trim());
  }
  return [...names];
}

function buildRadarOpportunity(item: HotItem): RadarOpportunity {
  const evidence = item.evidence ?? [];
  const sources = sourceNamesFor(item);
  const market = cleanMarket(item.targetMarket);
  const { best, bestRank } = bestEvidenceStrength(evidence);
  const retrievedAtTime = newestEvidenceTime(evidence);
  const retrievedAt = retrievedAtTime ? new Date(retrievedAtTime).toISOString() : undefined;

  return {
    item,
    id: item.id,
    title: item.title,
    sourceLabel: pickCardPrimarySource(evidence, item.platformId) || '来源待确认',
    sourceNames: sources,
    dataTier: item.dataTier,
    heat: item.heat,
    evidenceStrength: best,
    evidenceRank: bestRank,
    targetMarket: market ?? UNKNOWN_MARKET,
    hasKnownMarket: Boolean(market),
    productType: item.productType?.trim() || item.category || '产品类型待确认',
    positiveReason: compactText(item.summary || item.reasonPositive?.[0], '已有市场信号，适合进入小样本验证。'),
    riskReason: compactText(riskReason(item), '进入前仍需验证风险。'),
    retrievedAt,
    retrievedAtTime,
    evidence,
  };
}

function uniqueSorted(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
}

function sortRadarItems(items: RadarOpportunity[], sort: SortKey) {
  const ranked = sortByInternalScore(items.map((item) => item.item));
  const rankIndex = new Map(ranked.map((item, index) => [item.id, index]));
  return [...items].sort((a, b) => {
    if (sort === 'latest') return b.retrievedAtTime - a.retrievedAtTime || (rankIndex.get(a.id) ?? 0) - (rankIndex.get(b.id) ?? 0);
    if (sort === 'evidence') return b.evidenceRank - a.evidenceRank || (rankIndex.get(a.id) ?? 0) - (rankIndex.get(b.id) ?? 0);
    if (sort === 'heat') return b.heat - a.heat || (rankIndex.get(a.id) ?? 0) - (rankIndex.get(b.id) ?? 0);
    return (rankIndex.get(a.id) ?? 0) - (rankIndex.get(b.id) ?? 0);
  });
}

function filterRadarItems(items: RadarOpportunity[], filter: FilterState) {
  const keyword = filter.keyword.trim().toLowerCase();
  return items.filter((opportunity) => {
    const haystack = [
      opportunity.title,
      opportunity.productType,
      opportunity.targetMarket,
      opportunity.positiveReason,
      opportunity.riskReason,
      opportunity.item.summary,
      ...(opportunity.item.tags ?? []),
    ].join(' ').toLowerCase();

    if (keyword && !haystack.includes(keyword)) return false;
    if (filter.source !== ALL && !opportunity.sourceNames.includes(filter.source)) return false;
    if (filter.strength !== ALL && opportunity.evidenceStrength !== filter.strength) return false;
    if (filter.market !== ALL && opportunity.targetMarket !== filter.market) return false;
    return true;
  });
}

function signalPresetItems(items: RadarOpportunity[], preset: SignalPreset) {
  if (preset === 'strongEvidence') return sortRadarItems(items.filter((item) => item.evidenceRank >= 2), 'evidence');
  if (preset === 'latest') return sortRadarItems(items.filter((item) => item.retrievedAtTime > 0), 'latest');
  if (preset === 'heat') return sortRadarItems(items, 'heat');
  return sortRadarItems(items, 'score');
}

function providerEntries(providerStats?: ProviderStats) {
  if (!providerStats) return [];
  return Object.entries(providerStats).filter((entry): entry is [string, NonNullable<ProviderStats[keyof ProviderStats]>] => Boolean(entry[1]));
}

function providerName(key: string) {
  const names: Record<string, string> = {
    hackerNews: 'Hacker News',
    appStore: 'App Store',
    github: 'GitHub',
    productHunt: 'Product Hunt',
    gdelt: 'GDELT',
  };
  return names[key] ?? key;
}

function providerStatusCopy(key: string, stat: NonNullable<ProviderStats[keyof ProviderStats]>) {
  const name = providerName(key);
  if (stat.ok) return `${name}：返回 ${stat.returnedCount ?? stat.count ?? stat.fetchedCount ?? 0}`;
  const detail = `${stat.skippedReason ?? stat.error ?? ''}`.toLowerCase();
  if (key === 'productHunt' || detail.includes('token') || detail.includes('not configured')) return `${name}：未配置`;
  if (key === 'gdelt' || detail.includes('no usable') || detail.includes('no effective')) return `${name}：本次无有效结果`;
  return `${name}：本次无有效结果`;
}

function buildAnalyzeHref(opportunity?: RadarOpportunity, source: DataSource = 'mock') {
  return buildAnalyzeHrefFromOpportunity(opportunity ? {
    id: opportunity.id,
    title: opportunity.title,
    productType: opportunity.productType,
    hasKnownMarket: opportunity.hasKnownMarket,
    targetMarket: opportunity.targetMarket,
    summary: opportunity.item.summary,
    evidenceStrength: opportunity.evidenceStrength,
    riskHint: opportunity.riskReason,
  } : undefined, source);
}

export function OpportunitiesPage() {
  const initialSource = sourceFromSearch();
  const initialCache = readOpportunitiesCache(initialSource);
  const [items, setItems] = useState<HotItem[]>(() => initialCache?.opportunities ?? []);
  const [providerStats, setProviderStats] = useState<ProviderStats | undefined>(() => initialCache?.providerStats);
  const [generatedAt, setGeneratedAt] = useState<string | undefined>(() => initialCache?.generatedAt ?? initialCache?.retrievedAt);
  const [dataSource, setDataSource] = useState<DataSource>(() => initialSource);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cacheNotice, setCacheNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<RadarTab>(() => initialTab());
  const [signalPreset, setSignalPreset] = useState<SignalPreset>('composite');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterState>({
    keyword: '',
    source: ALL,
    strength: ALL,
    market: ALL,
    sort: 'score',
  });

  useEffect(() => {
    const requestedSource = sourceFromSearch();
    let cancelled = false;
    const load = async () => {
      const cached = readOpportunitiesCache(requestedSource);
      if (cached) {
        setItems(cached.opportunities);
        setProviderStats(cached.providerStats);
        setGeneratedAt(cached.generatedAt ?? cached.retrievedAt);
        setDataSource(cached.source);
      } else {
        setItems([]);
        setProviderStats(undefined);
        setGeneratedAt(undefined);
        setDataSource(requestedSource);
      }

      setLoading(true);
      setError(null);
      setCacheNotice(null);
      try {
        if (requestedSource === 'fallback') {
          const seed = await getHotspotList();
          if (cancelled) return;
          writeOpportunitiesCache({
            source: 'fallback',
            opportunities: seed.items,
            retrievedAt: new Date().toISOString(),
          });
          setItems(seed.items);
          setProviderStats(undefined);
          setGeneratedAt(undefined);
          setDataSource('fallback');
          return;
        }

        const raw = await fetchOpportunities(requestedSource === 'real' ? 'real' : undefined);
        const responseDataTier = resolveResponseDataTierOrThrow(raw.source);
        const data = buildHotspotListFromItems(raw.items, {
          dataTier: responseDataTier,
        });
        if (cancelled) return;
        const nextSource = responseDataTier;
        const retrievedAt = raw.generatedAt ?? new Date().toISOString();
        writeOpportunitiesCache({
          source: nextSource,
          opportunities: data.items,
          providerStats: raw.providerStats,
          generatedAt: raw.generatedAt,
          retrievedAt,
        });
        setItems(data.items);
        setProviderStats(raw.providerStats);
        setGeneratedAt(raw.generatedAt);
        setDataSource(nextSource);
      } catch (loadError) {
        if (cancelled) return;
        if (cached) {
          setItems(cached.opportunities);
          setProviderStats(cached.providerStats);
          setGeneratedAt(cached.generatedAt ?? cached.retrievedAt);
          setDataSource(cached.source);
          setCacheNotice('实时更新暂时失败，当前显示上次成功结果。');
          return;
        }

        const seed = await getHotspotList();
        if (cancelled) return;
        setItems(seed.items);
        setProviderStats(undefined);
        setGeneratedAt(undefined);
        setDataSource('fallback');
        setError(loadError instanceof Error ? loadError.message : '机会数据加载失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const opportunities = useMemo(() => items.map(buildRadarOpportunity), [items]);
  const sourceOptions = useMemo(() => uniqueSorted(opportunities.flatMap((item) => item.sourceNames)), [opportunities]);
  const marketOptions = useMemo(() => uniqueSorted(opportunities.filter((item) => item.hasKnownMarket).map((item) => item.targetMarket)), [opportunities]);
  const filtered = useMemo(() => sortRadarItems(filterRadarItems(opportunities, filter), filter.sort), [filter, opportunities]);
  const signalItems = useMemo(() => signalPresetItems(opportunities, signalPreset), [opportunities, signalPreset]);
  const selected = useMemo(() => opportunities.find((item) => item.id === selectedId) ?? null, [opportunities, selectedId]);
  const latestTime = useMemo(() => {
    if (generatedAt) return generatedAt;
    const newest = Math.max(...opportunities.map((item) => item.retrievedAtTime), 0);
    return newest ? new Date(newest).toISOString() : undefined;
  }, [generatedAt, opportunities]);

  const totalKnownSources = sourceOptions.length;
  const healthyProviders = providerEntries(providerStats).filter(([, stat]) => stat.ok).length;
  const isInitialLoading = loading && items.length === 0;
  const refreshNotice = loading && items.length > 0 ? '正在更新最新信号……' : null;

  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilter((current) => ({ ...current, [key]: value }));
  };

  const clearFilters = () => {
    setFilter({ keyword: '', source: ALL, strength: ALL, market: ALL, sort: 'score' });
  };

  return (
    <AppShell>
      <div className={styles.page}>
        <TopNav />

        <section className={styles.hero}>
          <div>
            <span className={styles.eyebrow}>Opportunity Radar</span>
            <h1>机会雷达</h1>
            <p>从真实市场信号中发现值得进一步验证的出海方向</p>
            <div className={styles.heroActions}>
              <a className={styles.primaryButton} href={buildAnalyzeHref(undefined, dataSource)}>开始验证自己的项目</a>
              <button className={styles.secondaryButton} type="button" onClick={() => setTab('signals')}>查看市场信号榜</button>
            </div>
          </div>
          <aside className={styles.statusPanel} aria-label="数据源状态摘要">
            <div className={styles.statusTopline}>
              <span>{dataSourceLabel(dataSource)}</span>
              <strong>{isInitialLoading ? '加载中' : `${items.length} 条信号`}</strong>
            </div>
            {refreshNotice ? <p className={styles.refreshNotice}>{refreshNotice}</p> : null}
            {cacheNotice ? <p className={styles.cacheNotice}>{cacheNotice}</p> : null}
            <div className={styles.statusGrid}>
              <span><strong>{formatTime(latestTime)}</strong><small>最近采集时间</small></span>
              <span><strong>{totalKnownSources || '待确认'}</strong><small>可见来源</small></span>
              <span><strong>{providerStats ? `已连接 ${healthyProviders} 个实时来源` : '来源状态待更新'}</strong><small>来源状态</small></span>
            </div>
            {providerStats ? (
              <div className={styles.providerList}>
                {providerEntries(providerStats).map(([key, stat]) => (
                  <span key={key} className={stat.ok ? styles.providerOk : styles.providerWarn}>
                    {providerStatusCopy(key, stat)}
                  </span>
                ))}
              </div>
            ) : (
              <p className={styles.statusHint}>来源状态待更新，当前仅展示可确认的信号数量和采集时间。</p>
            )}
          </aside>
        </section>

        {error ? (
          <section className={styles.errorState} aria-live="polite">
            <strong>API 加载失败，已切换到本地备用数据。</strong>
            <span>{error}</span>
          </section>
        ) : null}

        <section className={styles.tabs} aria-label="机会雷达视图">
          <button type="button" className={tab === 'opportunities' ? styles.tabActive : styles.tabButton} onClick={() => setTab('opportunities')}>
            机会库
          </button>
          <button type="button" className={tab === 'signals' ? styles.tabActive : styles.tabButton} onClick={() => setTab('signals')}>
            市场信号榜
          </button>
        </section>

        {tab === 'opportunities' ? (
          <section className={styles.workspace}>
            <aside className={styles.filters} aria-label="机会筛选">
              <label>
                <span>关键词搜索</span>
                <input value={filter.keyword} onChange={(event) => updateFilter('keyword', event.target.value)} placeholder="搜索标题、产品类型、风险..." />
              </label>
              <label>
                <span>来源筛选</span>
                <select value={filter.source} onChange={(event) => updateFilter('source', event.target.value)}>
                  <option value={ALL}>全部来源</option>
                  {sourceOptions.map((source) => <option key={source} value={source}>{source}</option>)}
                </select>
              </label>
              <label>
                <span>证据强度</span>
                <select value={filter.strength} onChange={(event) => updateFilter('strength', event.target.value as StrengthFilter)}>
                  <option value={ALL}>全部证据</option>
                  <option value="high">强证据</option>
                  <option value="medium">中等证据</option>
                  <option value="low">弱证据</option>
                </select>
              </label>
              <label>
                <span>目标市场</span>
                <select value={filter.market} onChange={(event) => updateFilter('market', event.target.value)}>
                  <option value={ALL}>全部已知市场</option>
                  {marketOptions.map((market) => <option key={market} value={market}>{market}</option>)}
                </select>
              </label>
              <label>
                <span>排序方式</span>
                <select value={filter.sort} onChange={(event) => updateFilter('sort', event.target.value as SortKey)}>
                  {PUBLIC_SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <button className={styles.clearButton} type="button" onClick={clearFilters}>清除筛选</button>
              <p className={styles.filterCount}>筛选结果：{filtered.length} / {opportunities.length}</p>
            </aside>

            <OpportunityGrid
              items={filtered}
              loading={isInitialLoading}
              emptyTitle="没有匹配的机会"
              emptyCopy="当前筛选组合没有结果，可以清除筛选或切换到市场信号榜查看同一批数据。"
              dataSource={dataSource}
              onSelect={setSelectedId}
            />
          </section>
        ) : (
          <section className={styles.signalBoard}>
            <div className={styles.boardHeader}>
              <div>
                <span className={styles.eyebrow}>Signal Ranking</span>
                <h2>市场信号榜</h2>
                <p>同一批机会数据的不同排序视角，不显示无依据的增长率或下载收入变化。</p>
              </div>
              <div className={styles.presetBar}>
                {PUBLIC_SIGNAL_PRESETS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    className={signalPreset === value ? styles.presetActive : styles.presetButton}
                    onClick={() => setSignalPreset(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <OpportunityGrid
              items={signalItems}
              loading={isInitialLoading}
              emptyTitle="当前榜单暂无结果"
              emptyCopy="该榜单只展示有真实字段支撑的排序结果，不使用随机数或静态趋势值。"
              dataSource={dataSource}
              onSelect={setSelectedId}
            />
          </section>
        )}

        {selected ? <OpportunityDrawer key={selected.id} opportunity={selected} dataSource={dataSource} onClose={() => setSelectedId(null)} /> : null}
      </div>
    </AppShell>
  );
}

function OpportunityGrid({
  items,
  loading,
  emptyTitle,
  emptyCopy,
  dataSource,
  onSelect,
}: {
  items: RadarOpportunity[];
  loading: boolean;
  emptyTitle: string;
  emptyCopy: string;
  dataSource: DataSource;
  onSelect: (id: string) => void;
}) {
  if (loading) {
    return (
      <section className={styles.loadingState}>
        <span className={styles.loadingPulse} />
        <strong>正在加载机会信号...</strong>
        <p>会优先读取当前选择的数据来源。</p>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className={styles.emptyState}>
        <h2>{emptyTitle}</h2>
        <p>{emptyCopy}</p>
      </section>
    );
  }

  return (
    <div className={styles.cardGrid}>
      {items.map((opportunity) => {
        const observations = getCardObservations(opportunity.evidence);
        const showProductType = opportunity.productType !== '产品类型待确认';
        const showMarket = shouldShowMarket(opportunity.targetMarket);
        return (
          <article key={opportunity.id} className={styles.opportunityCard}>
            {/* Layer 1: external source + data identity */}
            <div className={styles.cardSource}>
              <span className={styles.cardSourceName}>{opportunity.sourceLabel}</span>
              <span className={styles.cardTierDot} data-tier={opportunity.dataTier}>
                ● {mapDataTierLabel(opportunity.dataTier)}
              </span>
            </div>

            {/* Layer 2: title */}
            <h2>{opportunity.title}</h2>

            {/* Layer 3: context tags — max 2, hide Global/待确认 */}
            {(showProductType || showMarket) && (
              <div className={styles.badgeRow}>
                {showProductType && <span>{opportunity.productType}</span>}
                {showMarket && <span>{opportunity.targetMarket}</span>}
              </div>
            )}

            {/* Layer 4: external observations */}
            <div className={styles.cardObservations}>
              <span className={styles.cardObsLabel}>外部观测</span>
              {observations.length > 0
                ? observations.map((obs, i) =>
                    obs.metricsLine ? (
                      <span key={i} className={styles.cardObsMetrics}>{obs.metricsLine}</span>
                    ) : obs.fallbackTitle ? (
                      <span key={i} className={styles.cardObsFallback}>{obs.fallbackTitle}</span>
                    ) : null,
                  )
                : <span className={styles.cardObsFallback}>{opportunity.positiveReason}</span>}
            </div>

            {/* Layer 5: unverified limitations + CTA */}
            <div className={styles.cardRisk}>
              <span className={styles.cardRiskHeader}>⚠ 待验证限制</span>
              <p className={styles.cardRiskText}>
                {opportunity.riskReason}
                <span className={styles.ruleTag}> · {RISK_PROVENANCE_LABEL}</span>
              </p>
            </div>

            <div className={styles.cardFooter}>
              <button type="button" onClick={() => onSelect(opportunity.id)}>查看详情</button>
              <a href={buildAnalyzeHref(opportunity, dataSource)}>评估是否适合我 →</a>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function OpportunityDrawer({
  opportunity,
  dataSource,
  onClose,
}: {
  opportunity: RadarOpportunity;
  dataSource: DataSource;
  onClose: () => void;
}) {
  const [isKnowledgeExpanded, setIsKnowledgeExpanded] = useState(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const detailDataTier = mapDataTierLabel(opportunity.dataTier);
  const observedRows = getDrawerObservedRows(opportunity.evidence);
  const kbEntries = getKnowledgeBaseEntries(opportunity.evidence);
  const productType = opportunity.item.productType?.trim() || opportunity.item.category || '';
  const showProductType = productType && productType !== '产品类型待确认';
  const kbContentId = `knowledge-content-${opportunity.id}`;

  return (
    <div className={styles.drawerBackdrop} role="presentation">
      <aside className={styles.drawer} aria-label="机会详情">

        {/* Header — flex: 0 0 auto, never scrolls */}
        <header className={styles.drawerHeader}>
          <div>
            <span className={styles.eyebrow}>OPPORTUNITY DETAIL</span>
            <h2>{opportunity.title}</h2>
            {showProductType && (
              <span className={styles.productTypeTag}>{productType}</span>
            )}
            <div className={styles.drawerHeaderMeta}>
              <span>{opportunity.sourceLabel}</span>
              <span className={styles.metaSep}>·</span>
              <span className={styles.drawerTierLabel} data-tier={opportunity.dataTier}>
                ● {detailDataTier}
              </span>
              <span className={styles.metaSep}>·</span>
              <span>{formatTime(opportunity.retrievedAt)}</span>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭详情">×</button>
        </header>

        {/* Scrollable content area — flex: 1 1 auto */}
        <div className={styles.drawerContent}>

          {/* Observed external data zone — white */}
          <div className={styles.drawerObsZone}>
            <div className={styles.drawerObsHeader}>
              <span>外部观测</span>
              <span className={styles.provenanceTag}>
                外部可验证<span className={styles.provenanceSub}> · observed</span>
              </span>
            </div>
            {observedRows.length > 0
              ? observedRows.map((row, i) => {
                  const safeUrl = safeExternalUrl(row.rawUrl);
                  return (
                    <div key={i} className={styles.drawerObsRow}>
                      <span className={styles.drawerObsSource}>{row.sourceName}</span>
                      <span className={`${styles.drawerObsValue}${row.isWeakSignal ? ` ${styles.drawerObsWeak}` : ''}`}>
                        {row.primaryValue}
                      </span>
                      {row.secondaryValue && (
                        <span className={styles.drawerObsSub}>{row.secondaryValue}</span>
                      )}
                      {safeUrl && (
                        <a href={safeUrl} target="_blank" rel="noreferrer" className={styles.drawerObsLink}>
                          打开原始来源 ↗
                        </a>
                      )}
                    </div>
                  );
                })
              : <p className={styles.drawerObsFallback}>{opportunity.positiveReason}</p>}
          </div>

          {/* Unverified limitations zone — light amber */}
          <div className={styles.drawerRiskZone}>
            <div className={styles.drawerRiskHeader}>
              <span>待验证限制</span>
              <span className={styles.provenanceTagWarn}>{RISK_PROVENANCE_LABEL}</span>
            </div>
            <div className={styles.drawerRiskItem}>
              <span className={styles.drawerRiskIcon}>⚠</span>
              <div>
                <p className={styles.drawerRiskText}>{opportunity.riskReason}</p>
                <p className={styles.drawerRiskDisclaimer}>{RISK_RULE_DISCLAIMER}</p>
              </div>
            </div>
          </div>

          {/* Knowledge base zone — header always visible, content collapsed on mobile */}
          {kbEntries.length > 0 && (
            <section className={styles.knowledgeSection}>
              <div className={styles.knowledgeHeader}>
                <span className={styles.provenanceTagGray}>
                  内部知识库<span className={styles.provenanceSub}> · knowledge_base</span>
                </span>
                <span>系统内部补充</span>
                <button
                  type="button"
                  className={styles.knowledgeToggle}
                  aria-expanded={isKnowledgeExpanded}
                  aria-controls={kbContentId}
                  onClick={() => setIsKnowledgeExpanded((v) => !v)}
                >
                  {isKnowledgeExpanded ? '收起内部补充' : '展开内部补充'}
                </button>
              </div>
              <div
                id={kbContentId}
                className={styles.knowledgeContent}
                data-expanded={isKnowledgeExpanded ? 'true' : 'false'}
              >
                {kbEntries.map((entry, i) => (
                  <div key={i} className={styles.kbRow}>
                    <span className={styles.kbRowTitle}>{entry.title}</span>
                    <span className={styles.kbRowMeta}>用于辅助市场进入判断</span>
                    <span className={styles.kbRowMeta}>无外部链接</span>
                  </div>
                ))}
              </div>
            </section>
          )}

        </div>

        {/* Footer — flex: 0 0 auto, always at viewport bottom */}
        <footer className={styles.drawerFooter}>
          <a className={styles.primaryButton} href={buildAnalyzeHref(opportunity, dataSource)}>
            评估是否适合我 →
          </a>
          <button className={styles.secondaryButton} type="button" onClick={onClose}>
            返回机会列表
          </button>
        </footer>

      </aside>
    </div>
  );
}
