const GITHUB_SEARCH = 'https://api.github.com/search/repositories';
const GITHUB_QUERIES = ['ai tool', 'developer tool', 'llm agent'];
const GITHUB_PER_PAGE = 10;
const GITHUB_PROVIDER_LIMIT = 15;

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function normalize(value, max) {
  return clamp(Math.round((value / max) * 100));
}

function inferCategory(text) {
  const t = text.toLowerCase();
  if (/(agent|llm|gpt|ai|model)/.test(t)) return 'AI App';
  if (/(developer|tool|sdk|cli|repo|framework|library)/.test(t)) return 'Developer Tool';
  return 'AI Tool';
}

function inferProductType(text) {
  const t = text.toLowerCase();
  if (/(developer|tool|sdk|cli|framework|library)/.test(t)) return '开发者工具';
  return 'AI 工具';
}

function keywordScore(text, words) {
  const t = text.toLowerCase();
  return words.reduce((sum, word) => (t.includes(word) ? sum + 1 : sum), 0);
}

function freshnessScore(updatedAt) {
  const days = (Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24);
  if (days <= 7) return 95;
  if (days <= 30) return 82;
  if (days <= 90) return 68;
  if (days <= 180) return 55;
  return 40;
}

function getEvidenceStrength(stars, forks) {
  if (stars >= 5000 || forks >= 1000) return 'high';
  if (stars >= 500 || forks >= 100) return 'medium';
  return 'low';
}

function toEvidence(repo) {
  const stars = repo.stargazers_count ?? 0;
  const forks = repo.forks_count ?? 0;
  return {
    title: repo.full_name || repo.name || 'GitHub repository',
    url: repo.html_url,
    source: 'GitHub',
    type: 'developer_signal',
    retrievedAt: new Date().toISOString(),
    evidenceStrength: getEvidenceStrength(stars, forks),
    metadata: {
      stars,
      forks,
      language: repo.language ?? null,
      updatedAt: repo.updated_at ?? null,
    },
  };
}

function toItem(repo, idx) {
  const title = repo.full_name || repo.name || 'Untitled GitHub project';
  const description = repo.description || '';
  const text = `${title} ${description}`;
  const stars = repo.stargazers_count ?? 0;
  const forks = repo.forks_count ?? 0;
  const issues = repo.open_issues_count ?? 0;

  const trendVelocity = clamp(Math.round((freshnessScore(repo.updated_at) + normalize(stars, 200000)) / 2));
  const discussionVolume = clamp(Math.round((normalize(forks, 20000) + normalize(issues, 5000)) / 2));
  const contentFit = clamp(40 + keywordScore(text, ['ai', 'agent', 'llm', 'tool', 'developer']) * 10);
  const commercialValue = clamp(35 + keywordScore(text, ['saas', 'api', 'platform', 'automation']) * 12);
  const competitionLevel = clamp(Math.round((normalize(stars, 200000) + normalize(forks, 20000)) / 2));

  return {
    id: `gh-${repo.id}-${idx}`,
    title,
    source: 'GitHub',
    sourceType: 'real',
    category: inferCategory(text),
    publishTime: repo.updated_at || repo.created_at || new Date().toISOString(),
    trendVelocity,
    discussionVolume,
    contentFit,
    commercialValue,
    competitionLevel,
    tags: ['GitHub', 'Real Signal', repo.language ?? 'Repository'],
    summary: `GitHub 信号：${stars} stars，${forks} forks，用于验证开发者关注度与开源替代压力。`,
    targetMarket: 'Global',
    productType: inferProductType(text),
    entryFocus: ['验证开发者需求', '评估开源替代压力', '测试商业化路径'],
    riskFlags: ['开源替代', '开发者社区偏样本'],
    paymentRisk: 45,
    localizationRisk: 30,
    competitionRisk: competitionLevel,
    evidence: [toEvidence(repo)],
  };
}

async function fetchQuery(query) {
  const url = `${GITHUB_SEARCH}?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=${GITHUB_PER_PAGE}`;
  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'HotPulse-Market-Radar',
      Accept: 'application/vnd.github+json',
    },
  });
  if (!resp.ok) throw new Error(`GitHub request failed: ${resp.status}`);
  const data = await resp.json();
  return Array.isArray(data.items) ? data.items : [];
}

export async function getGitHubOpportunities(options = {}) {
  const providerLimit = options.providerLimit ?? GITHUB_PROVIDER_LIMIT;
  const groups = await Promise.all(GITHUB_QUERIES.map((query) => fetchQuery(query)));
  const merged = groups.flat();

  const dedup = new Map();
  for (const repo of merged) {
    const key = repo.id;
    if (!key || dedup.has(key)) continue;
    dedup.set(key, repo);
  }

  const mappableRecords = [...dedup.values()]
    .filter((repo) => typeof repo.html_url === 'string' && /^https?:\/\//i.test(repo.html_url));
  const mappedItems = mappableRecords.map((repo, idx) => toItem(repo, idx));
  const items = mappedItems.slice(0, providerLimit);

  const dropReasons = {
    ...(merged.length - dedup.size > 0 ? { duplicate: merged.length - dedup.size } : {}),
    ...(dedup.size - mappableRecords.length > 0 ? { invalid_url: dedup.size - mappableRecords.length } : {}),
    ...(mappedItems.length > providerLimit ? { provider_quota: mappedItems.length - providerLimit } : {}),
  };

  Object.defineProperty(items, 'providerMeta', {
    enumerable: false,
    value: {
      requestedCount: GITHUB_QUERIES.length * GITHUB_PER_PAGE,
      rawCount: merged.length,
      deduplicatedCount: dedup.size,
      mappedCount: mappedItems.length,
      validCount: mappedItems.length,
      selectedCount: items.length,
      droppedCount: Object.values(dropReasons).reduce((sum, count) => sum + count, 0),
      dropReasons,
    },
  });

  if (items.length < 5) {
    throw new Error(`GitHub opportunities insufficient: ${items.length}`);
  }

  return items;
}
