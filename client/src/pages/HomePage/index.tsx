import { useEffect, useMemo, useState } from 'react';
import { getHotspotList } from '../../api/getHotspotList';
import { getHotspotListFromApi } from '../../api/getHotspotListFromApi';
import { AppShell } from '../../components/layout/AppShell';
import { TopNav } from '../../components/layout/TopNav';
import { RadarScanner } from '../../components/visual/RadarScanner';
import { buildDiscoverableOpportunities, type DiscoverableOpportunity } from '../../lib/buildDiscoverableOpportunities';
import type { HotItem, ProviderStats } from '../../types/hot';
import styles from './HomePage.module.css';

type SettledDataSource = 'mock' | 'real' | 'fallback';
type DataSource = 'connecting' | SettledDataSource;

type ProviderState = 'ok' | 'watch' | 'skipped' | 'cache';

type ProviderRow = {
  name: string;
  state: ProviderState;
  detail: string;
  value: string;
};

interface HotspotSummary {
  totalCount: number;
  doNowCount: number;
  watchCount: number;
  skipCount: number;
  averageScore: number;
}

function buildHotspotSummary(items: HotItem[]): HotspotSummary {
  const totalCount = items.length;
  const doNowCount = items.filter((item) => item.verdict === 'do_now').length;
  const watchCount = items.filter((item) => item.verdict === 'watch').length;
  const skipCount = items.filter((item) => item.verdict === 'skip').length;
  const averageScore = totalCount === 0 ? 0 : Math.round(items.reduce((sum, item) => sum + item.valueScore, 0) / totalCount);
  return { totalCount, doNowCount, watchCount, skipCount, averageScore };
}

function providerTone(dataSource: DataSource): 'real' | 'mock' | 'fallback' | 'connecting' {
  if (dataSource === 'connecting') return 'connecting';
  if (dataSource === 'real') return 'real';
  if (dataSource === 'fallback') return 'fallback';
  return 'mock';
}

function buildProviderRows(providerStats?: ProviderStats, dataSource?: DataSource): ProviderRow[] {
  const hnCount = providerStats?.hackerNews?.fetchedCount ?? providerStats?.hackerNews?.returnedCount ?? providerStats?.hackerNews?.count ?? 0;
  const appStoreCount = providerStats?.appStore?.returnedCount ?? providerStats?.appStore?.fetchedCount ?? providerStats?.appStore?.count ?? 0;
  const githubCount = providerStats?.github?.returnedCount ?? providerStats?.github?.fetchedCount ?? providerStats?.github?.count ?? 0;
  const productHuntOk = providerStats?.productHunt?.ok;
  const rows: ProviderRow[] = [
    {
      name: 'Hacker News',
      state: providerStats?.hackerNews?.ok ? 'ok' : 'watch',
      detail: providerStats?.hackerNews?.ok ? 'fetched' : 'watch',
      value: `${hnCount} fetched`,
    },
    {
      name: 'App Store',
      state: providerStats?.appStore?.ok ? 'ok' : 'watch',
      detail: providerStats?.appStore?.ok ? 'returned' : 'watch',
      value: `${appStoreCount} returned`,
    },
    {
      name: 'GitHub',
      state: providerStats?.github?.ok ? 'ok' : 'cache',
      detail: providerStats?.github?.ok ? 'matched' : 'placeholder',
      value: githubCount > 0 ? `${githubCount} matched` : 'placeholder',
    },
    {
      name: 'Product Hunt',
      state: productHuntOk ? 'ok' : 'skipped',
      detail: productHuntOk ? 'ok' : 'Missing token',
      value: productHuntOk ? `${providerStats?.productHunt?.returnedCount ?? providerStats?.productHunt?.fetchedCount ?? providerStats?.productHunt?.count ?? 0} returned` : 'Skipped',
    },
  ];

  if (dataSource === 'fallback') {
    rows[2] = { name: 'GitHub', state: 'cache', detail: 'Last updated 2h ago', value: 'cache' };
  }

  return rows;
}

function scoreBand(score: number) {
  if (score >= 80) return 'Strong signal';
  if (score >= 60) return 'Worth testing';
  if (score >= 40) return 'Watch first';
  return 'Avoid for now';
}

function opportunityVerdictLabel(index: number) {
  if (index === 0) return 'Do Now / 优先验证';
  if (index === 1) return 'Watch / 小预算观察';
  return 'Niche Test / 细分市场测试';
}

function opportunityActionCopy(index: number) {
  if (index === 0) return '24 小时内验证 landing page + 10 个目标用户访谈';
  if (index === 1) return '先收集 20 条竞品评论，再判断是否做 MVP';
  return '用 1 个细分关键词测试广告点击和留资意愿';
}

function riskChips(item: DiscoverableOpportunity) {
  const bag = `${item.title} ${item.whyNow} ${item.validationHypothesis}`.toLowerCase();
  const chips: Array<{ label: string; tone: 'low' | 'medium' | 'high' }> = [];
  if (/pay|payment|订阅|收费/.test(bag)) chips.push({ label: 'Payment', tone: 'medium' });
  if (/local|本地|语言|market/.test(bag)) chips.push({ label: 'Localization', tone: 'medium' });
  if (/competition|competitor|替代|workflow/.test(bag)) chips.push({ label: 'Competition', tone: 'high' });
  if (chips.length === 0) chips.push({ label: 'Risk: Moderate', tone: 'low' });
  return chips.slice(0, 3);
}

function LoadingPreview({ isRealSource }: { isRealSource?: boolean }) {
  return (
    <section className={styles.stateCard} aria-label="加载市场机会数据">
      <p className={styles.stateEyebrow}>{isRealSource ? '真实数据连接中' : '数据加载中'}</p>
      <h2 className={styles.stateTitle}>{isRealSource ? '正在连接真实数据源...' : '正在扫描市场信号...'}</h2>
      <p className={styles.stateDescription}>{isRealSource ? '正在唤醒真实数据服务，首次访问可能需要 30-60 秒。' : '正在整理机会分、进入建议和风险维度。'}</p>
      <div className={styles.skeletonGrid} aria-hidden="true">
        <span className={styles.skeletonBlock} />
        <span className={styles.skeletonBlock} />
        <span className={styles.skeletonBlock} />
      </div>
    </section>
  );
}

function ErrorPreview() {
  return (
    <section className={`${styles.stateCard} ${styles.stateCardError}`} aria-label="市场机会数据加载失败">
      <p className={styles.stateEyebrow}>数据不可用</p>
      <h2 className={styles.stateTitle}>市场机会数据加载失败</h2>
      <p className={styles.stateDescription}>请检查数据源或稍后重试</p>
      <button className={styles.reloadButton} type="button" onClick={() => window.location.reload()}>
        重新加载
      </button>
    </section>
  );
}

function SystemStatusStrip({ summary, dataSource, providerStats }: { summary: HotspotSummary; dataSource: DataSource; providerStats?: ProviderStats }) {
  const statusTone = providerTone(dataSource);
  const providerRows = buildProviderRows(providerStats, dataSource);
  const productHuntRow = providerRows.find((row) => row.name === 'Product Hunt');
  const githubRow = providerRows.find((row) => row.name === 'GitHub');
  return (
    <section className={styles.systemStrip} aria-label="系统状态">
      <div className={styles.systemStat}>
        <span className={styles.systemStatLabel}>数据源状态</span>
        <strong className={`${styles.systemStatValue} ${styles[`systemStatValue--${statusTone}`]}`}>{dataSource === 'fallback' ? '使用缓存' : dataSource === 'connecting' ? '连接中' : '正常'}</strong>
        <span className={styles.systemStatHint}>{providerStats?.productHunt?.ok ? '所有数据源可用' : '部分数据源跳过或使用缓存'}</span>
      </div>
      <div className={styles.systemStat}>
        <span className={styles.systemStatLabel}>今日抓取量</span>
        <strong className={styles.systemStatValue}>{summary.totalCount}</strong>
        <span className={styles.systemStatHint}>{providerRows.map((row) => row.detail).join(' · ')}</span>
      </div>
      <div className={styles.systemStat}>
        <span className={styles.systemStatLabel}>可验证机会数</span>
        <strong className={styles.systemStatValue}>{Math.min(3, summary.doNowCount + summary.watchCount)}</strong>
        <span className={styles.systemStatHint}>{summary.doNowCount > 0 ? '优先验证 2 个以上机会' : '先观察再筛选'}</span>
      </div>
      <div className={styles.systemStat}>
        <span className={styles.systemStatLabel}>当前建议</span>
        <strong className={styles.systemStatValue}>{summary.doNowCount > 0 ? '立即验证' : summary.watchCount > 0 ? '继续观察' : '暂缓进入'}</strong>
        <span className={styles.systemStatHint}>{productHuntRow?.detail === 'Missing token' ? 'Product Hunt 跳过' : githubRow?.detail === 'placeholder' ? 'GitHub 使用占位信号' : '继续看 Top 3'}</span>
      </div>
    </section>
  );
}

function ProviderStatsWidget({ providerStats, dataSource }: { providerStats?: ProviderStats; dataSource: DataSource }) {
  const providerRows = buildProviderRows(providerStats, dataSource);
  const hasTokenGap = providerStats?.productHunt && !providerStats.productHunt.ok;
  return (
    <section className={styles.providerWidget} aria-label="数据源状态">
      <div className={styles.sectionHeader}>
        <div>
          <h2>数据源状态</h2>
          <p>查看哪些数据源正常、跳过或使用缓存。</p>
        </div>
        <span className={styles.providerBadge}>{dataSource === 'fallback' ? 'Cache' : dataSource === 'connecting' ? 'Connecting' : 'Live'}</span>
      </div>
      <div className={styles.providerList}>
        {providerRows.map((row) => (
          <article key={row.name} className={styles.providerRow}>
            <div className={styles.providerNameBlock}>
              <span className={`${styles.providerDot} ${styles[`providerDot--${row.state}`]}`} />
              <strong>{row.name}</strong>
            </div>
            <span className={styles.providerValue}>{row.value}</span>
            <span className={styles.providerState}>{row.detail}</span>
          </article>
        ))}
      </div>
      {hasTokenGap ? (
        <p className={styles.providerNote}>Product Hunt 已跳过：缺少 API Token。你仍可使用 HN、App Store 和缓存数据继续分析。</p>
      ) : null}
    </section>
  );
}

export function HomePage() {
  const searchParams = new URLSearchParams(window.location.search);
  const previewMode = searchParams.get('preview');
  const sourceParam = searchParams.get('source');
  const reportId = searchParams.get('report');
  const isLoadingPreview = previewMode === 'loading';
  const isErrorPreview = previewMode === 'error';
  const apiSource = sourceParam === 'real' ? 'real' : undefined;
  const [items, setItems] = useState<HotItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [dataSource, setDataSource] = useState<DataSource>(apiSource === 'real' ? 'connecting' : 'mock');
  const [providerStats, setProviderStats] = useState<ProviderStats | undefined>(undefined);

  const summary = useMemo(() => buildHotspotSummary(items), [items]);
  const discoverableOpportunities = useMemo(() => buildDiscoverableOpportunities(items), [items]);
  const resolvedDataSource: SettledDataSource = dataSource === 'connecting' ? 'real' : dataSource;
  const topOpportunities = useMemo(() => discoverableOpportunities.slice(0, 3), [discoverableOpportunities]);
  const inputValue = '例如：AI 简历工具出海日本市场 / 订阅制英语学习 App 进入东南亚 / 开发者工具面向欧美独立团队';

  useEffect(() => {
    if (isLoadingPreview || isErrorPreview) return;
    const loadData = async () => {
      try {
        const data = await getHotspotListFromApi(apiSource);
        setItems(data.items);
        setProviderStats(data.providerStats);
        setDataSource(apiSource === 'real' ? 'real' : 'mock');
      } catch {
        try {
          const fallbackData = await getHotspotList();
          setItems(fallbackData.items);
          setProviderStats(undefined);
          setDataSource('fallback');
        } catch {
          setHasError(true);
        }
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [apiSource, isErrorPreview, isLoadingPreview]);

  if (reportId) {
    return (
      <AppShell>
        <div className={styles.page}>
          <TopNav />
          <section className={styles.stateCard} aria-label="验证报告不可用">
            <p className={styles.stateEyebrow}>报告样本</p>
            <h2 className={styles.stateTitle}>该机会的报告样本入口已保留</h2>
            <p className={styles.stateDescription}>请返回首页雷达后重新选择机会。</p>
          </section>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className={styles.page}>
        <TopNav />

        <section className={styles.hero}>
          <div className={styles.command}>
            <span className={styles.versionMark}>Home UI v1 · Intelligence Landing</span>
            <span className={styles.heroSubtitle}>HotPulse · 出海机会验证系统</span>
            <h1 className={styles.heroTitle}>出发前，先判断这个市场值不值得验证</h1>
            <p className={styles.heroDescription}>输入产品想法、目标市场或竞品方向，HotPulse 会把分散市场信号转译为证据链、风险判断和 7 天 MVP 验证动作。</p>
            <div className={styles.heroInputCard}>
              <label className={styles.heroInputLabel} htmlFor="home-query">输入一个出海想法</label>
              <textarea id="home-query" className={styles.heroInput} value={inputValue} readOnly />
              <p className={styles.heroInputHint}>系统基于市场信号和证据链判断是否值得验证，并输出 24 小时动作和 7 天计划。</p>
            </div>
            <div className={styles.heroCtas}>
              <a className={styles.primaryAction} href="/analyze">开始验证</a>
              <a className={styles.secondaryAction} href="#top-opportunities">查看今日机会</a>
            </div>
            <div className={styles.heroTrustRow}>
              <span className={styles.heroTrust}>真实信号源</span>
              <span className={styles.heroTrust}>风险矩阵</span>
              <span className={styles.heroTrust}>7 天验证动作</span>
            </div>
            <p className={styles.heroNote}>示例结构，不代表真实市场结论。{resolvedDataSource === 'fallback' ? ' 当前展示最近一次缓存结果。' : ''}</p>
          </div>
          <div className={styles.radar}>
            <RadarScanner source={resolvedDataSource} opportunityCount={discoverableOpportunities.length} />
            <div className={styles.radarPanel}>
              <div className={styles.radarMetaCard}>
                <span>今日扫描信号数</span>
                <strong>{summary.totalCount}</strong>
              </div>
              <div className={styles.radarMetaCard}>
                <span>生成机会数</span>
                <strong>{discoverableOpportunities.length}</strong>
              </div>
              <div className={styles.radarMetaCard}>
                <span>当前建议</span>
                <strong>{summary.doNowCount > 0 ? '优先验证' : summary.watchCount > 0 ? '继续观察' : '暂缓进入'}</strong>
              </div>
            </div>
          </div>
        </section>

        <SystemStatusStrip summary={summary} dataSource={dataSource} providerStats={providerStats} />

        <section className={styles.pipeline} aria-label="验证流程">
          <div className={styles.sectionHeader}>
            <div>
              <h2>验证流程</h2>
              <p>从市场信号到验证动作的四步闭环。</p>
            </div>
          </div>
          <div className={styles.pipelineGrid}>
            <article className={styles.pipelineStep}><span className={styles.pipelineIcon}>1</span><strong>Signal Capture</strong><p>抓取真实市场信号。</p><div className={styles.chipRow}><span>HN</span><span>App Store</span></div></article>
            <article className={styles.pipelineStep}><span className={styles.pipelineIcon}>2</span><strong>Opportunity Extraction</strong><p>提取可验证机会。</p><div className={styles.chipRow}><span>Top 3</span><span>机会评分</span></div></article>
            <article className={styles.pipelineStep}><span className={styles.pipelineIcon}>3</span><strong>Risk Mapping</strong><p>映射支付、本地化、竞争、合规、获客风险。</p><div className={styles.chipRow}><span>Risk</span><span>Matrix</span></div></article>
            <article className={styles.pipelineStep}><span className={styles.pipelineIcon}>4</span><strong>Action Plan</strong><p>生成 24 小时动作和 7 天验证计划。</p><div className={styles.chipRow}><span>24h</span><span>7d</span></div></article>
          </div>
        </section>

        <section id="top-opportunities" className={styles.opportunity} aria-label="今日机会">
          <div className={styles.sectionHeader}>
            <div>
              <h2>今日优先机会</h2>
              <p>只看最值得验证的 3 个机会。</p>
            </div>
            <span className={styles.sectionBadge}>{summary.doNowCount > 0 ? 'Do Now ready' : 'Monitor first'}</span>
          </div>
          <div className={styles.opportunityGrid}>
            {topOpportunities.map((opportunity, index) => {
              const scoreLabel = scoreBand(opportunity.discoveryScore);
              const confidenceLabel = opportunity.confidenceLevel === 'high' ? 'High confidence' : opportunity.confidenceLevel === 'medium' ? 'Medium confidence' : 'Low confidence';
              const verdictLabel = opportunityVerdictLabel(index);
              const actionCopy = opportunityActionCopy(index);
              return (
                <article key={`${opportunity.id}-${index}`} className={styles.opportunityCard}>
                  <div className={styles.opportunityHead}>
                    <div>
                      <span className={styles.opportunityVerdict}>{verdictLabel}</span>
                      <h3>{opportunity.title}</h3>
                      <p className={styles.opportunityMarket}>{opportunity.targetMarket}</p>
                    </div>
                    <div className={styles.scoreBadge}>
                      <strong>{opportunity.discoveryScore}</strong>
                      <span>{scoreLabel}</span>
                    </div>
                  </div>
                  <p className={styles.opportunityWhy}>{opportunity.whyNow}</p>
                  <div className={styles.opportunityMetaRow}>
                    <span>{confidenceLabel}</span>
                    <span>{opportunity.trendTag}</span>
                    <span>{opportunity.validationHypothesis}</span>
                  </div>
                  <div className={styles.chipRow}>
                    <span>{scoreLabel}</span>
                    <span>Score {opportunity.discoveryScore}</span>
                  </div>
                  <div className={styles.opportunityRiskRow}>
                    {riskChips(opportunity).map((chip) => (
                      <span key={chip.label} className={`${styles.riskChip} ${styles[`riskChip--${chip.tone}`]}`}>{chip.label}</span>
                    ))}
                  </div>
                  <p className={styles.opportunityAction}>{actionCopy}</p>
                </article>
              );
            })}
          </div>
        </section>

        <ProviderStatsWidget providerStats={providerStats} dataSource={dataSource} />
        {loading ? <LoadingPreview isRealSource={apiSource === 'real'} /> : null}
        {hasError ? <ErrorPreview /> : null}

        <section className={styles.execution} aria-label="下一步能力">
          <div className={styles.sectionHeader}>
            <div>
              <h2>报告后的下一步</h2>
              <p>风险判断后的下一步能力，不是硬卖服务。</p>
            </div>
          </div>
          <div className={styles.executionGrid}>
            <article className={styles.executionCard}><strong>Payment Risk 高</strong><span>支付快接包</span></article>
            <article className={styles.executionCard}><strong>Localization Risk 高</strong><span>本地化验证包</span></article>
            <article className={styles.executionCard}><strong>Compliance Risk 高</strong><span>上架合规包</span></article>
            <article className={styles.executionCard}><strong>AI Cost Risk 高</strong><span>token 成本优化</span></article>
            <article className={styles.executionCard}><strong>Acquisition Risk 高</strong><span>7 天投流验证包</span></article>
          </div>
        </section>

        <footer className={styles.footer}>
          <span>Radar Dashboard v1.2</span>
          <span>示例结构，不代表真实市场结论。</span>
        </footer>
      </div>
    </AppShell>
  );
}
