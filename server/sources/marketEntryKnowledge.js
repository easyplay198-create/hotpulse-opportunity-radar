import marketKnowledge from '../data/market-entry-knowledge.seed.json' with { type: 'json' };

const FALLBACK_MARKET = 'Global';

function normalizeMarket(value) {
  const raw = (value || '').trim().toLowerCase();
  if (!raw) return FALLBACK_MARKET;

  if (raw === 'global') return 'Global';
  if (raw === 'us' || raw === 'united states' || raw.includes('美国')) return 'US';
  if (raw === 'japan' || raw.includes('日本')) return 'Japan';
  if (raw === 'indonesia' || raw.includes('印尼')) return 'Indonesia';
  if (raw === 'southeast asia' || raw.includes('东南亚') || raw === 'sea') return 'Southeast Asia';
  if (raw === 'latin america' || raw.includes('拉美')) return 'Latin America';
  if (raw === 'middle east' || raw.includes('中东')) return 'Middle East';

  return FALLBACK_MARKET;
}

export function getMarketEntryKnowledge(targetMarket) {
  const market = normalizeMarket(targetMarket);
  const hit = marketKnowledge.find((item) => item.market === market);
  if (hit) return hit;
  return marketKnowledge.find((item) => item.market === FALLBACK_MARKET) || null;
}
