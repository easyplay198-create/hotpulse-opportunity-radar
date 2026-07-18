import { useEffect, useMemo, useState } from 'react';
import { getHotspotList } from '../../api/getHotspotList';
import { getHotspotListFromApi } from '../../api/getHotspotListFromApi';
import { AppShell } from '../../components/layout/AppShell';
import { TopNav } from '../../components/layout/TopNav';
import { buildDiscoverableOpportunities } from '../../lib/buildDiscoverableOpportunities';
import type { HotItem, ProviderStats } from '../../types/hot';
import styles from './HomePage.module.css';

type DataSource = 'connecting' | 'mock' | 'real' | 'fallback';
type HowVisualType = 'signal' | 'evaluation' | 'decision';
type AdvisorVisualType = 'advisory' | 'fit' | 'execution';

interface HotspotSummary {
  totalCount: number;
  doNowCount: number;
  watchCount: number;
  skipCount: number;
  averageScore: number;
}

const howCards: Array<{ label: string; title: string; desc: string; visual: HowVisualType }> = [
  {
    label: 'Signal',
    title: '捕捉市场信号',
    desc: '从社区、应用商店、产品发布和本地样本中捕捉变化。',
    visual: 'signal',
  },
  {
    label: 'Evaluation',
    title: '识别可验证方向',
    desc: '系统先过滤噪音，再把方向拆成假设、风险和验证动作。',
    visual: 'evaluation',
  },
  {
    label: 'Decision',
    title: '输出判断与下一步',
    desc: '最后输出继续、暂缓或停止，并给出 24 小时和 7 天验证动作。',
    visual: 'decision',
  },
];

const advisorCards: Array<{ label: string; title: string; desc: string; visual: AdvisorVisualType }> = [
  {
    label: 'Advisory',
    title: '市场进入判断',
    desc: '帮你判断先测哪个市场、先验证哪类用户、先避开哪些风险。',
    visual: 'advisory',
  },
  {
    label: 'Fit Check',
    title: '本地化与支付适配',
    desc: '围绕支付方式、价格、语言和用户习惯，给出进入前检查点。',
    visual: 'fit',
  },
  {
    label: 'Execution',
    title: '上架与测试执行',
    desc: '把验证结论转成落地页、访谈、上架或小预算测试动作。',
    visual: 'execution',
  },
];

function buildHotspotSummary(items: HotItem[]): HotspotSummary {
  const totalCount = items.length;
  const doNowCount = items.filter((item) => item.verdict === 'do_now').length;
  const watchCount = items.filter((item) => item.verdict === 'watch').length;
  const skipCount = items.filter((item) => item.verdict === 'skip').length;
  const averageScore = totalCount === 0 ? 0 : Math.round(items.reduce((sum, item) => sum + item.valueScore, 0) / totalCount);
  return { totalCount, doNowCount, watchCount, skipCount, averageScore };
}

function sourceStatusText(dataSource: DataSource) {
  if (dataSource === 'connecting') return '连接中';
  if (dataSource === 'real') return '真实来源';
  if (dataSource === 'fallback') return '本地 seed';
  return '样本来源';
}

function sourceStatusHint(dataSource: DataSource, providerStats?: ProviderStats) {
  if (dataSource === 'fallback') return 'API 不可用时已回退到本地 seed，原型仍可演示。';
  if (dataSource === 'connecting') return '正在连接真实来源，页面先保留验证入口。';
  if (providerStats?.productHunt && !providerStats.productHunt.ok) return '部分来源暂不可用，已使用可用样本继续判断。';
  if (dataSource === 'real') return '真实市场信号已接入，结论仍需进入验证页判断。';
  return '当前展示样本信号，适合快速理解首页路径。';
}

function currentAdvice(summary: HotspotSummary) {
  if (summary.doNowCount > 0) return '优先验证';
  if (summary.watchCount > 0) return '继续观察';
  return '暂缓进入';
}

function dataSourceClass(dataSource: DataSource) {
  if (dataSource === 'real') return styles.sourcePillReal;
  if (dataSource === 'fallback') return styles.sourcePillFallback;
  if (dataSource === 'connecting') return styles.sourcePillConnecting;
  return styles.sourcePillMock;
}

function LoadingPreview({ isRealSource }: { isRealSource?: boolean }) {
  return (
    <section className={styles.stateCard} aria-label="加载市场机会数据">
      <p className={styles.stateEyebrow}>数据源状态</p>
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

function HomeSignalScanner() {
  return (
    <div className={styles.scanOrb}>
      <svg className={styles.scanSvg} viewBox="0 0 240 240" aria-hidden="true">
        <defs>
          <clipPath id="homeRadarClip"><circle cx="120" cy="120" r="104" /></clipPath>
          <radialGradient id="homeDiscGlow" cx="50%" cy="50%" r="52%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="54%" stopColor="#f4f9ff" />
            <stop offset="100%" stopColor="#e7f1ff" />
          </radialGradient>
          <radialGradient id="homeCoreGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#2563eb" stopOpacity=".34" />
            <stop offset="58%" stopColor="#2563eb" stopOpacity=".13" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity=".02" />
          </radialGradient>
          <linearGradient id="homeTailGradient" x1="120" y1="120" x2="220" y2="84" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2563eb" stopOpacity=".01" />
            <stop offset="58%" stopColor="#2563eb" stopOpacity=".055" />
            <stop offset="100%" stopColor="#60a5fa" stopOpacity=".14" />
          </linearGradient>
          <linearGradient id="homeBeamGradient" x1="120" y1="120" x2="224" y2="120" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2563eb" stopOpacity=".04" />
            <stop offset="52%" stopColor="#2563eb" stopOpacity=".14" />
            <stop offset="100%" stopColor="#60a5fa" stopOpacity=".29" />
          </linearGradient>
          <filter id="homeBeamGlow" x="-12%" y="-12%" width="124%" height="124%">
            <feGaussianBlur stdDeviation="1.7" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="homeEdgeGlow" x="-16%" y="-16%" width="132%" height="132%">
            <feGaussianBlur stdDeviation="1.6" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="homeHeadGlow" x="-70%" y="-70%" width="240%" height="240%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="homeCoreFilter" x="-45%" y="-45%" width="190%" height="190%">
            <feGaussianBlur stdDeviation="2.2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <g clipPath="url(#homeRadarClip)">
          <circle className={styles.scanDisc} cx="120" cy="120" r="104" />
          <g className={styles.sweepLayer}>
            <path className={styles.sweepTail} d="M120 120 L50 43 A104 104 0 0 1 224 120 Z" />
            <path className={styles.sweepFill} d="M120 120 L102 18 A104 104 0 0 1 224 120 Z" />
            <line className={styles.sweepEdge} x1="144" y1="120" x2="224" y2="120" />
            <circle className={styles.scanHead} cx="224" cy="120" r="4.2" />
          </g>
        </g>
        <circle className={styles.scanRing} cx="120" cy="120" r="104" />
        <circle className={`${styles.scanRing} ${styles.scanRingMid}`} cx="120" cy="120" r="72" />
        <circle className={`${styles.scanRing} ${styles.scanRingInner}`} cx="120" cy="120" r="38" />
        <circle className={styles.rimLight} cx="120" cy="120" r="103" />
        <circle className={styles.scanCore} cx="120" cy="120" r="24" />
        <circle className={styles.coreDot} cx="120" cy="120" r="5" />
        <text className={styles.scanCoreText} x="120" y="121" textAnchor="middle">RADAR</text>
      </svg>
      <div className={`${styles.scanNode} ${styles.nodeHn}`}><span className={styles.scanDot}></span><span>HN</span></div>
      <div className={`${styles.scanNode} ${styles.nodeStore}`}><span className={styles.scanDot}></span><span>App Store</span></div>
      <div className={`${styles.scanNode} ${styles.nodePh}`}><span className={styles.scanDot}></span><span>PH</span></div>
      <div className={`${styles.scanNode} ${styles.nodeSeed}`}><span className={styles.scanDot}></span><span>Local Seed</span></div>
      <div className={`${styles.scanNode} ${styles.nodeSignals}`}><span className={styles.scanDot}></span><span>Signals</span></div>
    </div>
  );
}

function HowVisual({ type }: { type: HowVisualType }) {
  if (type === 'signal') {
    return (
      <div className={`${styles.cardVisual} ${styles.signalNetwork}`}>
        <span className={`${styles.netLine} ${styles.netLineA}`}></span>
        <span className={`${styles.netLine} ${styles.netLineB}`}></span>
        <span className={`${styles.netLine} ${styles.netLineC}`}></span>
        <span className={`${styles.netNode} ${styles.netNodeHn}`}>HN</span>
        <span className={`${styles.netNode} ${styles.netNodeStore}`}>App Store</span>
        <span className={`${styles.netNode} ${styles.netNodePh}`}>Product Hunt</span>
        <span className={`${styles.netNode} ${styles.netNodeSeed}`}>Local Seed</span>
        <span className={`${styles.netNode} ${styles.netNodeSignals}`}>Signals</span>
      </div>
    );
  }

  if (type === 'evaluation') {
    return (
      <div className={styles.cardVisual}>
        <div className={styles.evaluationBoard}>
          <div className={styles.trendCard}>
            <div className={styles.trendLine}></div>
            <div className={styles.evalRow}>
              <span className={`${styles.visualChip} ${styles.visualChipBlue}`}>Validatable</span>
              <span className={`${styles.visualChip} ${styles.visualChipOrange}`}>Payment Risk</span>
              <span className={styles.visualChip}>Localization</span>
            </div>
          </div>
          <div className={styles.checkStrip}><span className={styles.checkLong}></span><span className={styles.checkMid}></span><span className={styles.checkShort}></span></div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.cardVisual}>
      <div className={styles.decisionBoard}>
        <div className={styles.decisionStates}><span className={styles.stateActive}>继续</span><span>暂缓</span><span>停止</span></div>
        <div className={styles.decisionNote}><span>Next Move<small>24h / 7d</small></span><span>Stop Gate<small>价格 / 渠道</small></span></div>
        <div className={styles.visualTags}><span className={styles.tagGreen}>24h</span><span>7d</span><span className={styles.tagOrange}>Stop Gate</span></div>
      </div>
    </div>
  );
}

function AdvisorVisual({ type }: { type: AdvisorVisualType }) {
  if (type === 'advisory') {
    return (
      <div className={styles.cardVisual}>
        <div className={styles.advisorMatrix}><span className={styles.matrixActive}>US</span><span>JP</span><span>用户</span><span>风险</span></div>
        <div className={styles.visualTags}><span className={styles.tagBlue}>优先级</span><span>进入判断</span></div>
      </div>
    );
  }

  if (type === 'fit') {
    return (
      <div className={styles.cardVisual}>
        <div className={styles.visualTags}><span className={styles.tagGreen}>支付</span><span className={styles.tagBlue}>本地化</span><span className={styles.tagOrange}>价格</span></div>
        <div className={styles.checkStrip}><span className={styles.checkLong}></span><span className={styles.checkMid}></span></div>
      </div>
    );
  }

  return (
    <div className={styles.cardVisual}>
      <div className={styles.visualTags}><span className={styles.tagBlue}>24h</span><span>7d</span><span className={styles.tagGreen}>Launch</span><span className={styles.tagOrange}>Test</span></div>
      <div className={styles.miniRisk}><div className={styles.riskMeta}><span>Next Move</span><span>Ready</span></div><div className={styles.riskBar}><i></i></div></div>
    </div>
  );
}

export function HomePage() {
  const searchParams = new URLSearchParams(window.location.search);
  const previewMode = searchParams.get('preview');
  const sourceParam = searchParams.get('source');
  const reportId = searchParams.get('report');
  const isLoadingPreview = previewMode === 'loading';
  const isErrorPreview = previewMode === 'error';
  const apiSource = sourceParam === 'mock' ? undefined : 'real';
  const linkSource = sourceParam === 'mock' || sourceParam === 'fallback' ? sourceParam : 'real';
  const withSource = (path: string) => (path.includes('?') ? `${path}&source=${linkSource}` : `${path}?source=${linkSource}`);
  const [items, setItems] = useState<HotItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [dataSource, setDataSource] = useState<DataSource>(sourceParam === 'fallback' ? 'fallback' : apiSource === 'real' ? 'connecting' : 'mock');
  const [providerStats, setProviderStats] = useState<ProviderStats | undefined>(undefined);

  const summary = useMemo(() => buildHotspotSummary(items), [items]);
  const discoverableOpportunities = useMemo(() => buildDiscoverableOpportunities(items), [items]);
  const topOpportunities = useMemo(() => discoverableOpportunities.slice(0, 3), [discoverableOpportunities]);
  const sampleSignalCount = summary.totalCount > 0 ? summary.totalCount : 5;
  const validatableCount = topOpportunities.length > 0 ? topOpportunities.length : 3;
  const showLoading = (loading || isLoadingPreview) && !isErrorPreview;
  const showError = hasError || isErrorPreview;

  useEffect(() => {
    if (isLoadingPreview || isErrorPreview) return;
    const loadData = async () => {
      try {
        if (sourceParam === 'fallback') {
          const fallbackData = await getHotspotList();
          setItems(fallbackData.items);
          setProviderStats(undefined);
          setDataSource('fallback');
          return;
        }
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
  }, [apiSource, isErrorPreview, isLoadingPreview, sourceParam]);

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

        <section className={styles.hero} aria-label="首页首屏">
          <div className={styles.heroLeft}>
            <div className={styles.eyebrow}>Market MVP Validation OS</div>
            <h1 className={styles.heroTitle}>找到机会，更要看清机会</h1>
            <p className={styles.heroSub}>面向 AI / SaaS / App 出海团队，在开发和投放前，先验证市场信号、风险与下一步动作。</p>
            <div className={styles.heroActions}>
              <a className={styles.primaryButton} href={withSource('/analyze')}>开始一次验证规划</a>
              <a className={styles.secondaryButton} href={withSource('/opportunities')}>查看机会样本</a>
            </div>
            <p className={styles.trust}><strong>不替你盲目乐观</strong>，只帮你判断继续、暂缓还是停止。</p>
            <div className={styles.decisionGate}>
              <div className={styles.gateTop}>
                <div className={styles.gateTitle}>输入方向后，先过一道决策门</div>
                <div className={styles.gateSub}>不替你盲目乐观，只判断继续、暂缓还是停止。</div>
              </div>
              <div className={styles.gateVerdicts} aria-label="三态决策结果">
                <span className={styles.verdictContinue}>继续</span>
                <span className={styles.verdictPause}>暂缓</span>
                <span className={styles.verdictStop}>停止</span>
              </div>
              <div className={styles.gateGrid}>
                <div className={styles.gateItem}><span>最大风险</span><strong>价格接受度</strong></div>
                <div className={styles.gateItem}><span>下一步</span><strong>24 小时访谈 / 落地页测试</strong></div>
              </div>
            </div>
          </div>

          <aside className={styles.heroRight} aria-label="验证结果预览">
            <div className={styles.signalCard}>
              <div className={styles.signalBadge}>验证结果预览</div>
              <div className={styles.signalInner}>
                <div className={styles.signalHeader}><span>Signal Radar Active</span><span className={styles.signalStatus}>Scanning</span></div>
                <div className={styles.scanStage}>
                  <HomeSignalScanner />
                </div>
                <div className={styles.signalMetrics}>
                  <div className={styles.signalMetric}><span>今日样本信号</span><strong>{sampleSignalCount}</strong></div>
                  <div className={styles.signalMetric}><span>可验证机会</span><strong>{validatableCount}</strong></div>
                  <div className={styles.signalMetric}><span>当前建议</span><strong>{currentAdvice(summary)}</strong></div>
                </div>
                <div className={styles.scanCaption}>已识别 {validatableCount} 个可验证方向，建议进入 Market MVP 验证。</div>
              </div>
            </div>
            <div className={styles.previewMeta}>
              <span className={`${styles.sourcePill} ${dataSourceClass(dataSource)}`}>{sourceStatusText(dataSource)}</span>
              <span>{sourceStatusHint(dataSource, providerStats)}</span>
            </div>
          </aside>
        </section>

        {showLoading ? <LoadingPreview isRealSource={apiSource === 'real'} /> : null}
        {showError ? <ErrorPreview /> : null}

        <section className={styles.section} aria-label="为什么需要先验证">
          <div className={styles.sectionHead}>
            <div>
              <div className={styles.sectionLabel}>问题叙事</div>
              <div className={styles.sectionTitle}>很多团队不是产品做不出来，而是太早投入了错误市场</div>
            </div>
          </div>
          <div className={styles.storyGrid}>
            <article className={styles.storyCard}><h3>只看到热点，就急着开发</h3><p>市场信号不等于真实需求，热点也不等于适合你做。</p></article>
            <article className={styles.storyCard}><h3>痛点没确认，就开始投放</h3><p>出海前先拆信号、风险、价格、渠道、支付和本地化。</p></article>
            <article className={styles.storyCard}><h3>没有停止条件，就越投越深</h3><p>没有明确停止门槛，团队容易把预算和时间投入错误方向。</p></article>
          </div>
        </section>

        <section className={styles.section} aria-label="方法概览">
          <div className={`${styles.sectionHead} ${styles.balancedHead}`}>
            <div>
              <div className={styles.sectionLabel}>How PRAXON Works</div>
              <div className={styles.sectionTitle}>PRAXON 如何把市场信号变成进入判断</div>
            </div>
            <div className={styles.sectionDesc}>不是看到热点就开做，而是先把信号、风险和下一步动作拆清楚。</div>
          </div>
          <div className={styles.cardGrid}>
            {howCards.map((card) => (
              <article className={styles.methodCard} key={card.title}>
                <HowVisual type={card.visual} />
                <div className={styles.cardBody}>
                  <span className={styles.cardLabel}>{card.label}</span>
                  <h3>{card.title}</h3>
                  <p>{card.desc}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="preview" className={styles.section} aria-label="产品预览">
          <div className={styles.sectionHead}>
            <div>
              <div className={styles.sectionLabel}>Product Preview</div>
              <div className={styles.sectionTitle}>首页只给入口，真正判断在独立页面完成</div>
            </div>
          </div>
          <div className={styles.productPath}>
            <p className={styles.pathIntro}>商机雷达发现方向，验证工具判断方向，报告页沉淀结论，并在需要时连接顾问和执行支持。</p>
            <div className={styles.pathStack}>
              <article className={styles.pathRow}>
                <div className={styles.pathMain}>
                  <div className={styles.pathStep}>Step 01</div>
                  <h3 className={styles.pathTitle}>商机雷达 / 市场信号榜</h3>
                  <p className={styles.pathDesc}>每天沉淀市场信号和可验证方向，帮你发现值得进一步判断的机会。</p>
                  <a className={styles.pathAction} href={withSource('/opportunities')}>查看商机雷达</a>
                </div>
                <div className={styles.pathSupport}>
                  <div className={styles.supportHeader}>
                    <span>Advisor Support</span>
                    <strong>发现方向</strong>
                  </div>
                  <div className={styles.supportSnapshot}>
                    <div className={styles.miniSignal}>
                      <div className={styles.miniSignalRow}><span className={styles.miniChip}>HN</span><span className={`${styles.miniBar} ${styles.miniBarA}`}><i></i></span><span className={styles.miniLabel}>日本 AI 工具讨论上升</span></div>
                      <div className={styles.miniSignalRow}><span className={styles.miniChip}>App Store</span><span className={`${styles.miniBar} ${styles.miniBarB}`}><i></i></span><span className={styles.miniLabel}>轻量内容工具评分提升</span></div>
                      <div className={styles.miniSignalRow}><span className={styles.miniChip}>PH</span><span className={`${styles.miniBar} ${styles.miniBarC}`}><i></i></span><span className={styles.miniLabel}>设计工具竞品更新</span></div>
                    </div>
                  </div>
                  <div className={styles.supportMetrics}>
                    <span>Action：进入验证</span>
                    <span>Risk：噪音过滤</span>
                    <span>Evidence：信号来源</span>
                  </div>
                </div>
              </article>
              <article className={styles.pathRow}>
                <div className={styles.pathMain}>
                  <div className={styles.pathStep}>Step 02</div>
                  <h3 className={styles.pathTitle}>市场 MVP 验证工作台</h3>
                  <p className={styles.pathDesc}>把方向拆成假设、风险、验证动作和停止门槛。</p>
                  <a className={styles.pathAction} href={withSource('/analyze')}>开始验证</a>
                </div>
                <div className={styles.pathSupport}>
                  <div className={styles.supportHeader}>
                    <span>Advisor Support</span>
                    <strong>判断方向</strong>
                  </div>
                  <div className={styles.supportSnapshot}>
                    <div className={styles.miniValidation}>
                      <div className={styles.miniBadge}>Validatable</div>
                      <div className={styles.miniFlow}><div className={styles.miniStep}><span>Input</span><small>方向</small></div><div className={styles.miniStep}><span>Risk</span><small>价格</small></div><div className={styles.miniStep}><span>Action</span><small>访谈</small></div></div>
                      <div className={styles.miniRisk}><div className={styles.riskMeta}><span>最大风险：价格接受度</span><span>{summary.averageScore || 64}%</span></div><div className={styles.riskBar}><i></i></div></div>
                    </div>
                  </div>
                  <div className={styles.supportMetrics}>
                    <span>Action：24h 访谈</span>
                    <span>Risk：支付 / 本地化</span>
                    <span>Evidence：待补强</span>
                  </div>
                </div>
              </article>
              <article className={styles.pathRow}>
                <div className={styles.pathMain}>
                  <div className={styles.pathStep}>Step 03</div>
                  <h3 className={styles.pathTitle}>验证报告 / 顾问支持</h3>
                  <p className={styles.pathDesc}>沉淀判断结论，并在需要时连接支付、本地化、上架和测试执行支持。</p>
                  <a className={styles.pathAction} href="#advisor">查看执行支持</a>
                </div>
                <div className={styles.pathSupport}>
                  <div className={styles.supportHeader}>
                    <span>Advisor Support</span>
                    <strong>推进下一步</strong>
                  </div>
                  <div className={styles.supportSnapshot}>
                    <div className={styles.miniReport}>
                      <div className={styles.miniTri}><span className={styles.active}>继续</span><span>暂缓</span><span>停止</span></div>
                      <div className={styles.miniReportLine}><strong>执行入口</strong><span>顾问支持可选</span></div>
                      <div className={styles.visualTags}><span className={styles.tagGreen}>支付适配</span><span>本地化</span><span>上架测试</span><span className={styles.tagOrange}>Token 成本</span><span>执行支持</span></div>
                    </div>
                  </div>
                  <div className={styles.supportMetrics}>
                    <span>Action：生成报告</span>
                    <span>Risk：上架 / 成本</span>
                    <span>Evidence：结论沉淀</span>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section id="advisor" className={styles.section} aria-label="顾问支持">
          <div className={`${styles.sectionHead} ${styles.balancedHead}`}>
            <div>
              <div className={styles.sectionLabel}>Advisor Support</div>
              <div className={styles.sectionTitle}>验证之后，不止给结论</div>
            </div>
            <div className={styles.sectionDesc}>如果方向值得继续，PRAXON 可以继续帮你把下一步拆成可执行动作。</div>
          </div>
          <div className={styles.cardGrid}>
            {advisorCards.map((card) => (
              <article className={styles.methodCard} key={card.title}>
                <AdvisorVisual type={card.visual} />
                <div className={styles.cardBody}>
                  <span className={styles.cardLabel}>{card.label}</span>
                  <h3>{card.title}</h3>
                  <p>{card.desc}</p>
                </div>
              </article>
            ))}
          </div>
          <div className={styles.advisorFoot}><a className={styles.advisorLink} href={withSource('/resources')}>查看执行支持</a></div>
        </section>

        <section className={`${styles.section} ${styles.footerCta}`} aria-label="底部 CTA">
          <div className={styles.sectionHead}>
            <div>
              <div className={styles.sectionLabel}>Final CTA</div>
              <h2>先验证，再投入</h2>
            </div>
          </div>
          <p>在正式开发、投放、本地化和上架前，先用一轮市场 MVP 验证判断方向是否值得继续，并明确下一步怎么做。</p>
          <div className={styles.footerActions}>
            <a className={styles.primaryButton} href={withSource('/analyze')}>开始一次验证规划</a>
            <a className={styles.secondaryButton} href={withSource('/opportunities')}>查看机会样本</a>
          </div>
        </section>

        <footer className={styles.footer} aria-label="页脚">
          <div className={styles.footerBrand}><strong>PRAXON</strong><span>AI驱动的出海商机发现与验证系统</span></div>
          <nav className={styles.footerNav} aria-label="页脚导航">
            <a href={withSource('/')}>首页</a>
            <a href={withSource('/analyze')}>验证工具</a>
            <a href={withSource('/opportunities')}>商机雷达</a>
            <a href={withSource('/opportunities?tab=signals')}>市场信号榜</a>
            <a href={withSource('/resources')}>执行支持</a>
          </nav>
          <div className={styles.footerMeta}>派克森商机雷达 · PRAXON</div>
        </footer>
      </div>
    </AppShell>
  );
}
