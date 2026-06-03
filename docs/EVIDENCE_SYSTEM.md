# HotPulse 证据体系

## 1. 证据类型枚举
`evidence.type` 枚举：
- community_signal
- app_store_signal
- developer_signal
- industry_report
- search_trend_signal
- news_signal
- payment_doc
- compliance_doc
- ad_cost_signal
- user_review_signal
- competitor_signal
- official_doc

## 2. evidenceStrength
`evidenceStrength` 分为：
- high
- medium
- low

`evidenceStrength` 应该是真正有区分度的字段，而不是装饰字段。

## 3. 基本原则
- 机会必须有 evidenceChain。
- 单条弱信号不能当结论。
- developer_signal 不能单独证明商业需求。
- news_signal 不能单独证明市场机会。
- community_signal 不能单独代表市场规模。
- industry_report 超过 2 年需要降低权重。
- 多类型 evidence 组合后才可提高机会置信度。

## 4. 推断规则
- 没有直接评论证据时，必须标记为推断痛点或验证假设。
- 推断内容必须显式区分“证据”与“推断”。
- 没有真实 evidence 的机会不能生成。

## 5. 证据链使用方式
每个机会都应尽量包含：
- 信号来源
- 证据类型
- 证据强度
- 时间范围
- 适用市场
- 风险说明

## 6. 设计目的
证据体系的目标不是堆字段，而是让机会判断可追溯、可解释、可验证。
