const HN_BASE = 'https://hn.algolia.com/api/v1/search_by_date';
const HN_QUERIES = ['AI tool', 'developer tool', 'SaaS startup'];
const HN_HITS_PER_PAGE = 20;
const HN_PROVIDER_LIMIT = 20;

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function normalize(value, max) {
  return clamp(Math.round((value / max) * 100));
}

function inferCategory(title) {
  const t = title.toLowerCase();
  if (/(game|gaming|unity|unreal)/.test(t)) return 'Game';
  if (/(agent|llm|gpt|ai|model|copilot)/.test(t)) return 'AI App';
  if (/(developer|devtool|sdk|cli|api)/.test(t)) return 'Developer Tool';
  if (/(saas|startup|subscription|pricing|product)/.test(t)) return 'SaaS';
  return 'AI Tool';
}

function inferProductType(title) {
  const t = title.toLowerCase();
  if (/(game|unity|unreal)/.test(t)) return '游戏技术';
  if (/(developer|sdk|cli|api)/.test(t)) return '开发者工具';
  if (/(saas|subscription|pricing)/.test(t)) return 'SaaS';
  if (/(startup|product)/.test(t)) return '创业产品';
  return 'AI 工具';
}

function keywordScore(title, words) {
  const t = title.toLowerCase();
  return words.reduce((s, w) => (t.includes(w) ? s + 1 : s), 0);
}

function freshnessScore(createdAt) {
  const hours = (Date.now() - new Date(createdAt).getTime()) / 36e5;
  if (hours <= 6) return 95;
  if (hours <= 24) return 85;
  if (hours <= 72) return 70;
  if (hours <= 168) return 55;
  return 40;
}

function getEvidenceStrength(points, comments) {
  if (points >= 200 && comments >= 50) return 'high';
  if (points >= 50 || comments >= 20) return 'medium';
  return 'low';
}

function toItem(hit, idx) {
  const title = hit.title || hit.story_title || 'Untitled HN signal';
  const points = hit.points ?? 0;
  const comments = hit.num_comments ?? 0;
  const fitHits = keywordScore(title, ['ai', 'tool', 'agent', 'api', 'developer', 'game', 'saas']);
  const bizHits = keywordScore(title, ['saas', 'pricing', 'subscription', 'startup', 'product', 'payment', 'api']);

  const trendVelocity = clamp(Math.round((freshnessScore(hit.created_at) + normalize(points, 300)) / 2));
  const discussionVolume = clamp(Math.round((normalize(comments, 200) + normalize(points, 300)) / 2));
  const contentFit = clamp(45 + fitHits * 8);
  const commercialValue = clamp(40 + bizHits * 10);
  const competitionLevel = clamp(Math.round((normalize(points, 300) + normalize(comments, 200)) / 2));

  const sourceUrl = hit.url || hit.story_url || `https://news.ycombinator.com/item?id=${hit.objectID}`;
  const evidenceStrength = getEvidenceStrength(points, comments);
  const evidence = [{
    title,
    url: sourceUrl,
    source: 'Hacker News',
    type: 'community_signal',
    retrievedAt: new Date().toISOString(),
    evidenceStrength,
    metadata: {
      points,
      comments,
      createdAt: hit.created_at || null,
    },
  }];

  return {
    id: `hn-${hit.objectID}-${idx}`,
    title,
    source: 'Hacker News',
    sourceType: 'real',
    category: inferCategory(title),
    publishTime: hit.created_at || new Date().toISOString(),
    trendVelocity,
    discussionVolume,
    contentFit,
    commercialValue,
    competitionLevel,
    tags: ['Hacker News', 'Real Signal', inferCategory(title)],
    summary: `HN 信号：${comments} 条评论，${points} 点热度，适合用于快速验证市场关注方向。`,
    targetMarket: 'Global',
    productType: inferProductType(title),
    entryFocus: ['验证首批目标人群画像', '测试价值主张与定价锚点', '评估分发渠道转化成本'],
    riskFlags: ['样本偏技术社区', '短期热度波动'],
    paymentRisk: 45,
    localizationRisk: 35,
    competitionRisk: competitionLevel,
    evidence,
  };
}

async function fetchQuery(query) {
  const url = `${HN_BASE}?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=${HN_HITS_PER_PAGE}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HN request failed: ${resp.status}`);
  const data = await resp.json();
  return Array.isArray(data.hits) ? data.hits : [];
}

export async function getHackerNewsOpportunities(options = {}) {
  const providerLimit = options.providerLimit ?? HN_PROVIDER_LIMIT;
  const hitsGroups = await Promise.all(HN_QUERIES.map((q) => fetchQuery(q)));
  const merged = hitsGroups.flat();

  const dedup = new Map();
  for (const hit of merged) {
    const key = hit.objectID;
    if (!key || dedup.has(key)) continue;
    dedup.set(key, hit);
  }

  const mappableRecords = [...dedup.values()]
    .filter((h) => (h.title || h.story_title) && (h.url || h.story_url || h.objectID));
  const mappedItems = mappableRecords
    .map((hit, idx) => toItem(hit, idx))
    .filter((item) => Array.isArray(item.evidence) && item.evidence.every((ev) => typeof ev.url === 'string' && /^https?:\/\//i.test(ev.url)));
  const items = mappedItems.slice(0, providerLimit);

  const dropReasons = {
    ...(merged.length - dedup.size > 0 ? { duplicate: merged.length - dedup.size } : {}),
    ...(dedup.size - mappableRecords.length > 0 ? { invalid_shape: dedup.size - mappableRecords.length } : {}),
    ...(mappableRecords.length - mappedItems.length > 0 ? { invalid_url: mappableRecords.length - mappedItems.length } : {}),
    ...(mappedItems.length > providerLimit ? { provider_quota: mappedItems.length - providerLimit } : {}),
  };

  Object.defineProperty(items, 'providerMeta', {
    enumerable: false,
    value: {
      requestedCount: HN_QUERIES.length * HN_HITS_PER_PAGE,
      rawCount: merged.length,
      deduplicatedCount: dedup.size,
      mappedCount: mappableRecords.length,
      validCount: mappedItems.length,
      selectedCount: items.length,
      droppedCount: Object.values(dropReasons).reduce((sum, count) => sum + count, 0),
      dropReasons,
    },
  });

  if (items.length < 10) {
    throw new Error(`HN opportunities insufficient: ${items.length}`);
  }

  return items;
}
