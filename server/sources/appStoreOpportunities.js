const ITUNES_SEARCH = 'https://itunes.apple.com/search';

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function normalize(value, max) {
  return clamp(Math.round((value / max) * 100));
}

function inferCategory(text) {
  const t = text.toLowerCase();
  if (/(ai|gpt|chat|assistant|llm|model)/.test(t)) return 'AI App';
  if (/(game|puzzle|arcade|casual)/.test(t)) return 'Game';
  if (/(photo|video|design|creator)/.test(t)) return 'Creator Tool';
  if (/(productivity|todo|notes|calendar)/.test(t)) return 'Productivity';
  return 'Tool';
}

function inferProductType(text) {
  const t = text.toLowerCase();
  if (/(ai|assistant|gpt|llm)/.test(t)) return 'AI 应用';
  if (/(game|puzzle|arcade|casual)/.test(t)) return '移动游戏';
  if (/(photo|video|design)/.test(t)) return '创作工具';
  if (/(productivity|todo|notes|calendar)/.test(t)) return '效率工具';
  return '工具应用';
}

function isUpdatedWithinDays(isoDate, days) {
  if (!isoDate) return false;
  const ms = new Date(isoDate).getTime();
  if (Number.isNaN(ms)) return false;
  const diffDays = (Date.now() - ms) / (1000 * 60 * 60 * 24);
  return diffDays <= days;
}

function getEvidenceStrength(rating, ratingCount, currentVersionReleaseDate) {
  if (rating >= 4.5 && ratingCount >= 5000 && isUpdatedWithinDays(currentVersionReleaseDate, 180)) {
    return 'high';
  }
  if (rating >= 4 && ratingCount >= 500) {
    return 'medium';
  }
  return 'low';
}

function toEvidence(result) {
  const url = result.trackViewUrl;
  const rating = result.averageUserRating ?? 0;
  const ratingCount = result.userRatingCount ?? 0;
  const currentVersionReleaseDate = result.currentVersionReleaseDate ?? null;
  return {
    title: `${result.trackName} · App Store`,
    url,
    source: 'Apple App Store',
    type: 'app_store_signal',
    retrievedAt: new Date().toISOString(),
    evidenceStrength: getEvidenceStrength(rating, ratingCount, currentVersionReleaseDate),
    metadata: {
      rating,
      ratingCount,
      currentVersionReleaseDate,
    },
  };
}

function toItem(result, idx) {
  const title = result.trackName || 'Untitled App';
  const text = `${result.trackName ?? ''} ${result.description ?? ''}`;
  const ratingCount = result.userRatingCount ?? 0;
  const rating = result.averageUserRating ?? 0;
  const normalizedRating = clamp(Math.round((rating / 5) * 100));

  const trendVelocity = clamp(Math.round((normalizedRating + normalize(ratingCount, 200000)) / 2));
  const discussionVolume = clamp(Math.round((normalize(ratingCount, 50000) + normalizedRating) / 2));
  const contentFit = clamp(45 + (/(ai|assistant|gpt|tool|productivity)/i.test(text) ? 20 : 8));
  const commercialValue = clamp(35 + (result.formattedPrice === 'Free' ? 12 : 25));
  const competitionLevel = clamp(40 + (/(game|photo|video)/i.test(text) ? 25 : 12));

  const evidence = [toEvidence(result)];

  return {
    id: `as-${result.trackId}-${idx}`,
    title,
    source: 'Apple App Store',
    sourceType: 'real',
    category: inferCategory(text),
    publishTime: result.currentVersionReleaseDate || result.releaseDate || new Date().toISOString(),
    trendVelocity,
    discussionVolume,
    contentFit,
    commercialValue,
    competitionLevel,
    tags: ['App Store', 'Real Signal', result.primaryGenreName ?? 'iOS'],
    summary: `App Store 信号：评分 ${rating || 0}/5，评价数 ${ratingCount}，用于验证用户需求与竞争密度。`,
    targetMarket: result.country || 'Global',
    productType: inferProductType(text),
    entryFocus: ['验证核心价值主张', '对比同类评价关键词', '评估上架与获客成本'],
    riskFlags: ['平台分发依赖', '竞品上架密集'],
    paymentRisk: 40,
    localizationRisk: 30,
    competitionRisk: competitionLevel,
    evidence,
  };
}

async function fetchQuery(term) {
  const url = `${ITUNES_SEARCH}?term=${encodeURIComponent(term)}&entity=software&limit=25`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`App Store request failed: ${resp.status}`);
  const data = await resp.json();
  return Array.isArray(data.results) ? data.results : [];
}

export async function getAppStoreOpportunities() {
  const terms = ['ai assistant', 'productivity app', 'developer tool'];
  const groups = await Promise.all(terms.map((term) => fetchQuery(term)));
  const merged = groups.flat();

  const dedup = new Map();
  for (const item of merged) {
    const key = item.trackId;
    if (!key || dedup.has(key)) continue;
    dedup.set(key, item);
  }

  const items = [...dedup.values()]
    .filter((r) => typeof r.trackViewUrl === 'string' && /^https?:\/\//i.test(r.trackViewUrl))
    .slice(0, 20)
    .map((r, idx) => toItem(r, idx));

  if (items.length < 10) {
    throw new Error(`App Store opportunities insufficient: ${items.length}`);
  }

  return items;
}
