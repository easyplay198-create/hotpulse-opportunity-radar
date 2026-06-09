import type { AnalyzeResponse } from '../types/analyze';
import { actionFromMvpStep, actionFromString, evidenceFromBoardItem, evidenceFromMatchedOpportunity, riskItemFromAnalyzeRisk, riskItemFromBottleneck, safeText, summarizeRecommendation, textFromAnalyzeStep, type AnalyzeDecisionVM, type StandardActionItem, type StandardEvidenceItem, type StandardRiskItem } from './decisionViewModels';

function buildDecision(result: AnalyzeResponse) {
  const decision = summarizeRecommendation(result.recommendation, 0);
  const topRisk = result.riskBottlenecks?.[0]?.why || result.riskMatrix?.[0]?.label || undefined;
  return { ...decision, topRisk };
}

function buildEvidenceTimeline(result: AnalyzeResponse): StandardEvidenceItem[] {
  if (result.evidenceBoard?.length) {
    return result.evidenceBoard.slice(0, 5).map((item, index) => ({
      ...evidenceFromBoardItem(item, index),
      fact: safeText(item.supports || item.note || item.title, '证据摘要'),
      strength: item.evidenceStrength ?? 'unknown',
      isDerived: false,
    }));
  }

  if (result.matchedSignals?.length) {
    return result.matchedSignals.slice(0, 5).map((item, index) => ({
      id: `matched-signal-${index}`,
      source: safeText(item.platformId, 'unknown'),
      title: safeText(item.title, '证据'),
      fact: safeText(item.summary, '信号摘要'),
      strength: item.evidence?.[0]?.evidenceStrength ?? 'unknown',
      time: item.publishedAt,
      type: item.evidence?.[0]?.type,
      isDerived: true,
    }));
  }

  return result.matchedOpportunities.slice(0, 5).map((item, index) => evidenceFromMatchedOpportunity(item, index));
}

function buildRiskItems(result: AnalyzeResponse): StandardRiskItem[] {
  if (result.riskMatrix?.length) return result.riskMatrix.slice(0, 6).map((item, index) => riskItemFromAnalyzeRisk(item, index));
  if (result.riskBottlenecks?.length) return result.riskBottlenecks.slice(0, 6).map((item, index) => riskItemFromBottleneck(item, index));
  return [];
}

function buildActionPlaybook(result: AnalyzeResponse): StandardActionItem[] {
  if (result.sevenDayPlan?.length) return result.sevenDayPlan.map((step, index) => actionFromString(step, index));
  if (result.mvpValidationPlan?.length) return result.mvpValidationPlan.map((step, index) => actionFromMvpStep(step, index));
  return [];
}

function buildOpenQuestions(result: AnalyzeResponse): string[] {
  const questions = [...(result.clarifyingQuestions ?? []).map((item) => item.text), ...(result.evidenceGaps ?? [])];
  return questions.filter(Boolean).slice(0, 8);
}

function buildAssumptions(result: AnalyzeResponse): string[] {
  const assumptions = result.projectUnderstanding?.missingConditions ?? [];
  return assumptions.filter(Boolean).slice(0, 6);
}

function buildTraceSteps(result: AnalyzeResponse): string[] {
  const trace = [...(result.steps ?? []).map((step) => textFromAnalyzeStep(step)), ...(result.analysisTrace ?? []).map((item) => [item.step, item.action, item.finding, item.uncertainty].filter(Boolean).join(' · '))];
  return trace.filter(Boolean).slice(0, 10);
}

function buildOpportunityOverview(result: AnalyzeResponse): string[] {
  const lines: string[] = [];
  if (result.projectUnderstanding?.targetAudience) lines.push(`目标用户：${result.projectUnderstanding.targetAudience}`);
  if (result.projectUnderstanding?.targetMarket) lines.push(`目标市场：${result.projectUnderstanding.targetMarket}`);
  if (result.recommendation?.summary) lines.push(result.recommendation.summary);
  return lines.slice(0, 3);
}

function buildMarketSignals(result: AnalyzeResponse): string[] {
  return result.matchedSignals.slice(0, 3).map((item) => safeText(item.title, '市场信号'));
}

export function buildAnalyzeDecisionVM(result: AnalyzeResponse): AnalyzeDecisionVM {
  return {
    decision: buildDecision(result),
    opportunityOverview: buildOpportunityOverview(result),
    marketSignals: buildMarketSignals(result),
    evidenceTimeline: buildEvidenceTimeline(result),
    riskItems: buildRiskItems(result),
    actionPlaybook: buildActionPlaybook(result),
    openQuestions: buildOpenQuestions(result),
    assumptions: buildAssumptions(result),
    traceSteps: buildTraceSteps(result),
  };
}
