# Round 4F.1D-A - OpportunityDecisionV1

## 1) Schema

`OpportunityDecisionV1` is a deterministic decision data contract used to bridge raw opportunity signals to downstream validation workflows.

Top-level fields:

- `schemaVersion: '1.0'`
- `identity`
- `signalSummary`
- `whyNow`
- `observations`
- `supportsClaims`
- `limitations`
- `risks`
- `validationHandoff`
- `dataNotes`

Identity rule:

- API title / repo title / post title is stored as `identity.signalTitle`.
- It is never rewritten into "market opportunity conclusion".

## 2) Provenance Definition

Allowed provenance in this round:

- `observed`: external, traceable, provider-backed evidence.
- `rule_derived`: deterministic rule output from current code rules.
- `knowledge_base`: internal knowledge entries such as `HotPulse Market Knowledge`.
- `unknown`: cannot be safely classified as observed or knowledge base.

Not included in this round:

- `llm_inferred`
- `user_input`
- `hypothesis`

## 3) Deterministic Rules

The adapter uses deterministic pure functions only:

- `buildDecisionObservations()`
- `buildSignalSummary()`
- `buildSupportsClaims()`
- `buildLimitations()`
- `buildWhyNow()`
- `buildDecisionRisks()`
- `buildDecisionDataNotes()`
- `buildOpportunityDecisionV1()`

No LLM calls are introduced.

## 4) Limitations Templates

### App Store

- 评分仅反映该平台已有评分用户的反馈，不能直接证明新市场需求。
- 评价数量不等于活跃用户数、MAU、留存率或付费用户数。
- 平台表现不能直接证明其他国家或渠道的获客可行性。

### GitHub

- Stars 属于关注或收藏行为，不等于商业使用、部署量或付费意愿。
- Forks 不等于独立商业客户。
- 仓库热度不能直接证明终端用户需求。

### Hacker News

- Hacker News 样本偏向英语科技和开发者社区，不能代表大众市场。
- Points 和 comments 只能反映单条帖子的社区互动。
- 当 points < 10 时，增加弱信号限制：当前讨论信号较弱，不足以支持需求强度或趋势判断。

### knowledge_base

- HotPulse 内部知识库用于辅助解释，不属于独立外部市场证据。

## 5) Forbidden Outputs

The adapter and rule layer do not generate:

- opportunity hypothesis
- user pain inference
- demand growth claims
- payment willingness conclusion
- channel feasibility conclusion
- market size / MAU / DAU
- revenue / conversion / retention / ROI
- success probability
- "enter now" / "stop now" final recommendation

## 6) Current Backend Contract Gaps

Current evidence payload has useful observed metadata, but still has known gaps:

- Not every evidence has stable external URL.
- Retrieved time may be invalid or absent.
- Some source names are unclassified and become `unknown`.
- Risk fields can be missing and are not backfilled to `0`.

These gaps are surfaced via `dataNotes.missingFields`.

## 7) Future LLM Safety Gate

When LLM inference is added later, it should be isolated behind:

- explicit provenance extension (`llm_inferred`, `user_input`, `hypothesis`)
- strict output schemas separate from deterministic facts
- mandatory citation references for any inferred statement
- policy layer that blocks business conclusions without user/context evidence

## 8) UI-safe Consumption Fields

UI can safely consume these deterministic fields now:

- `identity.signalTitle`
- `observations` (with provenance split)
- `supportsClaims` (minimal fact claims only)
- `limitations` (source-specific constraints)
- `risks` (with `basis` and provenance)
- `whyNow` (strict timestamp-based, no trend claim)
- `validationHandoff` (requires user context)
- `dataNotes` (counts, missing fields, disclaimers)
