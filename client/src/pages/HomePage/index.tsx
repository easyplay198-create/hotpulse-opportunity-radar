import { useEffect, useMemo, useState } from 'react';
import { getHotspotList } from '../../api/getHotspotList';
import { getHotspotListFromApi } from '../../api/getHotspotListFromApi';
import { AppShell } from '../../components/layout/AppShell';
import { TopNav } from '../../components/layout/TopNav';
import { TopOpportunityBoard } from '../../components/TopOpportunityBoard';
import { OpportunityMatrix } from '../../components/OpportunityMatrix';
import { HotList } from '../../components/HotList';
import { OpportunityReportPreview } from '../../components/OpportunityReportPreview';
import { OpportunityAdvisorPanel } from '../../components/OpportunityAdvisorPanel';
import { DiscoverableOpportunityList } from '../../components/DiscoverableOpportunityList';
import { DailyIntelligenceBrief } from '../../components/DailyIntelligenceBrief';
import { DataSourceStatusPanel } from '../../components/DataSourceStatusPanel';
import { buildDiscoverableOpportunities } from '../../lib/buildDiscoverableOpportunities';
import { buildDailyIntelligenceBrief } from '../../lib/buildDailyIntelligenceBrief';
import type { HotItem, HotPlatform, ProviderStats } from '../../types/hot';
import styles from './HomePage.module.css';

type DataSource = 'mock' | 'real' | 'fallback';

interface HotspotSummary {
  totalCount: number;
  doNowCount: number;
  watchCount: number;
  skipCount: number;
  averageScore: number;
}

interface DistributionItem {
  label: string;
  count: number;
  percent: number;
}

interface SourceStatusCopy {
  label: string;
  tone: 'real' | 'mock' | 'fallback';
  description: string;
  countSuffix: string;
}

function buildHotspotSummary(items: HotItem[]): HotspotSummary {
  const totalCount = items.length;
  const doNowCount = items.filter((item) => item.verdict === 'do_now').length;
  const watchCount = items.filter((item) => item.verdict === 'watch').length;
  const skipCount = items.filter((item) => item.verdict === 'skip').length;
  const averageScore =
    totalCount === 0
      ? 0
      : Math.round(items.reduce((sum, item) => sum + item.valueScore, 0) / totalCount);

  return { totalCount, doNowCount, watchCount, skipCount, averageScore };
}

function buildSourceStatusCopy(dataSource: DataSource): SourceStatusCopy {
  if (dataSource === 'real') {
    return {
      label: 'real',
      tone: 'real',
      description: '当前使用真实可追溯信号源，仍需结合证据链与验证动作判断，不等于完整市场结论。',
      countSuffix: '来自 real 数据源',
    };
  }

  if (dataSource === 'fallback') {
    return {
      label: 'fallback',
      tone: 'fallback',
      description: '当前 API 不可用，已回退到本地 seed，仅用于保持页面可演示，不代表真实市场结论。',
      countSuffix: '来自 fallback seed',
    };
  }

  return {
    label: 'mock',
    tone: 'mock',
    description: '当前使用默认 API mock，用于验证信息结构与决策流程，不代表真实市场结论。',
    countSuffix: '来自 API mock',
  };
}

interface DistributionBarsProps {
  title: string;
  items: DistributionItem[];
  barClassName?: string;
}

function DistributionBars({ title, items, barClassName }: DistributionBarsProps) {
  return (
    <div className={styles.analysisBlock}>
      <h3 className={styles.analysisSubtitle}>{title}</h3>
      {items.length === 0 ? (
        <p className={styles.analysisEmpty}>暂无数据</p>
      ) : (
        <ul className={styles.barList}>
          {items.map((item) => (
            <li key={item.label} className={styles.barRow}>
              <span className={styles.barLabel}>{item.label}</span>
              <div className={styles.barTrack}>
                <div
                  className={`${styles.barFill}${barClassName ? ` ${barClassName}` : ''}`}
                  style={{ width: `${item.percent}%` }}
                />
              </div>
              <span className={styles.barMeta}>
                {item.count} · {item.percent}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LoadingPreview() {
  return (
    <section className={styles.stateCard} aria-label="加载市场机会数据">
      <p className={styles.stateEyebrow}>数据加载中</p>
      <h2 className={styles.stateTitle}>正在加载市场机会数据...</h2>
      <p className={styles.stateDescription}>正在整理机会分、进入建议和风险维度。</p>
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

export function HomePage() {
  const searchParams = new URLSearchParams(window.location.search);
  const previewMode = searchParams.get('preview');
  const sourceParam = searchParams.get('source');
  const reportId = searchParams.get('report');
  const isLoadingPreview = previewMode === 'loading';
  const isErrorPreview = previewMode === 'error';
  const apiSource = sourceParam === 'real' ? 'real' : undefined;
  const [platforms, setPlatforms] = useState<HotPlatform[]>([]);
  const [items, setItems] = useState<HotItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [dataSource, setDataSource] = useState<DataSource>('mock');
  const [providerStats, setProviderStats] = useState<ProviderStats | undefined>(undefined);

  const summary = useMemo(() => buildHotspotSummary(items), [items]);
  const discoverableOpportunities = useMemo(
    () => buildDiscoverableOpportunities(items),
    [items],
  );
  const dailyIntelligenceBrief = useMemo(
    () => buildDailyIntelligenceBrief({ items, dataSource, discoverableOpportunities }),
    [items, dataSource, discoverableOpportunities],
  );
  const topOpportunityBoardItems = useMemo(() => discoverableOpportunities.slice(0, 3), [discoverableOpportunities]);
  const sourceStatus = useMemo(() => buildSourceStatusCopy(dataSource), [dataSource]);
  const [matrixCollapsed, setMatrixCollapsed] = useState(true);
  const matrixSummary = useMemo(() => {
    const doNow = items.filter((item) => item.verdict === 'do_now').length;
    const watch = items.filter((item) => item.verdict === 'watch').length;
    const skip = items.filter((item) => item.verdict === 'skip').length;
    return `当前可追溯机会中，优先验证 ${doNow} 个，继续观察 ${watch} 个，暂缓进入 ${skip} 个。`;
  }, [items]);
  const reportItem = useMemo(
    () => items.find((item) => item.id === reportId),
    [items, reportId],
  );

  useEffect(() => {
    if (reportId) return;
    if (!items || items.length === 0) return;

    const returnId = sessionStorage.getItem('returnToOpportunityId');
    const returnScrollY = sessionStorage.getItem('returnScrollY');

    if (!returnId && !returnScrollY) return;

    window.setTimeout(() => {
      const target = returnId
        ? document.getElementById(`opportunity-${returnId}`)
        : null;

      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (returnScrollY) {
        window.scrollTo({ top: Number(returnScrollY), behavior: 'smooth' });
      }

      sessionStorage.removeItem('returnToOpportunityId');
      sessionStorage.removeItem('returnScrollY');
    }, 300);
  }, [reportId, items]);

  const handleBackToList = (itemId?: string) => {
    if (itemId) {
      sessionStorage.setItem('returnToOpportunityId', itemId);
    }
    const params = new URLSearchParams(window.location.search);
    params.delete('report');
    const query = params.toString();
    window.location.href = query ? `/?${query}` : '/';
  };

  useEffect(() => {
    if (isLoadingPreview || isErrorPreview) {
      return;
    }

    const loadData = async () => {
      try {
        const data = await getHotspotListFromApi(apiSource);
        setPlatforms(data.platforms);
        setItems(data.items);
        setProviderStats(data.providerStats);
        setDataSource(apiSource === 'real' ? 'real' : 'mock');
      } catch {
        try {
          const fallbackData = await getHotspotList();
          setPlatforms(fallbackData.platforms);
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
          {reportItem ? (
            <OpportunityReportPreview
              item={reportItem}
              onBack={() => handleBackToList(reportItem.id)}
            />
          ) : (
            <section className={styles.stateCard} aria-label="验证报告不存在">
              <p className={styles.stateEyebrow}>报告不可用</p>
              <h2 className={styles.stateTitle}>未找到该机会的验证报告</h2>
              <p className={styles.stateDescription}>请返回机会雷达后重新选择一条机会。</p>
              <button className={styles.reloadButton} type="button" onClick={() => handleBackToList(reportId ?? undefined)}>
                返回机会雷达
              </button>
            </section>
          )}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className={styles.page}>
        <TopNav />

        <section className={styles.hero}>
          <div className={styles.heroMain}>
            <h1 className={styles.heroTitle}>万道出海 · 机会雷达</h1>
            <p className={styles.heroSubtitle}>HotPulse Market Opportunity Radar</p>
            <p className={styles.heroDescription}>
              面向 AI 应用、工具出海、游戏出海团队，快速判断市场机会、进入风险和验证动作。
            </p>
            <p className={styles.heroNote}>
              {sourceStatus.description}
              <span className={styles.sourceHint}>
                数据源状态：{sourceStatus.label}
              </span>
            </p>
          </div>
          <div className={styles.heroTags} aria-label="产品摘要">
            <div className={styles.heroStat}>
              <span className={styles.heroStatLabel}>数据源状态</span>
              <span className={`${styles.heroStatValue} ${styles.sourceStatusValue} ${styles[`sourceStatusValue--${sourceStatus.tone}`]}`}>
                {sourceStatus.label}
              </span>
            </div>
            <div className={styles.heroStat}>
              <span className={styles.heroStatLabel}>原始信号</span>
              <span className={styles.heroStatValue}>{summary.totalCount} 条</span>
              <span className={styles.heroStatHint}>{sourceStatus.countSuffix}</span>
            </div>
            <div className={styles.heroStat}>
              <span className={styles.heroStatLabel}>可追溯机会</span>
              <span className={styles.heroStatValue}>{discoverableOpportunities.length} 条</span>
              <span className={styles.heroStatHint}>由当前信号转译生成</span>
            </div>
          </div>
        </section>

        {isLoadingPreview || loading ? (
          <LoadingPreview />
        ) : isErrorPreview || hasError ? (
          <ErrorPreview />
        ) : (
          <>
            <DataSourceStatusPanel mode={dataSource} totalCount={summary.totalCount} providerStats={providerStats} />

            <TopOpportunityBoard opportunities={topOpportunityBoardItems} dataSource={dataSource} />

            <DailyIntelligenceBrief
              brief={dailyIntelligenceBrief}
              dataSource={dataSource}
              rawSignalCount={summary.totalCount}
              discoverableOpportunityCount={discoverableOpportunities.length}
            />

            <section className={styles.listSection} aria-label="我的机会顾问">
              <OpportunityAdvisorPanel
                items={items}
                smallTeamOpportunities={[]}
                source={dataSource}
              />
            </section>

            <section className={styles.kpiSection} aria-label="关键指标">
              <div className={styles.kpiGrid}>
                <article className={styles.kpiCard}>
                  <span className={styles.kpiLabel}>机会总数</span>
                  <span className={styles.kpiValue}>{summary.totalCount}</span>
                </article>
                <article className={`${styles.kpiCard} ${styles.kpiCardDoNow}`}>
                  <span className={styles.kpiLabel}>优先验证</span>
                  <span className={styles.kpiValue}>{summary.doNowCount}</span>
                </article>
                <article className={`${styles.kpiCard} ${styles.kpiCardWatch}`}>
                  <span className={styles.kpiLabel}>持续观察</span>
                  <span className={styles.kpiValue}>{summary.watchCount}</span>
                </article>
                <article className={`${styles.kpiCard} ${styles.kpiCardSkip}`}>
                  <span className={styles.kpiLabel}>暂不进入</span>
                  <span className={styles.kpiValue}>{summary.skipCount}</span>
                </article>
                <article className={styles.kpiCard}>
                  <span className={styles.kpiLabel}>平均机会分</span>
                  <span className={styles.kpiValue}>{summary.averageScore}</span>
                </article>
              </div>
              <p className={styles.scoreHint}>
                机会分基于市场趋势、需求讨论、产品适配、商业化潜力与竞争压力综合计算。
              </p>
            </section>

            <section className={styles.matrixSection} aria-label="辅助矩阵">
              <OpportunityMatrix
                items={items}
                collapsed={matrixCollapsed}
                onToggle={() => setMatrixCollapsed((value) => !value)}
                summaryText={matrixSummary}
              />
            </section>

            <section className={styles.analysisSection} aria-label="机会进入判断摘要">
              <h2 className={styles.sectionTitle}>机会进入判断摘要</h2>
              <p className={styles.sectionHint}>先看哪些值得验证，哪些需要暂缓；辅助矩阵默认收起。</p>
              <div className={styles.analysisGrid}>
                <DistributionBars title="可先试" items={[{ label: '优先验证', count: summary.doNowCount, percent: summary.totalCount === 0 ? 0 : Math.round((summary.doNowCount / summary.totalCount) * 100) }]} />
                <DistributionBars title="继续观察" items={[{ label: '持续观察', count: summary.watchCount, percent: summary.totalCount === 0 ? 0 : Math.round((summary.watchCount / summary.totalCount) * 100) }]} />
                <DistributionBars title="暂缓进入" items={[{ label: '暂不进入', count: summary.skipCount, percent: summary.totalCount === 0 ? 0 : Math.round((summary.skipCount / summary.totalCount) * 100) }]} />
              </div>
              <p className={styles.scoreHint}>{matrixSummary}</p>
            </section>

            <section className={styles.listSection} aria-label="今日可追溯机会发现">
              <h2 className={styles.sectionTitle}>今日可追溯机会发现</h2>
              <p className={styles.sectionHint}>
                从当前信号中提炼正在出现的市场痛点、切入缺口和验证假设。当前可追溯机会：{discoverableOpportunities.length} 条，{sourceStatus.countSuffix}。
              </p>
              <DiscoverableOpportunityList opportunities={discoverableOpportunities} source={dataSource} />
            </section>

            <section className={styles.listSection} aria-label="市场信号榜">
              <h2 className={styles.sectionTitle}>市场信号榜</h2>
              <p className={styles.sectionHint}>
                这里展示原始信号与证据来源，共 {summary.totalCount} 条，{sourceStatus.countSuffix}；用于辅助判断，不等同于可直接进入机会。
              </p>
              <HotList platforms={platforms} items={items} />
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
