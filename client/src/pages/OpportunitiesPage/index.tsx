import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchOpportunities, type OpportunitiesResponse } from '../../api/fetchOpportunities';
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
  mapDataTierLabel,
  pickCardPrimarySource,
  PUBLIC_SIGNAL_PRESETS,
  PUBLIC_SORT_OPTIONS,
  sortByInternalScore,
  type PublicSignalPreset,
  type PublicSortKey,
} from './presentation';
import { buildAnalyzeHrefBySource, buildAnalyzeHrefFromOpportunity } from '../../lib/opportunityAnalyzeHref';
import { OpportunityDecisionCard } from './components/OpportunityDecisionCard';
import { OpportunityDecisionDrawer } from './components/OpportunityDecisionDrawer';
import {
  applyFirstPageSuccess,
  applyLoadMoreError,
  applyLoadMoreSuccess,
  createInitialPaginationState,
  loadedCountCopy,
  uniqueAppendItems,
  type OpportunityPaginationState,
} from './paginationModel';
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
const REAL_PAGE_SIZE = 20;

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
  if (!opportunity) return buildAnalyzeHrefBySource(source);
  return buildAnalyzeHrefFromOpportunity({
    id: opportunity.id,
    title: opportunity.title,
    productType: opportunity.productType,
    targetMarket: opportunity.hasKnownMarket ? opportunity.targetMarket : undefined,
    primarySource: opportunity.sourceLabel,
    evidence: opportunity.evidence,
    summary: opportunity.item.summary,
    evidenceStrength: opportunity.evidenceStrength,
    riskHint: opportunity.riskReason,
  });
}

function mapOpportunitiesResponse(raw: OpportunitiesResponse) {
  const responseDataTier = resolveResponseDataTierOrThrow(raw.source);
  const data = buildHotspotListFromItems(raw.items, {
    dataTier: responseDataTier,
  });
  return {
    dataTier: responseDataTier,
    items: data.items,
    providerStats: raw.providerStats,
    generatedAt: raw.generatedAt,
    pageInfo: raw.pageInfo,
  };
}

export function OpportunitiesPage() {
  const initialSource = sourceFromSearch();
  const initialCache = readOpportunitiesCache(initialSource);
  const [items, setItems] = useState<HotItem[]>(() => initialCache?.opportunities ?? []);
  const [providerStats, setProviderStats] = useState<ProviderStats | undefined>(() => initialCache?.providerStats);
  const [generatedAt, setGeneratedAt] = useState<string | undefined>(() => initialCache?.generatedAt ?? initialCache?.retrievedAt);
  const [dataSource, setDataSource] = useState<DataSource>(() => initialSource);
  const [pagination, setPagination] = useState<OpportunityPaginationState>(() => createInitialPaginationState(initialCache?.opportunities ?? []));
  const [initialLoading, setInitialLoading] = useState(true);
  const [initialError, setInitialError] = useState<string | null>(null);
  const [refreshFailed, setRefreshFailed] = useState(false);
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
  const requestGenerationRef = useRef(0);
  const loadMoreInFlightRef = useRef(false);

  useEffect(() => {
    const requestedSource = sourceFromSearch();
    const generation = requestGenerationRef.current + 1;
    requestGenerationRef.current = generation;
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

      setInitialLoading(true);
      setInitialError(null);
      setCacheNotice(null);
      setPagination(createInitialPaginationState(cached?.opportunities ?? []));
      try {
        if (requestedSource === 'fallback') {
          const seed = await getHotspotList();
          if (cancelled || requestGenerationRef.current !== generation) return;
          writeOpportunitiesCache({
            source: 'fallback',
            opportunities: seed.items,
            retrievedAt: new Date().toISOString(),
          });
          setItems(seed.items);
          setProviderStats(undefined);
          setGeneratedAt(undefined);
          setPagination(createInitialPaginationState(seed.items));
          setDataSource('fallback');
          return;
        }

        const raw = await fetchOpportunities(requestedSource === 'real' ? { source: 'real', limit: REAL_PAGE_SIZE } : undefined);
        const responseDataTier = resolveResponseDataTierOrThrow(raw.source);
        const data = buildHotspotListFromItems(raw.items, {
          dataTier: responseDataTier,
        });
        if (cancelled || requestGenerationRef.current !== generation) return;
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
        setPagination((current) => applyFirstPageSuccess(current, {
          items: data.items,
          pageInfo: raw.pageInfo,
          providerStats: raw.providerStats,
          generatedAt: raw.generatedAt,
        }));
        setDataSource(nextSource);
      } catch (loadError) {
        if (cancelled || requestGenerationRef.current !== generation) return;
        if (cached) {
          setItems(cached.opportunities);
          setProviderStats(cached.providerStats);
          setGeneratedAt(cached.generatedAt ?? cached.retrievedAt);
          setDataSource(cached.source);
          setPagination(createInitialPaginationState(cached.opportunities));
          setCacheNotice('实时更新暂时失败，当前显示上次成功结果。');
          return;
        }

        const seed = await getHotspotList();
        if (cancelled || requestGenerationRef.current !== generation) return;
        setItems(seed.items);
        setProviderStats(undefined);
        setGeneratedAt(undefined);
        setDataSource('fallback');
        setPagination(createInitialPaginationState(seed.items));
        setInitialError(loadError instanceof Error ? loadError.message : '机会数据加载失败');
      } finally {
        if (!cancelled && requestGenerationRef.current === generation) setInitialLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
      requestGenerationRef.current += 1;
    };
  }, []);

  const refreshSignalPool = async () => {
    const generation = requestGenerationRef.current + 1;
    requestGenerationRef.current = generation;
    loadMoreInFlightRef.current = false;
    setInitialLoading(true);
    setInitialError(null);
    setRefreshFailed(false);
    setCacheNotice(null);
    setPagination(createInitialPaginationState());

    try {
      const raw = await fetchOpportunities({ source: 'real', limit: REAL_PAGE_SIZE });
      const mapped = mapOpportunitiesResponse(raw);
      if (requestGenerationRef.current !== generation) return;
      const retrievedAt = raw.generatedAt ?? new Date().toISOString();
      writeOpportunitiesCache({
        source: mapped.dataTier,
        opportunities: mapped.items,
        providerStats: raw.providerStats,
        generatedAt: raw.generatedAt,
        retrievedAt,
      });
      setItems(mapped.items);
      setProviderStats(raw.providerStats);
      setGeneratedAt(raw.generatedAt);
      setDataSource(mapped.dataTier);
      setPagination((current) => applyFirstPageSuccess(current, {
        items: mapped.items,
        pageInfo: mapped.pageInfo,
        providerStats: raw.providerStats,
        generatedAt: raw.generatedAt,
      }));
    } catch (refreshError) {
      if (requestGenerationRef.current !== generation) return;
      setInitialError(refreshError instanceof Error ? refreshError.message : '机会数据加载失败');
      setRefreshFailed(true);
    } finally {
      if (requestGenerationRef.current === generation) setInitialLoading(false);
    }
  };

  const loadMoreSignals = async () => {
    const cursor = pagination.nextCursor;
    if (!cursor || pagination.loadMoreLoading || loadMoreInFlightRef.current) return;
    const generation = requestGenerationRef.current;
    loadMoreInFlightRef.current = true;
    setPagination((current) => ({
      ...current,
      loadMoreLoading: true,
      loadMoreError: null,
      cursorExpired: false,
      invalidCursor: false,
    }));

    try {
      const raw = await fetchOpportunities({ source: 'real', cursor });
      const mapped = mapOpportunitiesResponse(raw);
      if (requestGenerationRef.current !== generation) return;
      setPagination((current) => {
        return applyLoadMoreSuccess(current, {
          items: mapped.items,
          pageInfo: mapped.pageInfo,
          providerStats: raw.providerStats,
          generatedAt: raw.generatedAt,
        });
      });
      setItems((current) => uniqueAppendItems(current, mapped.items));
      setProviderStats(raw.providerStats);
      setGeneratedAt(raw.generatedAt ?? generatedAt);
    } catch (loadMoreError) {
      if (requestGenerationRef.current !== generation) return;
      setPagination((current) => applyLoadMoreError(current, loadMoreError));
    } finally {
      if (requestGenerationRef.current === generation) {
        loadMoreInFlightRef.current = false;
      }
    }
  };

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
  const isInitialLoading = initialLoading && items.length === 0;
  const refreshNotice = initialLoading && items.length > 0 ? '正在更新最新信号……' : null;
  const activeVisibleCount = tab === 'opportunities' ? filtered.length : signalItems.length;
  const loadedCopy = loadedCountCopy(pagination, activeVisibleCount);

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

        {initialError ? (
          <section className={styles.errorState} aria-live="polite">
            {refreshFailed ? (
              <>
                <strong>刷新失败，当前显示上次成功结果。</strong>
                <span>{initialError}</span>
                <button type="button" onClick={() => { void refreshSignalPool(); }}>重新刷新</button>
              </>
            ) : (
              <>
                <strong>API 加载失败，已切换到本地备用数据。</strong>
                <span>{initialError}</span>
              </>
            )}
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
              onSelect={setSelectedId}
            />
          </section>
        )}

        <PaginationControls
          pagination={pagination}
          loadedCopy={loadedCopy}
          filteredCount={activeVisibleCount}
          onLoadMore={loadMoreSignals}
          onRefresh={refreshSignalPool}
        />

        {selected ? <OpportunityDecisionDrawer key={selected.id} item={selected.item} onClose={() => setSelectedId(null)} /> : null}
      </div>
    </AppShell>
  );
}

function PaginationControls({
  pagination,
  loadedCopy,
  filteredCount,
  onLoadMore,
  onRefresh,
}: {
  pagination: OpportunityPaginationState;
  loadedCopy: string | null;
  filteredCount: number;
  onLoadMore: () => void;
  onRefresh: () => void;
}) {
  if (!pagination.pageInfo) return null;

  const error = pagination.loadMoreError;
  const isFilteredEmptyWithMore = filteredCount === 0 && pagination.items.length > 0 && pagination.hasMore;

  return (
    <section className={styles.loadMorePanel} aria-live="polite">
      {loadedCopy ? <p className={styles.loadMoreCount}>{loadedCopy}</p> : null}
      {isFilteredEmptyWithMore ? (
        <p className={styles.loadMoreHint}>当前已加载的信号中暂无匹配项，候选池仍有更多内容。</p>
      ) : null}

      {error?.kind === 'network' ? (
        <div className={styles.loadMoreError}>
          <span>更多信号加载失败，请重试</span>
          <button type="button" onClick={onLoadMore} disabled={pagination.loadMoreLoading}>重新加载</button>
        </div>
      ) : null}

      {error?.kind === 'invalid_cursor' ? (
        <div className={styles.loadMoreError}>
          <span>分页状态异常，请刷新信号池</span>
          <button type="button" onClick={onRefresh}>刷新信号池</button>
        </div>
      ) : null}

      {error?.kind === 'cursor_expired' ? (
        <div className={styles.loadMoreError}>
          <span>当前信号快照已过期</span>
          <small>为避免新旧数据顺序混合，需要重新获取最新信号池。</small>
          <button type="button" onClick={onRefresh}>刷新信号池</button>
        </div>
      ) : null}

      {!error && pagination.hasMore ? (
        <button
          className={styles.loadMoreButton}
          type="button"
          onClick={onLoadMore}
          disabled={pagination.loadMoreLoading}
        >
          {pagination.loadMoreLoading ? '正在加载更多信号…' : '加载更多信号'}
        </button>
      ) : null}

      {!error && !pagination.hasMore ? (
        <p className={styles.loadMoreDone}>已加载全部信号</p>
      ) : null}
    </section>
  );
}

function OpportunityGrid({
  items,
  loading,
  emptyTitle,
  emptyCopy,
  onSelect,
}: {
  items: RadarOpportunity[];
  loading: boolean;
  emptyTitle: string;
  emptyCopy: string;
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
    <div className={styles.decisionQueue} aria-label="信号评审队列">
      {items.map((opportunity) => (
        <OpportunityDecisionCard
          key={opportunity.id}
          item={opportunity.item}
          onOpenBrief={() => onSelect(opportunity.id)}
        />
      ))}
    </div>
  );
}
