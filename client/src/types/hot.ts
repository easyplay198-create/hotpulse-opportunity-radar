/** 速判结论：是否值得做内容 */
export type HotVerdict = 'do_now' | 'watch' | 'skip';

/** 热点来源平台 */
export interface HotPlatform {
  id: string;
  name: string;
  code: string;
}

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

/** 单条热点，字段服务于当前 MVP 列表展示与初判 */
export interface HotItem {
  id: string;
  platformId: string;
  title: string;
  category: string;
  /** 热度 0–100 */
  heat: number;
  /** 互动强度 0–100 */
  interaction: number;
  /** 综合价值分 0–100，用于排序与 verdict */
  valueScore: number;
  verdict: HotVerdict;
  summary: string;
  tags: string[];
  publishedAt: string;
  /** 运行时评分解释：正向原因 */
  reasonPositive?: string[];
  /** 运行时评分解释：负向原因 */
  reasonNegative?: string[];
  /** 进入前诊断：目标市场 */
  targetMarket?: string;
  /** 进入前诊断：产品类型 */
  productType?: string;
  /** 进入前诊断：建议验证点 */
  entryFocus?: string[];
  /** 进入前诊断：风险标签 */
  riskFlags?: string[];
  /** 支付适配风险 0–100 */
  paymentRisk?: number;
  paymentFit?: 'high' | 'medium' | 'low';
  /** 本地化风险 0–100 */
  localizationRisk?: number;
  complianceRisk?: number;
  acquisitionRisk?: number;
  aiCostRisk?: number;
  marketEntryNotes?: string[];
  /** 竞争压力 0–100 */
  competitionRisk?: number;
  evidence?: EvidenceItem[];
  /** 后续可扩展：sourceUrl、riskLevel、competitionLevel */
}

export interface ProviderStatItem {
  ok: boolean;
  count?: number;
  fetchedCount?: number;
  returnedCount?: number;
  error?: string;
  skippedReason?: string;
}

export interface ProviderStats {
  hackerNews?: ProviderStatItem;
  appStore?: ProviderStatItem;
  github?: ProviderStatItem;
  productHunt?: ProviderStatItem;
  gdelt?: ProviderStatItem;
}

export interface HotListResponse {
  platforms: HotPlatform[];
  items: HotItem[];
  providerStats?: ProviderStats;
}
