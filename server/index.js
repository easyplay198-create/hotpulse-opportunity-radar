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
