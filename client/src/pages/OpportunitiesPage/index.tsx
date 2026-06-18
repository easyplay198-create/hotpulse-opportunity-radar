import { useEffect, useMemo, useState } from 'react';
import { fetchOpportunities } from '../../api/fetchOpportunities';
import { buildHotspotListFromItems, getHotspotList } from '../../api/getHotspotList';
import { resolveResponseDataTierOrThrow } from '../../api/getHotspotListFromApi';
import { AppShell } from '../../components/layout/AppShell';
import { TopNav } from '../../components/layout/TopNav';
import type { EvidenceItem, EvidenceStrength, HotItem, ProviderStats } from '../../types/hot';
import styles from './OpportunitiesPage.module.css';

type DataSource = 'real' | 'mock' | 'fallback';
type RadarTab = 'opportunities' | 'signals';
type StatusFilter = 'all' | 'do_now' | 'watch' | 'skip';
type StrengthFilter = 'all' | EvidenceStrength;
type SortKey = 'score' | 'latest' | 'evidence' | 'heat';
type SignalPreset = 'composite' | 'highScore' | 'strongEvidence' | 'latest' | 'heat';

interface RadarOpportunity {
  item: HotItem;
  id: string;
  title: string;
  sourceLabel: string;
  sourceNames: string[];
  score: number;
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
  status: StatusFilter;
  evidence: EvidenceItem[];
}

interface FilterState {
  keyword: string;
  source: string;
  strength: StrengthFilter;
  status: StatusFilter;
  market: string;
  sort: SortKey;
}

interface OpportunitiesCacheEntry {
  source: DataSource;
  opportunities: HotItem[];
  providerStats?: ProviderStats;
  generatedAt?: string;
  retrievedAt: string;
}

type OpportunitiesCacheStore = Partial<Record<DataSource, OpportunitiesCacheEntry>>;

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

function isHotItemArray(value: unknown): value is HotItem[] {
  return Array.isArray(value) && value.every((item) => (
    item
    && typeof item === 'object'
    && typeof (item as HotItem).id === 'string'
    && typeof (item as HotItem).title === 'string'
  ));
}

function readOpportunitiesCache(source: DataSource): OpportunitiesCacheEntry | null {
  try {
    const raw = window.sessionStorage.getItem(OPPORTUNITIES_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OpportunitiesCacheStore;
    const cached = parsed?.[source];
    if (
      cached?.source === source
      && isHotItemArray(cached.opportunities)
      && typeof cached.retrievedAt === 'string'
    ) {
      return cached;
    }
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
  if (source === 'real') return '真实信号';
  return '预验证样本';
}

function strengthLabel(strength: StrengthFilter | 'unknown') {
  if (strength === 'high') return '强证据';
  if (strength === 'medium') return '中等证据';
  if (strength === 'low') return '弱证据';
  if (strength === 'unknown') return '证据待确认';
  return '全部证据';
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

function isInternalKnowledgeEvidence(evidence: EvidenceItem) {
  return evidence.source === 'HotPulse Market Knowledge'
    || evidence.metadata?.knowledgeType === 'static_market_entry';
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

  const negativeReason = item.reasonNegative?.find((reason) => reason.trim());
  if (negativeReason) return negativeReason;

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
    sourceLabel: sources.slice(0, 2).join(' / ') || '来源待确认',
    sourceNames: sources,
    score: item.valueScore,
    heat: item.heat,
    evidenceStrength: best,
    evidenceRank: bestRank,
    targetMarket: market ?? UNKNOWN_MARKET,
    hasKnownMarket: Boolean(market),
    productType: item.productType?.trim() || item.category || '产品类型待确认',
    positiveReason: compactText(item.reasonPositive?.[0] || item.summary, '已有市场信号，适合进入小样本验证。'),
    riskReason: compactText(riskReason(item), '进入前仍需验证风险。'),
    retrievedAt,
    retrievedAtTime,
    status: item.verdict,
    evidence,
  };
}

function uniqueSorted(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
}

function sortRadarItems(items: RadarOpportunity[], sort: SortKey) {
  return [...items].sort((a, b) => {
    if (sort === 'latest') return b.retrievedAtTime - a.retrievedAtTime || b.score - a.score;
    if (sort === 'evidence') return b.evidenceRank - a.evidenceRank || b.score - a.score;
    if (sort === 'heat') return b.heat - a.heat || b.score - a.score;
    return b.score - a.score || b.evidenceRank - a.evidenceRank;
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
    if (filter.status !== ALL && opportunity.status !== filter.status) return false;
    if (filter.market !== ALL && opportunity.targetMarket !== filter.market) return false;
    return true;
  });
}

function signalPresetItems(items: RadarOpportunity[], preset: SignalPreset) {
  if (preset === 'highScore') return sortRadarItems(items.filter((item) => item.score >= 75), 'score');
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

function sourceQuery(source: DataSource) {
  return `source=${encodeURIComponent(source)}`;
}

function buildAnalyzeHref(opportunity?: RadarOpportunity, source: DataSource = 'mock') {
  if (!opportunity) return `/analyze?${sourceQuery(source)}`;
  const market = opportunity.hasKnownMarket ? opportunity.targetMarket : '';
  const query = [
    opportunity.title,
    opportunity.productType,
    market ? `目标市场：${market}` : '',
    opportunity.item.summary,
    `验证重点：${opportunity.positiveReason}`,
    `主要风险：${opportunity.riskReason}`,
  ].filter(Boolean).join('，').slice(0, 600);
  const params = new URLSearchParams();
  params.set('source', 'real');
  params.set('auto', '1');
  params.set('opportunityId', opportunity.id);
  params.set('q', query);
  if (market) params.set('targetMarket', market);
  if (opportunity.productType) params.set('productType', opportunity.productType);
  return `/analyze?${params.toString()}`;
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
    status: ALL,
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
        const nextSource = requestedSource === 'real' ? 'real' : 'mock';
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
    setFilter({ keyword: '', source: ALL, strength: ALL, status: ALL, market: ALL, sort: 'score' });
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
                <span>机会状态</span>
                <select value={filter.status} onChange={(event) => updateFilter('status', event.target.value as StatusFilter)}>
                  <option value={ALL}>全部状态</option>
                  <option value="do_now">优先验证</option>
                  <option value="watch">持续观察</option>
                  <option value="skip">暂缓进入</option>
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
                  <option value="score">综合分排序</option>
                  <option value="latest">最新采集时间</option>
                  <option value="evidence">证据强度排序</option>
                  <option value="heat">热度排序</option>
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
                {[
                  ['composite', '综合机会榜'],
                  ['highScore', '高分机会榜'],
                  ['strongEvidence', '证据较强榜'],
                  ['latest', '最新发现榜'],
                  ['heat', '热度榜'],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={signalPreset === key ? styles.presetActive : styles.presetButton}
                    onClick={() => setSignalPreset(key as SignalPreset)}
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

        {selected ? <OpportunityDrawer opportunity={selected} dataSource={dataSource} onClose={() => setSelectedId(null)} /> : null}
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
      {items.map((opportunity) => (
        <article key={opportunity.id} className={styles.opportunityCard}>
          <div className={styles.cardTopline}>
            <span>{opportunity.sourceLabel}</span>
            <strong>{opportunity.score}</strong>
          </div>
          <h2>{opportunity.title}</h2>
          <div className={styles.badgeRow}>
            <span>{strengthLabel(opportunity.evidenceStrength)}</span>
            <span>{opportunity.targetMarket}</span>
            <span>{opportunity.productType}</span>
          </div>
          <div className={styles.scoreBar} aria-label={`综合分 ${opportunity.score}`}>
            <i style={{ width: `${Math.max(4, Math.min(100, opportunity.score))}%` }} />
          </div>
          <div className={styles.reasonGrid}>
            <p><strong>理由</strong>{opportunity.positiveReason}</p>
            <p><strong>风险</strong>{opportunity.riskReason}</p>
          </div>
          <div className={styles.cardFooter}>
            <span>{formatTime(opportunity.retrievedAt)}</span>
            <div>
              <button type="button" onClick={() => onSelect(opportunity.id)}>查看详情</button>
              <a href={buildAnalyzeHref(opportunity, dataSource)}>评估是否适合我</a>
            </div>
          </div>
        </article>
      ))}
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
  return (
    <div className={styles.drawerBackdrop} role="presentation">
      <aside className={styles.drawer} aria-label="机会详情">
        <div className={styles.drawerHeader}>
          <div>
            <span className={styles.eyebrow}>Opportunity Detail</span>
            <h2>{opportunity.title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭详情">×</button>
        </div>

        <section className={styles.drawerScoreGrid}>
          <span><strong>{opportunity.score}</strong><small>综合分</small></span>
          <span><strong>{strengthLabel(opportunity.evidenceStrength)}</strong><small>证据强度</small></span>
          <span><strong>{opportunity.targetMarket}</strong><small>目标市场</small></span>
          <span><strong>{opportunity.productType}</strong><small>产品类型</small></span>
        </section>

        <section className={styles.drawerSection}>
          <h3>核心判断</h3>
          <p>{opportunity.positiveReason}</p>
          <p className={styles.riskCopy}>{opportunity.riskReason}</p>
        </section>

        <section className={styles.drawerSection}>
          <h3>证据列表</h3>
          {opportunity.evidence.length > 0 ? (
            <div className={styles.evidenceList}>
              {opportunity.evidence.map((evidence) => {
                const safeUrl = safeExternalUrl(evidence.url);
                const isInternalKnowledge = isInternalKnowledgeEvidence(evidence);
                return (
                  <article key={`${opportunity.id}-${evidence.source}-${evidence.url || evidence.title}`}>
                    <span>{evidence.source} · {strengthLabel(evidence.evidenceStrength)}</span>
                    <strong>{evidence.title}</strong>
                    <small>{formatTime(evidence.retrievedAt)}</small>
                    {safeUrl ? <a href={safeUrl} target="_blank" rel="noreferrer">打开原始来源</a> : null}
                    {isInternalKnowledge ? (
                      <small>HotPulse 内部知识库 · 用于辅助市场进入判断 · 无外部原始链接</small>
                    ) : null}
                    {!safeUrl && !isInternalKnowledge ? <small>该条证据暂无可打开的原始来源</small> : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <p>当前机会没有返回可打开的证据链接。</p>
          )}
        </section>

        <div className={styles.drawerActions}>
          <a className={styles.primaryButton} href={buildAnalyzeHref(opportunity, dataSource)}>评估是否适合我</a>
          <button className={styles.secondaryButton} type="button" onClick={onClose}>返回机会列表</button>
        </div>
      </aside>
    </div>
  );
}
