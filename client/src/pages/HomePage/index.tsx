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
    { name: 'Hacker News', state: providerStats?.hackerNews?.ok ? 'ok' : 'watch', detail: providerStats?.hackerNews?.ok ? '样本信号' : '样本信号', value: `${hnCount} 条` },
    { name: 'App Store', state: providerStats?.appStore?.ok ? 'ok' : 'watch', detail: providerStats?.appStore?.ok ? '样本信号' : '样本信号', value: `${appStoreCount} 条` },
    { name: 'GitHub', state: providerStats?.github?.ok ? 'ok' : 'cache', detail: providerStats?.github?.ok ? '样本信号' : '使用缓存', value: githubCount > 0 ? `${githubCount} 条` : '使用缓存' },
    { name: 'Product Hunt', state: productHuntOk ? 'ok' : 'skipped', detail: productHuntOk ? '可用' : '部分来源暂不可用', value: productHuntOk ? `${providerStats?.productHunt?.returnedCount ?? providerStats?.productHunt?.fetchedCount ?? providerStats?.productHunt?.count ?? 0} 条` : '部分来源暂不可用' },
  ];

  if (dataSource === 'fallback') {
    rows[2] = { name: 'GitHub', state: 'cache', detail: '使用缓存', value: '使用缓存' };
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
  if (index === 0) return '优先验证';
  if (index === 1) return '继续观察';
  return '细分测试';
}

function opportunityActionCopy(index: number) {
  if (index === 0) return '24 小时内完成最小验证：落地页 + 访谈 + 证据记录';
  if (index === 1) return '7 天内测试市场反馈，确认是否继续投入';
  return '先做小样本测试，再决定是否扩大投入';
}

function riskChips(item: DiscoverableOpportunity) {
  const bag = `${item.title} ${item.whyNow} ${item.validationHypothesis}`.toLowerCase();
  const chips: Array<{ label: string; tone: 'low' | 'medium' | 'high' }> = [];
  if (/pay|payment|订阅|收费/.test(bag)) chips.push({ label: '支付风险', tone: 'medium' });
  if (/local|本地|语言|market/.test(bag)) chips.push({ label: '本地化风险', tone: 'medium' });
  if (/competition|competitor|替代|workflow/.test(bag)) chips.push({ label: '竞争风险', tone: 'high' });
  if (chips.length === 0) chips.push({ label: '风险待确认', tone: 'low' });
  return chips.slice(0, 3);
}

function LoadingPreview({ isRealSource }: { isRealSource?: boolean }) {
  return (
    <section className={styles.stateCard} aria-label="加载市场机会数据">
      <p className={styles.stateEyebrow}>{isRealSource ? '数据源状态' : '数据源状态'}</p>
      <h2 className={styles.stateTitle}>{isRealSource ? '正在连接真实数据源' : '正在扫描市场信号'}</h2>
      <p className={styles.stateDescription}>{isRealSource ? '正在整理样本信号与当前结论可信度。' : '正在整理样本信号、风险判断和下一步动作。'}</p>
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
    <section className={styles.stateCard} aria-label="市场机会数据加载失败">
      <p className={styles.stateEyebrow}>数据源状态</p>
      <h2 className={styles.stateTitle}>市场信号暂时不可用</h2>
      <p className={styles.stateDescription}>请稍后重试，或直接进入验证工具继续判断。</p>
      <button className={styles.reloadButton} type="button" onClick={() => window.location.reload()}>重新加载</button>
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
        <span className={styles.systemStatHint}>{providerStats?.productHunt?.ok ? '部分来源暂不可用' : '样本信号与缓存可继续使用'}</span>
      </div>
      <div className={styles.systemStat}>
        <span className={styles.systemStatLabel}>今日样本信号</span>
        <strong className={styles.systemStatValue}>{summary.totalCount}</strong>
        <span className={styles.systemStatHint}>当前结论可信度取决于证据链完整度</span>
      </div>
      <div className={styles.systemStat}>
        <span className={styles.systemStatLabel}>可验证机会数</span>
        <strong className={styles.systemStatValue}>{Math.min(3, summary.doNowCount + summary.watchCount)}</strong>
        <span className={styles.systemStatHint}>{summary.doNowCount > 0 ? '优先验证，不急着做' : '先观察再筛选'}</span>
      </div>
      <div className={styles.systemStat}>
        <span className={styles.systemStatLabel}>当前建议</span>
        <strong className={styles.systemStatValue}>{summary.doNowCount > 0 ? '立即验证' : summary.watchCount > 0 ? '继续观察' : '暂缓进入'}</strong>
        <span className={styles.systemStatHint}>{productHuntRow?.detail === '部分来源暂不可用' ? '部分来源暂不可用' : githubRow?.detail === '使用缓存' ? '使用缓存' : '继续看 Top 3'}</span>
      </div>
    </section>
  );
}

function ProviderStatsWidget({ providerStats, dataSource }: { providerStats?: ProviderStats; dataSource: DataSource }) {
  const providerRows = buildProviderRows(providerStats, dataSource);
  const hasGap = providerStats?.productHunt && !providerStats.productHunt.ok;
  return (
    <section className={styles.providerWidget} aria-label="数据源状态">
      <div className={styles.sectionHeader}>
        <div>
          <h2>数据源状态</h2>
          <p>只看可用于判断的样本信号与当前结论可信度。</p>
        </div>
        <span className={styles.providerBadge}>{dataSource === 'fallback' ? '使用缓存' : dataSource === 'connecting' ? '连接中' : '可用'}</span>
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
      {hasGap ? <p className={styles.providerNote}>部分来源暂不可用，但你仍可继续使用现有样本信号判断是否值得验证。</p> : null}
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
            <p className={styles.stateDescription}>请返回首页后重新选择机会。</p>
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
            <span className={styles.versionMark}>出海前决策保护入口</span>
            <span className={styles.heroSubtitle}>HotPulse · Market Validation OS</span>
            <h1 className={styles.heroTitle}>出海前，先判断这个方向值不值得验证</h1>
            <p className={styles.heroDescription}>HotPulse 帮你把市场信号、证据链、风险矩阵和 7 天验证动作整理成一个进入前判断，避免在错误市场上过早投入。</p>
            <div className={styles.heroInputCard}>
              <label className={styles.heroInputLabel} htmlFor="home-query">输入一个出海想法</label>
              <textarea id="home-query" className={styles.heroInput} value={inputValue} readOnly />
              <p className={styles.heroInputHint}>先判断，不急着做；如果信息不够，先补齐目标市场、目标用户和验证目标。</p>
            </div>
            <div className={styles.heroCtas}>
              <a className={styles.primaryAction} href="/analyze">开始验证我的方向</a>
              <a className={styles.secondaryAction} href="#top-opportunities">查看今日市场信号</a>
            </div>
            <div className={styles.heroTrustRow}>
              <span className={styles.heroTrust}>24 小时快评</span>
              <span className={styles.heroTrust}>7 天验证动作</span>
              <span className={styles.heroTrust}>证据 / 风险 / 下一步</span>
            </div>
            <p className={styles.heroNote}>当验证结果显示需要继续推进时，HotPulse 可选提供本地化、支付、上架和首轮验证执行支持。</p>
          </div>
          <div className={styles.radar}>
            <RadarScanner source={resolvedDataSource} opportunityCount={discoverableOpportunities.length} />
            <div className={styles.radarPanel}>
              <div className={styles.radarMetaCard}><span>今日样本信号</span><strong>{summary.totalCount}</strong></div>
              <div className={styles.radarMetaCard}><span>生成机会数</span><strong>{discoverableOpportunities.length}</strong></div>
              <div className={styles.radarMetaCard}><span>当前建议</span><strong>{summary.doNowCount > 0 ? '优先验证' : summary.watchCount > 0 ? '继续观察' : '暂缓进入'}</strong></div>
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
            <article className={styles.pipelineStep}><span className={styles.pipelineIcon}>3</span><strong>Risk Mapping</strong><p>映射证据、风险和止损条件。</p><div className={styles.chipRow}><span>Risk</span><span>Matrix</span></div></article>
            <article className={styles.pipelineStep}><span className={styles.pipelineIcon}>4</span><strong>Action Plan</strong><p>生成 24 小时动作和 7 天验证计划。</p><div className={styles.chipRow}><span>24h</span><span>7d</span></div></article>
          </div>
        </section>

        <section id="top-opportunities" className={styles.opportunity} aria-label="今日机会">
          <div className={styles.sectionHeader}>
            <div>
              <h2>今日优先机会</h2>
              <p>只看最值得验证的 3 个机会。</p>
            </div>
            <span className={styles.sectionBadge}>{summary.doNowCount > 0 ? '优先验证' : '先观察'}</span>
          </div>
          <div className={styles.opportunityGrid}>
            {topOpportunities.map((opportunity, index) => {
              const scoreLabel = scoreBand(opportunity.discoveryScore);
              const confidenceLabel = opportunity.confidenceLevel === 'high' ? '高可信度' : opportunity.confidenceLevel === 'medium' ? '中可信度' : '低可信度';
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
              <h2>验证后的可选执行支持</h2>
              <p>当验证结果显示需要继续推进时，HotPulse 可选提供本地化、支付、上架和首轮验证执行支持。</p>
            </div>
          </div>
        </section>

        <footer className={styles.footer}>
          <span>Market Validation OS</span>
          <span>示例结构，不代表真实市场结论。</span>
        </footer>
      </div>
    </AppShell>
  );
}
