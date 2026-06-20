const PRODUCT_HUNT_GRAPHQL = 'https://api.producthunt.com/v2/api/graphql';
const PRODUCT_HUNT_PROVIDER_LIMIT = 10;

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function normalize(value, max) {
  return clamp(Math.round((value / max) * 100));
}

function getToken() {
  return process.env.PRODUCT_HUNT_TOKEN || '';
}

function inferCategory(text, topics = []) {
  const bag = `${text} ${topics.join(' ')}`.toLowerCase();
  if (/(developer|dev|api|code|sdk|cli|workflow|automation)/.test(bag)) return 'Developer Tool';
  if (/(agent|workflow|automation)/.test(bag)) return 'Agent Workflow';
  if (/(productivity|collaboration|workspace|saas|saaS)/.test(bag)) return 'SaaS';
  if (/(game|gaming)/.test(bag)) return 'Game';
  if (/(ai|llm|chat|assistant)/.test(bag)) return 'AI App';
  return 'Other';
}

function inferProductType(text, topics = []) {
  const bag = `${text} ${topics.join(' ')}`.toLowerCase();
  if (/(developer|dev|api|code|sdk|cli)/.test(bag)) return '开发者工具';
  if (/(agent|workflow|automation)/.test(bag)) return 'Agent 工作流';
  if (/(productivity|collaboration|workspace|saas)/.test(bag)) return 'SaaS';
  if (/(game|gaming)/.test(bag)) return '游戏';
  if (/(ai|llm|chat|assistant)/.test(bag)) return 'AI 工具';
  return '新产品';
}

function opportunityTitle(name, tagline, topics = []) {
  const bag = `${name} ${tagline} ${topics.join(' ')}`.toLowerCase();
  if (/(agent|workflow|automation)/.test(bag)) return 'Agent 工作流产品需求观察窗口';
  if (/(developer|code|api|devtool|sdk|cli)/.test(bag)) return '开发者工具自动化需求升温';
  if (/(ai|llm|chat|assistant)/.test(bag)) return 'AI 工具新产品验证窗口';
  if (/(productivity|collaboration|workspace)/.test(bag)) return '效率工具订阅转化验证机会';
  return '新产品出海需求观察窗口';
}

function evidenceStrength(votesCount, commentsCount) {
  if (votesCount >= 500 || commentsCount >= 50) return 'high';
  if (votesCount >= 100 || commentsCount >= 10) return 'medium';
  return 'low';
}

function parseTopics(node) {
  const topics = node?.topics?.edges;
  if (!Array.isArray(topics)) return [];
  return topics
    .map((edge) => edge?.node?.name)
    .filter((name) => typeof name === 'string' && name.trim());
}

function buildEvidence(node, topics) {
  const votesCount = node.votesCount ?? 0;
  const commentsCount = node.commentsCount ?? 0;
  const strength = evidenceStrength(votesCount, commentsCount);
  return [{
    title: `Product Hunt: ${node.name}`,
    url: node.url || node.website || 'https://www.producthunt.com/',
    source: 'Product Hunt',
    type: 'competitor_signal',
    retrievedAt: new Date().toISOString(),
    evidenceStrength: strength,
    metadata: {
      votesCount,
      commentsCount,
      topics,
      tagline: node.tagline ?? null,
      createdAt: node.createdAt ?? null,
      website: node.website ?? null,
    },
  }];
}

function toOpportunity(node, idx) {
  const topics = parseTopics(node);
  const name = node.name || 'Untitled Product Hunt post';
  const tagline = node.tagline || node.description || '';
  const text = `${name} ${tagline} ${topics.join(' ')}`;
  const votesCount = node.votesCount ?? 0;
  const commentsCount = node.commentsCount ?? 0;
  const trendVelocity = clamp(Math.round((normalize(votesCount, 1000) + normalize(commentsCount, 100)) / 2));
  const discussionVolume = clamp(normalize(commentsCount, 100));
  const contentFit = clamp(50 + (/(ai|llm|chat|assistant|agent|workflow|developer|api|productivity)/i.test(text) ? 18 : 6));
  const commercialValue = clamp(45 + (/(saas|productivity|workspace|subscription|automation)/i.test(text) ? 18 : 8));
  const competitionLevel = clamp(40 + normalize(votesCount, 1000) / 2);
  const category = inferCategory(text, topics);
  const productType = inferProductType(text, topics);

  return {
    id: `ph-${node.id || idx}`,
    title: opportunityTitle(name, tagline, topics),
    source: 'Product Hunt',
    sourceType: 'real',
    category,
    publishTime: node.createdAt || new Date().toISOString(),
    trendVelocity,
    discussionVolume,
    contentFit,
    commercialValue,
    competitionLevel,
    tags: ['Product Hunt', 'Real Signal', ...topics.slice(0, 2)],
    summary: tagline || node.description || `Product Hunt 信号：${name}`,
    targetMarket: 'Global',
    productType,
    entryFocus: ['验证产品需求是否持续升温', '评估订阅与转化路径', '观察竞品和分发渠道表现'],
    riskFlags: ['产品发布窗口偏短', '热度可能快速衰减'],
    paymentRisk: 45,
    localizationRisk: 35,
    competitionRisk: competitionLevel,
    evidence: buildEvidence(node, topics),
  };
}

async function fetchProductHuntPosts() {
  const token = getToken();
  if (!token) {
    return {
      ok: false,
      skippedReason: 'PRODUCT_HUNT_TOKEN is not configured',
      errorClass: 'not_configured',
      configured: false,
      items: [],
      providerMeta: {
        configured: false,
        requestedCount: 0,
        rawCount: 0,
        mappedCount: 0,
        validCount: 0,
        droppedCount: 0,
        dropReasons: {},
      },
    };
  }

  const query = `query { posts(first: ${PRODUCT_HUNT_PROVIDER_LIMIT}) { edges { node { id name tagline description url website votesCount commentsCount createdAt topics { edges { node { name } } } } } } }`;
  const resp = await fetch(PRODUCT_HUNT_GRAPHQL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query }),
  });

  if (!resp.ok) throw new Error(`Product Hunt request failed: ${resp.status}`);
  const data = await resp.json();
  const edges = data?.data?.posts?.edges;
  const nodes = Array.isArray(edges) ? edges.map((edge) => edge?.node).filter(Boolean) : [];
  return { ok: true, items: nodes };
}

export async function getProductHuntOpportunities() {
  const result = await fetchProductHuntPosts();
  if (!result.ok) {
    return {
      ok: false,
      skippedReason: result.skippedReason,
      errorClass: result.errorClass,
      configured: result.configured,
      providerMeta: result.providerMeta,
      items: [],
    };
  }

  const mappableNodes = result.items
    .filter((node) => typeof node?.url === 'string' || typeof node?.website === 'string');
  const mappedItems = mappableNodes.map((node, idx) => toOpportunity(node, idx));
  const items = mappedItems.slice(0, PRODUCT_HUNT_PROVIDER_LIMIT);
  const dropReasons = {
    ...(result.items.length - mappableNodes.length > 0 ? { missing_url: result.items.length - mappableNodes.length } : {}),
    ...(mappedItems.length > PRODUCT_HUNT_PROVIDER_LIMIT ? { provider_quota: mappedItems.length - PRODUCT_HUNT_PROVIDER_LIMIT } : {}),
  };

  return {
    ok: true,
    providerMeta: {
      configured: true,
      requestedCount: PRODUCT_HUNT_PROVIDER_LIMIT,
      rawCount: result.items.length,
      deduplicatedCount: result.items.length,
      mappedCount: mappedItems.length,
      validCount: mappedItems.length,
      selectedCount: items.length,
      droppedCount: Object.values(dropReasons).reduce((sum, count) => sum + count, 0),
      dropReasons,
    },
    items,
  };
}
