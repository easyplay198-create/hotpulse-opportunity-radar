const GDELT_DOC_ENDPOINT = 'https://api.gdeltproject.org/api/v2/doc/doc';
const GDELT_QUERIES = [
  {
    query: '("AI app" OR "AI tool" OR "AI agent" OR "generative AI") (global OR market OR users OR app)',
    name: 'AI',
  },
  {
    query: '("mobile game" OR "short drama" OR "streaming app" OR "social app") (Asia OR LATAM OR Middle East OR global)',
    name: 'Content',
  },
  {
    query: '("local payment" OR subscription OR localization OR "app store") (emerging market OR Asia OR LATAM OR Middle East)',
    name: 'Commerce',
  },
];
const GDELT_QUERY_LIMIT = 10;
const GDELT_PROVIDER_LIMIT = 10;

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function normalize(value, max) {
  return clamp(Math.round((value / max) * 100));
}

function safeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function pickDomain(url, fallbackDomain) {
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch {
    return safeText(fallbackDomain) || 'gdelt.org';
  }
}

function inferCategory(text) {
  const t = text.toLowerCase();
  if (/(policy|regulation|ban|rule|compliance|privacy|law)/.test(t)) return 'Policy Signal';
  if (/(payment|subscription|local payment|pricing|billing)/.test(t)) return 'Payment Signal';
  if (/(game|gaming|short drama|streaming|content|creator)/.test(t)) return 'Game / Content';
  if (/(ai app|ai tool|ai agent|generative ai|artificial intelligence)/.test(t)) return 'AI Tool';
  return 'News Signal';
}

function inferProductType(text) {
  const t = text.toLowerCase();
  if (/(policy|regulation|ban|law|compliance)/.test(t)) return '行业事件';
  if (/(payment|subscription|pricing|billing)/.test(t)) return '支付 / 订阅';
  if (/(game|gaming|short drama|streaming|content|creator)/.test(t)) return '游戏 / 内容';
  if (/(ai app|ai tool|ai agent|generative ai|artificial intelligence)/.test(t)) return 'AI 工具';
  return '新闻信号';
}

function opportunityTitle(text) {
  const t = text.toLowerCase();
  if (/(policy|regulation|ban|rule|compliance|privacy|law)/.test(t)) return '平台政策变化下的上架合规观察';
  if (/(payment|subscription|pricing|billing)/.test(t)) return '本地支付与订阅转化风险提醒';
  if (/(game|gaming|short drama|streaming|content|creator)/.test(t)) return '游戏 / 内容产品区域市场变化信号';
  if (/(ai app|ai tool|ai agent|generative ai|artificial intelligence)/.test(t)) return 'AI 应用海外增长信号观察';
  return '新市场行业事件观察窗口';
}

function evidenceStrength(text) {
  const t = text.toLowerCase();
  if (/(policy|regulation|ban|law|compliance|payment|subscription)/.test(t)) return 'medium';
  return 'low';
}

function buildEvidence(article, queryName) {
  const title = safeText(article.title) || 'GDELT article';
  const url = safeText(article.url);
  if (!url) return null;
  const domain = pickDomain(url, article.domain);
  return [{
    title,
    url,
    source: 'GDELT',
    type: 'news_signal',
    retrievedAt: new Date().toISOString(),
    evidenceStrength: evidenceStrength(`${title} ${article.domain} ${article.sourcecountry}`),
    metadata: {
      domain,
      sourcecountry: safeText(article.sourcecountry) || null,
      language: safeText(article.language) || null,
      seendate: safeText(article.seendate) || null,
      queryName,
    },
  }];
}

function toOpportunity(article, idx, queryName) {
  const titleText = `${safeText(article.title)} ${safeText(article.domain)} ${safeText(article.sourcecountry)} ${queryName}`;
  const category = inferCategory(titleText);
  const productType = inferProductType(titleText);
  const domain = pickDomain(article.url, article.domain);
  const sourceCountry = safeText(article.sourcecountry) || 'Global';
  const targetMarket = /global/i.test(sourceCountry) ? 'Global' : sourceCountry;
  const trendVelocity = clamp(35 + (/(policy|regulation|ban|law|compliance|payment|subscription)/i.test(titleText) ? 12 : 6));
  const discussionVolume = clamp(30 + normalize(idx + 1, 10));
  const contentFit = clamp(42 + (/(ai|app|tool|game|content|creator|subscription|payment)/i.test(titleText) ? 10 : 4));
  const commercialValue = clamp(38 + (/(policy|payment|subscription|market|growth|funding)/i.test(titleText) ? 10 : 4));
  const competitionLevel = clamp(34 + (/(ai|app|tool|game|content)/i.test(titleText) ? 8 : 3));
  const complianceRisk = /(policy|regulation|ban|law|compliance|privacy)/i.test(titleText) ? 70 : 40;
  const paymentRisk = /(payment|subscription|billing)/i.test(titleText) ? 65 : 40;
  const localizationRisk = /asia|latam|middle east|emerging market|regional/i.test(titleText) ? 55 : 35;
  const acquisitionRisk = /(growth|funding|competition|market)/i.test(titleText) ? 45 : 35;
  const aiCostRisk = /(ai|app|tool|agent|generative ai)/i.test(titleText) ? 45 : 30;

  return {
    id: `gdelt_${article.url ? idx : `${idx}`}`,
    title: opportunityTitle(titleText),
    source: 'GDELT',
    sourceType: 'real',
    category,
    publishTime: safeText(article.seendate) || new Date().toISOString(),
    trendVelocity,
    discussionVolume,
    contentFit,
    commercialValue,
    competitionLevel,
    tags: ['GDELT', 'Real Signal', category],
    summary: `${safeText(article.title) || 'GDELT 新闻信号'} · ${domain} · ${sourceCountry}`,
    targetMarket,
    productType,
    entryFocus: ['观察行业事件是否改变进入窗口', '评估区域市场与合规变化', '继续验证趋势是否扩散'],
    riskFlags: ['新闻时效性较强', '单篇新闻仅代表线索'],
    paymentRisk,
    localizationRisk,
    complianceRisk,
    acquisitionRisk,
    aiCostRisk,
    competitionRisk: competitionLevel,
    evidence: buildEvidence(article, queryName),
  };
}

async function fetchQuery(query, queryName) {
  const url = new URL(GDELT_DOC_ENDPOINT);
  url.searchParams.set('mode', 'artlist');
  url.searchParams.set('format', 'json');
  url.searchParams.set('maxrecords', String(GDELT_QUERY_LIMIT));
  url.searchParams.set('timespan', '7d');
  url.searchParams.set('sort', 'datedesc');
  url.searchParams.set('query', query);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const resp = await fetch(url.toString(), { signal: controller.signal });
    if (!resp.ok) {
      return {
        ok: false,
        httpStatus: resp.status,
        errorClass: resp.status === 429 ? 'rate_limited' : 'http_error',
        rateLimited: resp.status === 429,
        articles: [],
        usableArticles: [],
      };
    }
    const data = await resp.json();
    const articles = Array.isArray(data?.articles) ? data.articles : [];
    const usableArticles = articles
      .map((article) => ({
        title: safeText(article.title),
        url: safeText(article.url),
        seendate: safeText(article.seendate),
        domain: safeText(article.domain),
        sourcecountry: safeText(article.sourcecountry),
        language: safeText(article.language),
        queryName,
      }))
      .filter((article) => article.title && article.url);
    return {
      ok: true,
      httpStatus: resp.status,
      articles,
      usableArticles,
    };
  } catch (error) {
    return {
      ok: false,
      errorClass: error?.name === 'AbortError' ? 'timeout' : 'network_error',
      articles: [],
      usableArticles: [],
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function getGdeltOpportunities() {
  const groups = await Promise.all(GDELT_QUERIES.map(({ query, name }) => fetchQuery(query, name)));
  const articles = [];
  const dropReasons = {};
  let httpStatus;
  let errorClass;
  let rateLimited = false;
  let rawCount = 0;
  let usableCount = 0;

  groups.forEach((result, idx) => {
    const queryName = GDELT_QUERIES[idx].name;
    if (!result.ok) {
      const reason = result.errorClass || 'unknown';
      if (!errorClass) errorClass = reason;
      if (result.httpStatus && !httpStatus) httpStatus = result.httpStatus;
      if (result.rateLimited) rateLimited = true;
      return;
    }
    rawCount += result.articles.length;
    usableCount += result.usableArticles.length;
    if (result.articles.length === 0) {
      dropReasons.no_results = (dropReasons.no_results || 0) + 1;
    }
    if (result.articles.length > result.usableArticles.length) {
      dropReasons.no_usable_items = (dropReasons.no_usable_items || 0) + (result.articles.length - result.usableArticles.length);
    }
    for (const article of result.usableArticles) {
      articles.push({ ...article, queryName });
    }
  });

  const dedup = new Map();
  for (const article of articles) {
    const key = article.url;
    if (!key || dedup.has(key)) continue;
    dedup.set(key, article);
  }

  const mappableArticles = [...dedup.values()];
  const mappedItems = mappableArticles
    .map((article, idx) => toOpportunity(article, idx, article.queryName))
    .filter((item) => Array.isArray(item.evidence) && item.evidence.length > 0);
  const items = mappedItems.slice(0, GDELT_PROVIDER_LIMIT);

  const duplicateCount = Math.max(0, usableCount - dedup.size);
  if (duplicateCount > 0) dropReasons.duplicate = (dropReasons.duplicate || 0) + duplicateCount;
  if (mappableArticles.length > mappedItems.length) dropReasons.mapping_failed = (dropReasons.mapping_failed || 0) + (mappableArticles.length - mappedItems.length);
  if (mappedItems.length > GDELT_PROVIDER_LIMIT) dropReasons.provider_quota = (dropReasons.provider_quota || 0) + (mappedItems.length - GDELT_PROVIDER_LIMIT);

  const providerMeta = {
    configured: true,
    requestedCount: GDELT_QUERIES.length * GDELT_QUERY_LIMIT,
    rawCount,
    deduplicatedCount: dedup.size,
    mappedCount: mappableArticles.length,
    validCount: mappedItems.length,
    selectedCount: items.length,
    droppedCount: Object.values(dropReasons).reduce((sum, count) => sum + count, 0),
    dropReasons,
    httpStatus,
    errorClass,
    rateLimited,
  };

  if (items.length === 0) {
    const finalErrorClass = errorClass || (rawCount === 0 ? 'no_results' : 'no_usable_items');
    return {
      ok: false,
      skippedReason: finalErrorClass === 'rate_limited'
        ? 'GDELT rate limited'
        : rawCount === 0
          ? 'GDELT returned no articles'
          : 'GDELT returned no usable articles',
      errorClass: finalErrorClass,
      httpStatus,
      rateLimited,
      providerMeta: {
        ...providerMeta,
        errorClass: finalErrorClass,
      },
      items: [],
    };
  }

  return { ok: true, providerMeta, items };
}
