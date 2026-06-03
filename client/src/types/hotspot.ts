export type Verdict = 'do_now' | 'watch' | 'skip';

export type HotspotCategory =
  | 'AI'
  | 'Business'
  | 'Tools'
  | 'Marketing'
  | 'Platform'
  | 'Other';

export type SourceType =
  | 'news'
  | 'social'
  | 'community'
  | 'search';

export type EvidenceStrength = 'high' | 'medium' | 'low';

export type EvidenceType =
  | 'community_signal'
  | 'app_store_signal'
  | 'search_trend_signal'
  | 'official_doc'
  | 'industry_report'
  | 'news_signal'
  | 'competitor_signal'
  | 'payment_doc'
  | 'compliance_doc'
  | 'ad_cost_signal'
  | 'user_review_signal'
  | 'developer_signal';

export interface EvidenceItem {
  title: string;
  url: string;
  source: string;
  type: EvidenceType;
  evidenceStrength: EvidenceStrength;
  retrievedAt: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface HotspotItem {
  id: string;
  title: string;
  source: string;
  sourceType: SourceType;
  category: HotspotCategory;
  publishTime: string;

  trendVelocity: number;
  discussionVolume: number;
  contentFit: number;
  commercialValue: number;
  competitionLevel: number;
  riskLevel: number;

  tags: string[];
  summary: string;

  score: number;
  verdict: Verdict;
  reasonPositive: string[];
  reasonNegative: string[];

  /** 进入前诊断：目标市场 */
  targetMarket?: string;
  /** 进入前诊断：产品类型 */
  productType?: string;
  /** 进入前诊断：建议验证点 */
  entryFocus?: string[];
  /** 进入前诊断：风险标签 */
  riskFlags?: string[];
  /** 进入前诊断：支付适配风险 0–100 */
  paymentRisk?: number;
  paymentFit?: 'high' | 'medium' | 'low';
  /** 进入前诊断：本地化风险 0–100 */
  localizationRisk?: number;
  complianceRisk?: number;
  acquisitionRisk?: number;
  aiCostRisk?: number;
  marketEntryNotes?: string[];
  /** 进入前诊断：竞争压力 0–100 */
  competitionRisk?: number;
  evidence?: EvidenceItem[];
}

export interface HotspotSummary {
  totalCount: number;
  doNowCount: number;
  watchCount: number;
  skipCount: number;
  averageScore: number;
  highRiskCount: number;
}

export interface DistributionItem {
  label: string;
  value: number;
}

export interface HotspotListResponse {
  summary: HotspotSummary;
  categories: DistributionItem[];
  sources: DistributionItem[];
  items: HotspotItem[];
}
