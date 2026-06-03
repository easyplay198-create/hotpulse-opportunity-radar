import { SCORE_WEIGHTS, getVerdictFromScore } from './score-config';
import type { Verdict } from '../../types/hotspot';

export interface HotspotScoreInput {
  trendVelocity: number;
  discussionVolume: number;
  contentFit: number;
  commercialValue: number;
  competitionLevel: number;
}

export interface HotspotScoreResult {
  score: number;
  verdict: Verdict;
}

export function calculateHotspotScore(input: HotspotScoreInput): HotspotScoreResult {
  const rawScore =
    SCORE_WEIGHTS.trendVelocity * input.trendVelocity +
    SCORE_WEIGHTS.discussionVolume * input.discussionVolume +
    SCORE_WEIGHTS.contentFit * input.contentFit +
    SCORE_WEIGHTS.commercialValue * input.commercialValue +
    SCORE_WEIGHTS.competitionLevel * input.competitionLevel;

  const score = Math.round(rawScore);
  const verdict = getVerdictFromScore(score);

  return { score, verdict };
}
