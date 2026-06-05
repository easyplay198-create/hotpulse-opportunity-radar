import cors from 'cors';
import express from 'express';
import { getMockOpportunities } from './sources/mockOpportunities.js';
import { getHackerNewsOpportunities } from './sources/hackerNewsOpportunities.js';
import { getAppStoreOpportunities } from './sources/appStoreOpportunities.js';
import { getGitHubOpportunities } from './sources/githubOpportunities.js';
import { getProductHuntOpportunities } from './sources/productHuntOpportunities.js';
import { getGdeltOpportunities } from './sources/gdeltOpportunities.js';
import { getMarketEntryKnowledge } from './sources/marketEntryKnowledge.js';

const app = express();
const PORT = process.env.PORT || 3001;
const CACHE_TTL_MS = 60 * 1000;
const opportunitiesCache = new Map();

const allowedOrigins = (process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.length > 0) {
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Not allowed by CORS'));
      return;
    }

    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
      callback(null, true);
      return;
    }

    callback(null, true);
  },
}));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'hot-signal-dashboard-server' });
});

function isValidHttpUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

function normalizeEvidenceArray(evidence) {
  if (!Array.isArray(evidence)) return [];

  const allowedTypes = new Set([
    'community_signal',
    'app_store_signal',
    'search_trend_signal',
    'official_doc',
    'industry_report',
    'news_signal',
    'competitor_signal',
    'payment_doc',
    'compliance_doc',
    'ad_cost_signal',
    'user_review_signal',
    'developer_signal',
  ]);
  const allowedStrength = new Set(['high', 'medium', 'low']);

  return evidence
    .filter((ev) => ev
      && typeof ev.title === 'string'
      && isValidHttpUrl(ev.url)
      && typeof ev.source === 'string'
      && allowedTypes.has(ev.type)
      && typeof ev.retrievedAt === 'string'
      && allowedStrength.has(ev.evidenceStrength))
    .map((ev) => ({
      title: ev.title,
      url: ev.url,
      source: ev.source,
      type: ev.type,
      retrievedAt: ev.retrievedAt,
      evidenceStrength: ev.evidenceStrength,
      metadata: ev.metadata,
    }));
}

function ensureEvidenceItem(item) {
  const normalizedEvidence = normalizeEvidenceArray(item?.evidence);
  if (normalizedEvidence.length === 0) return null;
  return { ...item, evidence: normalizedEvidence };
}

function enhanceWithMarketKnowledge(item) {
  const knowledge = getMarketEntryKnowledge(item?.targetMarket || 'Global');
  if (!knowledge) return item;

  const mergedEvidence = normalizeEvidenceArray([
    ...(Array.isArray(item.evidence) ? item.evidence : []),
    ...(Array.isArray(knowledge.evidence) ? knowledge.evidence : []),
  ]);

  return {
    ...item,
    paymentFit: item.paymentFit || knowledge.paymentFit,
    paymentRisk: item.paymentRisk ?? knowledge.paymentRisk,
    localizationRisk: item.localizationRisk ?? knowledge.localizationRisk,
    complianceRisk: item.complianceRisk ?? knowledge.complianceRisk,
    acquisitionRisk: item.acquisitionRisk ?? knowledge.acquisitionRisk,
    aiCostRisk: item.aiCostRisk ?? knowledge.aiCostRisk,
    marketEntryKnowledge: knowledge.market,
    marketEntryNotes: item.marketEntryNotes ?? knowledge.entryNotes,
    evidence: mergedEvidence,
  };
}

app.get('/api/opportunities', async (req, res) => {
  const mockMode = req.query.mock;

  if (mockMode === 'error') {
    res.status(500).json({
      source: 'mock',
      error: 'mock_error',
      message: 'Mock server error',
    });
    return;
  }

  if (mockMode === 'empty') {
    res.json({
      source: 'mock',
      generatedAt: new Date().toISOString(),
      count: 0,
      items: [],
    });
    return;
  }

  if (mockMode === 'invalid') {
    res.json({
      source: 'mock',
      generatedAt: new Date().toISOString(),
      count: 5,
      items: null,
    });
    return;
  }

  const source = req.query.source === 'real' ? 'real' : (req.query.source === 'hn' ? 'hn' : 'mock');
  const cacheKey = source === 'real'
    ? '/api/opportunities?source=real'
    : source === 'hn'
      ? '/api/opportunities?source=hn'
      : '/api/opportunities';
  const now = Date.now();
  const cachePath = source === 'real'
    ? '/api/opportunities?source=real'
    : source === 'hn'
      ? '/api/opportunities?source=hn'
      : '/api/opportunities';

  const cached = opportunitiesCache.get(cacheKey);
  if (cached) {
    const isExpired = now - cached.cachedAt > CACHE_TTL_MS;

    if (!isExpired) {
      console.log(`[cache hit] ${cachePath}`);
      res.json(cached.body);
      return;
    }

    console.log(`[cache expired] ${cachePath}`);
    opportunitiesCache.delete(cacheKey);
  }

  console.log(`[cache miss] ${cachePath}`);

  try {
    let body;

    if (source === 'hn') {
      const items = (await getHackerNewsOpportunities())
        .map(ensureEvidenceItem)
        .filter(Boolean)
        .map(enhanceWithMarketKnowledge);
      body = {
        source: 'hacker-news',
        generatedAt: new Date().toISOString(),
        count: items.length,
        items,
      };
    } else if (source === 'real') {
      const providerStats = {
        hackerNews: { ok: true, fetchedCount: 0, returnedCount: 0 },
        appStore: { ok: true, fetchedCount: 0, returnedCount: 0 },
        github: { ok: true, fetchedCount: 0, returnedCount: 0 },
        productHunt: { ok: true, fetchedCount: 0, returnedCount: 0 },
        gdelt: { ok: true, fetchedCount: 0, returnedCount: 0 },
      };

      let hnValidItems = [];
      let appStoreValidItems = [];
      let githubValidItems = [];
      let productHuntValidItems = [];
      let gdeltValidItems = [];

      try {
        const hnItems = await getHackerNewsOpportunities();
        hnValidItems = hnItems.map(ensureEvidenceItem).filter(Boolean).map(enhanceWithMarketKnowledge);
        providerStats.hackerNews.fetchedCount = hnValidItems.length;
      } catch (error) {
        providerStats.hackerNews.ok = false;
        providerStats.hackerNews.fetchedCount = 0;
        providerStats.hackerNews.returnedCount = 0;
        providerStats.hackerNews.error = error instanceof Error ? error.message : 'fetch failed';
      }

      try {
        const appStoreItems = await getAppStoreOpportunities();
        appStoreValidItems = appStoreItems.map(ensureEvidenceItem).filter(Boolean).map(enhanceWithMarketKnowledge);
        providerStats.appStore.fetchedCount = appStoreValidItems.length;
      } catch (error) {
        providerStats.appStore.ok = false;
        providerStats.appStore.fetchedCount = 0;
        providerStats.appStore.returnedCount = 0;
        providerStats.appStore.error = error instanceof Error ? error.message : 'fetch failed';
      }

      try {
        const githubItems = await getGitHubOpportunities();
        githubValidItems = githubItems.map(ensureEvidenceItem).filter(Boolean).map(enhanceWithMarketKnowledge);
        providerStats.github.fetchedCount = githubValidItems.length;
      } catch (error) {
        providerStats.github.ok = false;
        providerStats.github.fetchedCount = 0;
        providerStats.github.returnedCount = 0;
        providerStats.github.error = error instanceof Error ? error.message : 'fetch failed';
      }

      try {
        const productHuntResult = await getProductHuntOpportunities();
        if (productHuntResult.ok) {
          productHuntValidItems = productHuntResult.items.map(ensureEvidenceItem).filter(Boolean).map(enhanceWithMarketKnowledge);
          providerStats.productHunt.fetchedCount = productHuntValidItems.length;
        } else {
          providerStats.productHunt.ok = false;
          providerStats.productHunt.skippedReason = productHuntResult.skippedReason;
        }
      } catch (error) {
        providerStats.productHunt.ok = false;
        providerStats.productHunt.fetchedCount = 0;
        providerStats.productHunt.returnedCount = 0;
        providerStats.productHunt.error = error instanceof Error ? error.message : 'fetch failed';
      }

      try {
        const gdeltResult = await getGdeltOpportunities();
        if (gdeltResult.ok) {
          gdeltValidItems = gdeltResult.items.map(ensureEvidenceItem).filter(Boolean).map(enhanceWithMarketKnowledge);
          providerStats.gdelt.fetchedCount = gdeltValidItems.length;
        } else {
          providerStats.gdelt.ok = false;
          providerStats.gdelt.error = gdeltResult.skippedReason || 'GDELT skipped';
        }
      } catch (error) {
        providerStats.gdelt.ok = false;
        providerStats.gdelt.fetchedCount = 0;
        providerStats.gdelt.returnedCount = 0;
        providerStats.gdelt.error = error instanceof Error ? error.message : 'fetch failed';
      }

      const primaryItems = [
        ...hnValidItems.slice(0, 10),
        ...appStoreValidItems.slice(0, 10),
        ...githubValidItems.slice(0, 10),
        ...productHuntValidItems.slice(0, 10),
        ...gdeltValidItems.slice(0, 10),
      ];
      const remainingItems = [
        ...hnValidItems.slice(10),
        ...appStoreValidItems.slice(10),
        ...githubValidItems.slice(10),
        ...productHuntValidItems.slice(10),
        ...gdeltValidItems.slice(10),
      ];
      const items = [...primaryItems, ...remainingItems]
        .filter((item) => item.evidence.length > 0)
        .slice(0, 50);

      providerStats.hackerNews.returnedCount = items.filter((item) => item.source === 'Hacker News').length;
      providerStats.appStore.returnedCount = items.filter((item) => item.source === 'Apple App Store').length;
      providerStats.github.returnedCount = items.filter((item) => item.source === 'GitHub').length;
      providerStats.productHunt.returnedCount = items.filter((item) => item.source === 'Product Hunt').length;
      providerStats.gdelt.returnedCount = items.filter((item) => item.source === 'GDELT').length;

      const allProvidersFailed = !providerStats.hackerNews.ok && !providerStats.appStore.ok && !providerStats.github.ok && !providerStats.productHunt.ok && !providerStats.gdelt.ok;

      if (allProvidersFailed || items.length < 10) {
        res.status(502).json({
          source: 'real',
          error: 'provider_error',
          message: allProvidersFailed ? 'All real providers failed' : `Real opportunities insufficient: ${items.length}`,
          providerStats,
        });
        return;
      }

      body = {
        source: 'real',
        generatedAt: new Date().toISOString(),
        count: items.length,
        providerStats,
        items,
      };
    } else {
      const items = getMockOpportunities().map(enhanceWithMarketKnowledge);
      body = {
        source: 'mock',
        generatedAt: new Date().toISOString(),
        count: items.length,
        items,
      };
    }

    opportunitiesCache.set(cacheKey, {
      cachedAt: now,
      body,
    });

    res.json(body);
  } catch (error) {
    if (source === 'real') {
      res.status(502).json({
        source: 'real',
        error: 'provider_error',
        message: error instanceof Error ? error.message : 'Real providers error',
      });
      return;
    }

    if (source === 'hn') {
      res.status(502).json({
        source: 'hacker-news',
        error: 'provider_error',
        message: error instanceof Error ? error.message : 'HN provider error',
      });
      return;
    }

    throw error;
  }
});

function loadAnalyzeItems(source) {
  if (source !== 'real') return Promise.resolve({ source: source === 'fallback' ? 'fallback' : 'mock', items: getMockOpportunities().map(enhanceWithMarketKnowledge) });
  return Promise.allSettled([
    getHackerNewsOpportunities(),
    getAppStoreOpportunities(),
    getGitHubOpportunities(),
    getProductHuntOpportunities(),
    getGdeltOpportunities(),
  ]).then((results) => {
    const items = results.flatMap((result) => {
      if (result.status !== 'fulfilled') return [];
      const value = result.value;
      const rawItems = Array.isArray(value) ? value : value?.items;
      return Array.isArray(rawItems) ? rawItems : [];
    }).map(ensureEvidenceItem).filter(Boolean).map(enhanceWithMarketKnowledge).slice(0, 50);
    if (items.length === 0) return { source: 'fallback', items: getMockOpportunities().map(enhanceWithMarketKnowledge) };
    return { source: 'real', items };
  }).catch(() => ({ source: 'fallback', items: getMockOpportunities().map(enhanceWithMarketKnowledge) }));
}

function parseAnalyzeIntent(query, profile = {}) {
  const text = `${query || ''} ${profile.targetMarket || ''}`.toLowerCase();
  const targetMarket = /日本|japan/.test(text) ? '日本' : /印尼|indonesia/.test(text) ? '印尼' : /东南亚|southeast asia/.test(text) ? '东南亚' : /欧美|\bus\b|europe/.test(text) ? '欧美' : /拉美|latin america/.test(text) ? '拉美' : /中东|middle east/.test(text) ? '中东' : profile.targetMarket || 'Global';
  const productType = /游戏|game/.test(text) ? '游戏产品' : /短剧|内容|creator|video/.test(text) ? '内容产品' : /开发者|developer|插件|plugin|api/.test(text) ? '开发者工具' : /图片|image/.test(text) ? 'AI 图片工具' : /学习|英语|education|learn/.test(text) ? 'AI 学习工具' : /ai|工具|tool|saas/.test(text) ? 'AI / SaaS 工具' : '出海产品';
  return { productType, targetMarket, userType: /团队|team|公司/.test(text) ? '出海团队' : '早期用户', stage: profile.productStage || '想法阶段', rawQuery: query || '' };
}

function evidenceRank(value) {
  if (value === 'high') return 3;
  if (value === 'medium') return 2;
  return 1;
}

function strongestEvidence(item) {
  return (item.evidence || []).reduce((max, ev) => Math.max(max, evidenceRank(ev.evidenceStrength)), 1);
}

function riskLevel(value) {
  return value >= 70 ? '高' : value >= 40 ? '中' : '低';
}

function maxRisk(item) {
  return Math.max(item.paymentRisk || 0, item.localizationRisk || 0, item.complianceRisk || 0, item.acquisitionRisk || 0, item.aiCostRisk || 0, item.competitionRisk || 0);
}

function matchAnalyzeItems(items, intent) {
  const queryText = `${intent.rawQuery} ${intent.productType} ${intent.targetMarket}`.toLowerCase();
  return [...items].map((item) => {
    const haystack = `${item.title} ${item.summary} ${item.category} ${item.productType || ''} ${item.targetMarket || ''} ${(item.tags || []).join(' ')}`.toLowerCase();
    const marketHit = intent.targetMarket !== 'Global' && haystack.includes(intent.targetMarket.toLowerCase()) ? 18 : 0;
    const productHit = intent.productType.split(/[ /]+/).some((token) => token && haystack.includes(token.toLowerCase())) ? 18 : 0;
    const queryHit = queryText.split(/\s+/).filter((token) => token.length > 1 && haystack.includes(token)).length * 4;
    const score = Math.max(0, Math.min(100, Math.round((item.valueScore || 50) * 0.55 + strongestEvidence(item) * 8 + marketHit + productHit + queryHit - Math.max(0, maxRisk(item) - 75) * 0.2)));
    return { item, score };
  }).sort((a, b) => b.score - a.score);
}

app.post('/api/analyze', async (req, res) => {
  const body = req.body || {};
  const query = typeof body.query === 'string' ? body.query.trim() : '';
  const requestedSource = body.source === 'real' ? 'real' : body.source === 'fallback' ? 'fallback' : 'mock';
  const profile = body.profile && typeof body.profile === 'object' ? body.profile : {};
  const loaded = await loadAnalyzeItems(requestedSource);
  const intent = parseAnalyzeIntent(query, profile);
  const matched = matchAnalyzeItems(loaded.items, intent);
  const top = matched[0]?.item;
  const topScore = matched[0]?.score || 45;
  const verdict = topScore >= 72 ? '优先验证' : topScore >= 55 ? '持续观察' : '暂不进入';
  const evidenceStrength = top ? (strongestEvidence(top) >= 3 ? 'high' : strongestEvidence(top) >= 2 ? 'medium' : 'low') : 'low';
  const riskItems = top ? [
    ['支付风险', top.paymentRisk || 35],
    ['本地化风险', top.localizationRisk || 45],
    ['合规风险', top.complianceRisk || 35],
    ['获客风险', top.acquisitionRisk || 50],
    ['AI 成本风险', top.aiCostRisk || 40],
  ].map(([label, value]) => ({ label, value, level: riskLevel(value) })) : [];
  res.json({
    analysisId: `analysis-${Date.now()}`,
    source: loaded.source,
    generatedAt: new Date().toISOString(),
    steps: [
      { id: 'parse', label: '解析产品方向', status: 'done', summary: `识别为 ${intent.productType}，目标市场 ${intent.targetMarket}` },
      { id: 'signals', label: '检索市场信号', status: 'done', summary: `从 ${loaded.items.length} 条当前信号中检索相关线索` },
      { id: 'evidence', label: '匹配证据链', status: 'done', summary: `匹配到 ${Math.min(3, matched.length)} 条优先信号` },
      { id: 'risk', label: '扫描风险矩阵', status: 'done', summary: '检查支付、本地化、合规、获客和 AI 成本风险' },
      { id: 'plan', label: '生成验证方案', status: 'done', summary: '生成 7 天 MVP 前验证动作' },
    ],
    parsedIntent: intent,
    matchedSignals: matched.slice(0, 3).map((entry) => entry.item),
    matchedOpportunities: matched.slice(0, 3).map((entry) => ({
      id: `matched-${entry.item.id}`,
      title: entry.item.title,
      sourceItemId: entry.item.id,
      fitScore: entry.score,
      reason: `与 ${intent.productType} / ${intent.targetMarket} 的验证方向相近。`,
      firstStep: '先做 landing page + waitlist，验证点击、留资和试用请求。',
      riskWarning: `优先关注${riskItems.sort((a, b) => b.value - a.value)[0]?.label || '获客风险'}。`,
    })),
    recommendation: {
      title: top ? `${intent.targetMarket} · ${intent.productType} 验证建议` : '先补充更多市场信号再判断',
      verdict,
      matchScore: topScore,
      targetMarket: intent.targetMarket,
      evidenceStrength,
      summary: top ? `当前最相关信号是「${top.title}」，建议先做小样本验证，不直接大规模投入。` : '当前没有足够匹配信号，建议先查看市场信号或缩小目标市场。',
      nextStep: '制作 1 页验证表达页，收集 10-20 个 waitlist 或 3-5 个有效访谈反馈。',
      reportItemId: top?.id,
    },
    riskMatrix: riskItems,
    sevenDayPlan: ['Day 1-2：明确目标人群和表达页', 'Day 3：完成本地化文案和 waitlist', 'Day 4-5：小样本投放或社区测试', 'Day 6：整理反馈和风险数据', 'Day 7：决定继续、调整或暂停'],
  });
});

const server = app.listen(PORT, () => {
  console.log(`HotPulse mock API server running at http://localhost:${PORT}`);
  console.log(`PID: ${process.pid}`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);
});

server.on('error', (error) => {
  console.error('HotPulse server failed to start', error);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down');
  server.close(() => process.exit(0));
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down');
  server.close(() => process.exit(0));
});
