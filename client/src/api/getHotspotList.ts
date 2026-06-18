import seed from '../data/hotspots.seed.json';
import { calculateHotspotScore } from '../features/hotspot-scoring/score';
import { buildScoreExplanation } from '../features/hotspot-scoring/score-explain';
import type { HotListResponse, HotItem, HotPlatform } from '../types/hot';
import type { HotspotItem } from '../types/hotspot';
import type { HotspotScoreInput } from '../features/hotspot-scoring/score';
import type { OpportunityDataTier } from '../types/opportunityDetail';

export function buildHotspotListFromItems(
  hotspots: HotspotItem[],
  options?: { dataTier?: OpportunityDataTier },
): HotListResponse {
  // dataTier is a response-batch property, never inferred per item.
  // Caller injects a single authoritative tier for the entire mapped list.
  const dataTier = options?.dataTier ?? 'mock';
  const items: HotItem[] = hotspots.map((h) => {
    const input: HotspotScoreInput = {
      trendVelocity: h.trendVelocity,
      discussionVolume: h.discussionVolume,
      contentFit: h.contentFit,
      commercialValue: h.commercialValue,
      competitionLevel: h.competitionLevel,
    };

    const { score, verdict } = calculateHotspotScore(input);
    const { reasonPositive, reasonNegative } = buildScoreExplanation(input);

    return {
      id: h.id,
      platformId: h.source,
      title: h.title,
      category: h.category,
      heat: h.trendVelocity,
      interaction: h.discussionVolume,
      valueScore: score,
      verdict,
      summary: h.summary,
      tags: h.tags,
      publishedAt: h.publishTime,
      reasonPositive,
      reasonNegative,
      targetMarket: h.targetMarket,
      productType: h.productType,
      entryFocus: h.entryFocus,
      riskFlags: h.riskFlags,
      paymentRisk: h.paymentRisk,
      paymentFit: h.paymentFit,
      localizationRisk: h.localizationRisk,
      complianceRisk: h.complianceRisk,
      acquisitionRisk: h.acquisitionRisk,
      aiCostRisk: h.aiCostRisk,
      marketEntryNotes: h.marketEntryNotes,
      competitionRisk: h.competitionRisk ?? h.competitionLevel,
      evidence: h.evidence,
      dataTier,
    };
  });

  const sourceIds = [...new Set(items.map((item) => item.platformId))];
  const platforms: HotPlatform[] = sourceIds.map((source) => ({
    id: source,
    name: source,
    code: source,
  }));

  return { platforms, items };
}

export async function getHotspotList(): Promise<HotListResponse> {
  return buildHotspotListFromItems(seed as HotspotItem[], { dataTier: 'fallback' });
}
