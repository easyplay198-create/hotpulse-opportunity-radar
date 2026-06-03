import type { Verdict } from '../../types/hotspot';

export const SCORE_WEIGHTS = {
  trendVelocity: 0.3,
  discussionVolume: 0.2,
  contentFit: 0.25,
  commercialValue: 0.2,
  competitionLevel: -0.15,
} as const;

export const VERDICT_THRESHOLDS = {
  doNow: 75,
  watch: 50,
} as const;

export function getVerdictFromScore(score: number): Verdict {
  if (score >= VERDICT_THRESHOLDS.doNow) {
    return 'do_now';
  }
  if (score >= VERDICT_THRESHOLDS.watch) {
    return 'watch';
  }
  return 'skip';
}
