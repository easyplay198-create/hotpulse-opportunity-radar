import type { HotspotScoreInput } from './score';

export interface ScoreExplanation {
  reasonPositive: string[];
  reasonNegative: string[];
}

const HIGH_THRESHOLD = 70;
const LOW_THRESHOLD = 40;

export function buildScoreExplanation(input: HotspotScoreInput): ScoreExplanation {
  const reasonPositive: string[] = [];
  const reasonNegative: string[] = [];

  if (input.trendVelocity >= HIGH_THRESHOLD) {
    reasonPositive.push('起势快');
  } else if (input.trendVelocity < LOW_THRESHOLD) {
    reasonNegative.push('趋势增速偏弱');
  }

  if (input.discussionVolume >= HIGH_THRESHOLD) {
    reasonPositive.push('讨论量充足');
  } else if (input.discussionVolume < LOW_THRESHOLD) {
    reasonNegative.push('讨论量不足');
  }

  if (input.contentFit >= HIGH_THRESHOLD) {
    reasonPositive.push('内容适配度高');
  } else if (input.contentFit < LOW_THRESHOLD) {
    reasonNegative.push('内容适配度偏低');
  }

  if (input.commercialValue >= HIGH_THRESHOLD) {
    reasonPositive.push('商业关联强');
  } else if (input.commercialValue < LOW_THRESHOLD) {
    reasonNegative.push('商业价值有限');
  }

  if (input.competitionLevel >= HIGH_THRESHOLD) {
    reasonNegative.push('竞争强度高');
  } else if (input.competitionLevel <= LOW_THRESHOLD) {
    reasonPositive.push('竞争压力较小');
  }

  return { reasonPositive, reasonNegative };
}
