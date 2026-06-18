# Round 4F.1B Opportunity 字段审计

## 1. 执行摘要

- 当前数据**不足以完整重构**目标详情面板 0-6 全模块，但足以先上线一个“证据可追溯优先”的 V1（模块 0/1/2/6 + 模块 3 的基础版）。
- 当前数据**不足以严格解释评分可信度**（尤其 real 数据 score 并非 API 直出、无 scoreVersion/scoreInputs/scoreReasons）。
- 最大三个数据缺口：
  1. evidenceChain 缺少结构化可追溯字段（sourceName/sourceType/sourceUrl/observedAt/provenance/confidence/supportsClaims/limitations）。
  2. risk 只有数值或标签，缺少结构化 basis/provenance/confidence，难以支撑“风险与证据边界”模块。
  3. item 级别 real/mock/fallback 身份不明确（仅 response 级 source + providerStats），详情层容易混淆“真实观测”与“知识库补充/样本”。
- V1 能做：机会身份、基础信号判断、可点开的证据列表、基础数据说明、CTA 跳转验证工具。
- V1 不能做：高可信“核心判断解释链”、结构化风险依据、严格可解释评分审计、进入条件/适配度的确定性结论。

## 2. 当前数据链路

1. **Provider 抓取**
   - `server/sources/hackerNewsOpportunities.js`
   - `server/sources/appStoreOpportunities.js`
   - `server/sources/githubOpportunities.js`
   - `server/sources/productHuntOpportunities.js`
   - `server/sources/gdeltOpportunities.js`
2. **后端聚合**
   - `server/index.js` 的 `/api/opportunities`
   - 每条 item 经过 `ensureEvidenceItem()` + `enhanceWithMarketKnowledge()`
3. **API 返回**
   - response 级：`source/count/generatedAt/providerStats/items`
   - item 级：机会字段 + evidence[]
4. **前端 adapter**
   - `client/src/api/fetchOpportunities.ts` 拉取
   - `client/src/api/getHotspotList.ts` 将 `HotspotItem` 转为 `HotItem`，并**重新计算 valueScore/verdict/reason**
5. **卡片与详情**
   - `client/src/pages/OpportunitiesPage/index.tsx`：卡片 + `OpportunityDrawer`
6. **CTA 到验证工具**
   - `buildAnalyzeHref()` 组装 `/analyze?...` query（含 `auto=1/opportunityId/q/targetMarket/productType`）
   - `client/src/pages/AnalyzePage/index.tsx` 自动触发 Clarification + analyze stream

## 3. Opportunity 类型字段表

### 3.1 核心 Opportunity 类型（列表/详情主链）

定义：
- `client/src/types/hotspot.ts` -> `HotspotItem`（API item 形态）
- `client/src/types/hot.ts` -> `HotItem`（前端展示形态）

说明规则：
- 必填 = TS 非可选字段。
- 稳定性基于 real API 采样 + 代码生成逻辑。

| 字段 | TS 类型 | 必填 | 定义文件 | 生成方 | 消费方 | real 稳定性 | 备注 |
|---|---|---:|---|---|---|---|---|
| id | string | 是 | hotspot.ts/hot.ts | provider -> server | 列表/详情/CTA | 高 | 主键 |
| title | string | 是 | hotspot.ts/hot.ts | provider -> server | 卡片/详情/CTA | 高 | |
| source | string | 是 | hotspot.ts/hot.ts | provider -> server | 来源展示/providerStats映射 | 高 | |
| sourceType | union | 是 | hotspot.ts | provider -> server | 少量消费 | **中/低** | real 返回 `"real"`，与前端 union（news/social/...）不一致 |
| category | union/string | 是 | hotspot.ts/hot.ts | provider 推断 | 卡片/过滤/文案 | 中 | 多为规则推断 |
| publishTime / publishedAt | string | 是 | hotspot.ts / hot.ts | provider -> server / front map | 列表时间 | 中 | 格式不统一但可解析 |
| trendVelocity | number | 是 | hotspot.ts | provider规则 | 评分输入 | 高 | |
| discussionVolume | number | 是 | hotspot.ts | provider规则 | 评分输入 | 高 | |
| contentFit | number | 是 | hotspot.ts | provider规则 | 评分输入 | 高 | |
| commercialValue | number | 是 | hotspot.ts | provider规则 | 评分输入 | 高 | |
| competitionLevel | number | 是 | hotspot.ts | provider规则 | 评分输入/competitionRisk fallback | 高 | |
| score | number | 是(hotspot) | hotspot.ts | mock seed可能有 | 少量遗留 | **低** | real item 通常无此字段 |
| verdict | union | 是(hotspot) | hotspot.ts | mock seed可能有 | 少量遗留 | **低** | real item 通常无此字段 |
| reasonPositive/Negative | string[] | 是(hotspot) | hotspot.ts | mock seed/API缺省 | 列表理由 fallback | 低 | real 常无，前端会重算 |
| valueScore | number | 是(hot) | hot.ts | 前端 `calculateHotspotScore` | 排序/展示/筛选/详情 | 高 | 前端派生 |
| targetMarket | string? | 否 | hotspot.ts/hot.ts | provider+知识库 | 卡片/筛选/CTA | 中 | 有时 Global/待确认 |
| productType | string? | 否 | hotspot.ts/hot.ts | provider规则 | 卡片/详情/CTA | 中 | 规则推断占主 |
| entryFocus | string[]? | 否 | hotspot.ts/hot.ts | provider规则 | 分析引导/VM | 中 | |
| riskFlags | string[]? | 否 | hotspot.ts/hot.ts | provider规则 | riskReason | 中 | |
| paymentRisk/localizationRisk/competitionRisk | number? | 否 | hotspot.ts/hot.ts | provider或知识库补齐 | 详情/报告/VM | 中 | 0-100 |
| complianceRisk/acquisitionRisk/aiCostRisk | number? | 否 | hotspot.ts/hot.ts | 知识库或部分provider | 详情/报告/VM | 中 | |
| paymentFit | 'high'\|'medium'\|'low'? | 否 | hotspot.ts/hot.ts | 知识库补齐 | 多处文案/计划 | 中 | |
| marketEntryKnowledge | string? | 否(运行时) | server增强 | `enhanceWithMarketKnowledge` | 少量展示/调试 | 中 | 后端注入字段（类型未显式声明） |
| marketEntryNotes | string[]? | 否 | hotspot.ts/hot.ts | provider或知识库 | 分析/VM | 中 | |
| evidence | EvidenceItem[]? | 否 | hotspot.ts/hot.ts | provider + 知识库合并 | 卡片强度/详情证据/报告 | 中 | 结构不完整 |

### 3.2 Evidence 类型

定义：
- `client/src/types/hotspot.ts` `EvidenceItem`
- `client/src/types/hot.ts` `EvidenceItem`

| 字段 | 类型 | 必填 | 生成方 | 消费方 | 稳定性 |
|---|---|---:|---|---|---|
| title | string | 是 | provider/知识库 | 详情证据卡 | 高 |
| url | string\|null\|undefined | 否 | provider/知识库 | 外链按钮 | 中（知识库常 null） |
| source | string | 是 | provider/知识库 | 来源展示 | 高 |
| type | EvidenceType | 是 | provider映射 | 强度与分类 | 中 |
| evidenceStrength | 'high'\|'medium'\|'low' | 是 | provider规则 | 强度排序/标签 | 中 |
| retrievedAt | string | 是 | provider时刻/知识库常量 | 时间展示 | 中 |
| metadata | Record<string,...> | 否 | provider补充 | 少量规则判断 | 中 |

### 3.3 API Response 类型

定义：
- `client/src/api/fetchOpportunities.ts` `OpportunitiesResponse`
- `client/src/types/hot.ts` `ProviderStats`

| 字段 | 类型 | 必填 | 级别 | 说明 |
|---|---|---:|---|---|
| source | 'mock'\|'hacker-news'\|'real'\|'fallback' | 是 | response | 数据模式标识（非 item 级） |
| generatedAt | string? | 否 | response | 生成时间 |
| count | number | 是 | response | items 数量 |
| items | HotspotItem[] | 是 | response | 机会数组 |
| providerStats | object? | 否 | response | 各 provider 状态（ok/count/error/skippedReason） |

### 3.4 风险、评分解释、report/analyze 输入类型

- 风险标准化类型：`client/src/viewModels/decisionViewModels.ts` `StandardRiskItem`
  - `type/label/level/score?/summary/source?`
  - 多为**前端派生**（derived/reported/sample）
- 评分解释类型：`client/src/features/hotspot-scoring/score-explain.ts` `ScoreExplanation`
  - `reasonPositive[]/reasonNegative[]`，前端基于阈值生成。
- Analyze 输入：
  - `client/src/types/analyze.ts` `AnalyzeRequest { query, source?, profile? }`
- Report 存储输入：
  - `client/src/lib/reportStorage.ts` `SaveReportInput { projectDescription, targetMarket?, productType?, result }`

## 4. 不同来源 API 样本对比

采样方式：本地运行中的 `http://localhost:3001`
- `/api/opportunities?source=real`
- `/api/opportunities`
- `/api/opportunities?source=hn`
- fallback 样本来自 `client/src/data/hotspots.seed.json`（客户端 fallback 逻辑）

### 4.1 当前 real 聚合状态

- real 返回 `count=50`
- `realSources = [Hacker News, Apple App Store, GitHub]`
- Product Hunt：`ok=false, skippedReason=PRODUCT_HUNT_TOKEN is not configured`
- GDELT：`ok=false, error=GDELT returned no usable articles`

### 4.2 来源样本（关键事实）

| 来源 | 代表样本 | 原始字段完整度 | 缺失字段 | 时间字段 | URL 字段 | score/verdict 来源 |
|---|---|---|---|---|---|---|
| App Store | `as-...` | 高（rating/ratingCount在metadata） | 无 supports/limitations/provenance/confidence | publishTime + evidence.retrievedAt | evidence.url 有 | score/verdict **前端重算** |
| Hacker News | `hn-...` | 中（points/comments在metadata） | 同上，且 observed/published 分离缺失 | publishTime + retrievedAt | evidence.url 有 | 前端重算 |
| GitHub | `gh-...` | 中高（stars/forks/language） | 同上 | publishTime + retrievedAt | evidence.url 有 | 前端重算 |
| Product Hunt | 当前 real 无 item | - | token 未配置导致缺失 | - | - | - |
| GDELT | 当前 real 无 item | - | 无有效文章导致缺失 | - | - | - |
| mock/seed | `hs-001` | 中（静态字段齐） | 外部可追溯来源普遍弱 | publishTime + (知识库)retrievedAt | 多数无真实外链 | 前端重算（mock 原 score/verdict不作为主） |

### 4.3 关键判定

- evidenceChain 结构（当前实际是 `evidence[]`）：
  - 含 `source/title/url/retrievedAt/evidenceStrength/type/metadata`
  - 不含 `sourceName/sourceType/sourceUrl/observedAt/publishedAt/provenance/confidence/supportsClaims/limitations`
- market/productType 主要来自 provider 规则映射（inferCategory/inferProductType），不是原始平台直接字段。
- item 级 real/mock/fallback 标记：**没有统一字段**（仅 `sourceType`、`source` 可间接推断，且语义混杂）。

## 5. 当前评分公式审计

代码位置：
- `client/src/features/hotspot-scoring/score.ts`
- `client/src/features/hotspot-scoring/score-config.ts`
- `client/src/features/hotspot-scoring/score-explain.ts`
- 使用入口：`client/src/api/getHotspotList.ts`

### 5.1 输入字段与权重

`score = round(0.3*trendVelocity + 0.2*discussionVolume + 0.25*contentFit + 0.2*commercialValue -0.15*competitionLevel)`

verdict 阈值：
- `>=75 => do_now`
- `>=50 => watch`
- `<50 => skip`

### 5.2 缺失处理

- 评分输入来自 `HotspotItem` 必填数值字段（类型层面必填）；实际 provider 都生成。
- `reasonPositive/reasonNegative`由阈值规则生成，不依赖 API 原始理由。
- `competitionRisk` 与分数关系：**不直接参与**，分数使用 `competitionLevel`。

### 5.3 evidenceStrength/risk 对分数影响

- `evidenceStrength`：**不参与分数公式**，仅用于“证据强度排序/标签”。
- `paymentRisk/localizationRisk/competitionRisk`：**不参与分数公式**，用于风险文案、report、VM。

### 5.4 模式/来源/品类一致性

- real/mock/fallback 在前端使用**同一套公式**。
- 不同来源（HN/AppStore/GitHub）也同一套公式。
- 不同产品类型无差异权重。

### 5.5 score 用途影响面

- 不仅排序：还用于卡片展示、筛选（高分榜）、详情综合分、多个 VM confidence 推导、report summary 分数。
- 隐藏 score 影响：
  1. 默认排序逻辑改变；
  2. 高分筛选逻辑失效；
  3. 部分 confidence/band 展示需改；
  4. report 中 `summary.score` 会失去来源。

### 5.6 “67 vs 66 可解释性”

- 只能解释为线性加权后四舍五入差 1 分；
- 当前无 `scoreInputs` 与 `scoreReasons` 持久字段，**难以对单条 item 做审计级解释**。

## 6. evidenceChain 审计

生命周期：
1. provider 构造 `evidence[]`（server/sources/*）
2. server `normalizeEvidenceArray()` 验证并清洗
3. `enhanceWithMarketKnowledge()` 合并知识库 evidence
4. API 返回 items.evidence
5. 前端：
   - 卡片：提取 strongest evidenceStrength + newest retrievedAt
   - 详情：展示 source/title/retrievedAt/url
   - 分析/报告：转为 evidenceBoard/evidence timeline（多处派生）

### 6.1 字段覆盖评估（Yes / No / Partial）

| 目标字段 | 覆盖 | 现有命名/说明 |
|---|---|---|
| sourceName | Partial | 当前 `source` |
| sourceType | Partial | 当前 evidence 无统一 `sourceType`，通过 `type`/上下文推断 |
| sourceUrl | Partial | 当前 `url` |
| title | Yes | `title` |
| summary | No | evidence 本身无 summary（有时在 metadata 或外层 summary） |
| observedAt | No | 无 |
| publishedAt | No | 无（item.publishTime 非 evidence 级） |
| retrievedAt | Yes | `retrievedAt` |
| evidenceStrength | Yes | `evidenceStrength` |
| provenance | No | 无统一字段 |
| confidence | No | 无统一字段 |
| supportsClaims | No | 分析链路里 `evidenceBoard.supports` 有，但 opportunities item 无 |
| limitations | No | 无统一字段 |
| provider status | Partial | response 级 `providerStats`，非 evidence/item 级 |

## 7. 风险与核心判断审计

### 7.1 风险字段

- `paymentRisk/localizationRisk/competitionRisk/complianceRisk/acquisitionRisk/aiCostRisk`
  - 类型：`number?`
  - 来源：
    - provider 固定规则值（如 40/45）
    - 或 `market-entry-knowledge.seed.json` 补齐
  - 性质：规则 + 知识库，不是实时观测
  - 覆盖：多数有，但并非所有来源/所有项都天然有（依赖增强）
  - 依据字段：缺少结构化 `basis/provenance/confidence`
  - 等级：前端可按阈值映射 high/medium/low（派生）

### 7.2 核心判断字段（详情抽屉当前）

位置：`client/src/pages/OpportunitiesPage/index.tsx` `OpportunityDrawer`

- 核心判断：`positiveReason`（由 `reasonPositive[0]` 或 `summary` 截断）
- 风险理由：`riskReason()`（优先 riskFlags，其次 reasonNegative，再按最高风险分映射文案）
- 市场/产品类型：`targetMarket/productType`（缺失时 fallback 文案）
- 证据强度：从 evidence strongest 计算
- CTA：“评估是否适合我” -> `/analyze?...`

判定：
- 多为规则/模板/派生，不是 LLM；
- provenance/confidence 缺失；
- 可为空，且经 fallback 文案填充；
- 可能与 API 原始语义不一致（例如风险理由来自前端二次组合）。

## 8. real / mock / fallback 审计

1. real 识别：`/api/opportunities?source=real` 或 query `source=real`，response.source=real。
2. mock 识别：`/api/opportunities`（默认）response.source=mock。
3. fallback 识别：
   - OpportunitiesPage 在 API 失败时使用 `getHotspotList()`（client 本地 seed）。
   - Analyze 工作流的 fallback 来自 server 规则（source=fallback）。
4. providerStats：**response 层**，非 item 层。
5. 单条机会来源状态：无显式 item 级 real/mock/fallback 字段。
6. fallback 显示强证据风险：
   - 客户端 fallback 通常 evidence 缺失，强证据概率低；
   - 但缺少硬性防护字段，理论上可被错误标注。
7. fallback 使用正式 score：
   - 是，前端统一公式都会算 `valueScore`。
8. UI 区分：
   - 有 dataSource 文案区分（真实信号/预验证样本），但 item 级不明显。
9. 后续避免混淆建议：
   - 增加 item 级 `dataTier` + evidence 级 provenance。

## 9. CTA 和验证流程审计

代码位置：
- `client/src/pages/OpportunitiesPage/index.tsx` `buildAnalyzeHref()`
- `client/src/pages/AnalyzePage/index.tsx`

### 9.1 传递方式

- 使用 URL query（不是 session/localStorage）：
  - `source=real`
  - `auto=1`
  - `opportunityId`
  - `q`（拼接 title/productType/市场/summary/理由/风险）
  - `targetMarket`
  - `productType`

### 9.2 行为

- 会触发 Guided Clarification：是（`parseClarificationResult`）
- 会触发自动分析：当 5 个条件均 explicit 时自动 `runAnalyze`，否则进入补问
- 重复 stream 风险：
  - 有 `AUTO_RUN_ONCE_PREFIX` + `handledAutoRunRef` 防重复
  - `AbortController` 取消旧请求，风险可控
- 状态污染风险：
  - AnalyzePage 对 query change/autoRunKey 切换会清空 clarificationSession，已有防护
- 复用 IA 重构可行性：
  - 高，可继续复用 `buildAnalyzeHref + auto-run + clarification` 链路。

## 10. 字段真实性分类

### 10.1 当前真实已有

- `id/title/source/publishTime/trendVelocity/discussionVolume/contentFit/commercialValue/competitionLevel`
- `targetMarket/productType`（规则生成但可稳定返回）
- `evidence[].title/url/source/type/retrievedAt/evidenceStrength`
- response `providerStats`

### 10.2 当前已有但需要核查稳定性

- `reasonPositive/reasonNegative`（real 常缺，由前端重算）
- `score/verdict`（real item 无，前端派生）
- `paymentRisk/localizationRisk/...`（部分 provider + 知识库混合）
- `sourceType`（类型定义与实际值不一致）

### 10.3 当前确定性可计算

- strongestEvidenceStrength（由 evidenceStrength 排序）
- evidenceCount/sourceCount/最新 retrievedAt
- 排名、排序、风险等级（阈值）
- URL 缺失率（evidence.url 是否为空）

### 10.4 当前只能模型推断

- 团队适配、卖点优先级、增长原因、进入门槛软判断
- 深层“为什么现在适合做”

### 10.5 当前待验证

- 付费意愿、转化潜力、留存潜力、价格接受度
- 获客成本可行性（真实渠道表现）

### 10.6 当前禁止展示

- estimatedMAU/DAU/转化率/留存率/收入/精确增长率/市场规模/停留时长（无可信来源）

## 11. V1 模块字段映射

### 模块 0：机会身份
- 可直接用：`title/productType/targetMarket/source/publishTime`
- 前端可算：`sourceCount/最新evidence时间`
- 后端需增：item 级 `dataTier`（real/mock/fallback）
- 模型推断：无
- 必须隐藏：虚构增长指标
- V1 可上线：**可**
- 缺失展示：`待确认`

### 模块 1：信号判断
- 可直接用：`evidenceStrength(派生)`、`summary`
- 前端可算：来源覆盖摘要
- 后端需增：`coreJudgment.provenance/confidence/limitations`
- 模型推断：核心判断解释段
- 必须隐藏：未经证据支持的因果判断
- V1 可上线：**可（基础版）**

### 模块 2：关键依据
- 可直接用：`evidence.title/source/url/retrievedAt/evidenceStrength`
- 前端可算：按强度/时间排序
- 后端需增：`observedAt/supportsClaims/limitations/provenance`
- 模型推断：证据解释文本
- 必须隐藏：无法追溯的“硬结论”
- V1 可上线：**可（但解释力弱）**

### 模块 3：主要风险与证据边界
- 可直接用：`paymentRisk/localizationRisk/competitionRisk/...`
- 前端可算：level(high/medium/low)
- 后端需增：`risk[].basis/provenance/confidence`
- 模型推断：未覆盖风险项说明
- 必须隐藏：无依据的风险断言
- V1 可上线：**部分可**

### 模块 4：进入条件
- 可直接用：几乎无（仅 assumptions 的弱字段）
- 前端可算：缺失项计数
- 后端需增：结构化适配字段（团队/预算/能力）
- 模型推断：适合/不适合团队
- 必须隐藏：伪精确适配评分
- V1 可上线：**不建议完整上线**

### 模块 5：下一步验证
- 可直接用：CTA、Analyze actionPlan/7d plan（来自 analyze 结果）
- 前端可算：默认 24h/7d 卡片
- 后端需增：可追溯 stopGate basis
- 模型推断：策略细节
- 必须隐藏：承诺式结果
- V1 可上线：**可（结合 analyze 返回）**

### 模块 6：数据说明
- 可直接用：`providerStats/generatedAt/evidenceCount`
- 前端可算：缺失字段提示、来源覆盖
- 后端需增：`scoreVersion/scoreInputs`
- 模型推断：无
- 必须隐藏：把 providerStats 当机会价值
- V1 可上线：**可**

## 12. 建议新增字段（仅建议，不实现）

### P0：详情可信度必须字段

| 字段 | 当前是否已有类似 | 为什么需要 | 建议生成方 | 是否改 API | 是否阻塞 V1 |
|---|---|---|---|---|---|
| sourceName | Partial(`source`) | 统一命名 | 后端 | 是 | 否 |
| sourceType | Partial(`type`推断) | 跨来源一致 | 后端 | 是 | 否 |
| sourceUrl | Partial(`url`) | 可追溯 | 后端 | 是 | 否 |
| observedAt | 无 | 观测时间语义 | 后端 | 是 | 否 |
| retrievedAt | 有 | 保留 | 后端 | 否(已存在) | 否 |
| provenance | 无 | 区分观测/知识库/推断 | 后端 | 是 | **是（对可信详情）** |

### P1：证据解释字段

| 字段 | 当前类似 | 说明 |
|---|---|---|
| supportsClaims | analyze.evidenceBoard 有 supports | 应下沉到 opportunity evidence 统一使用 |
| limitations | 无 | 明确边界，防过度解读 |
| confidence | 无 | 证据置信度，不等于 verdict confidence |

建议后端生成，API 变更；不阻塞“基础 V1”，但阻塞“可解释 V1”。

### P1：结构化风险字段

建议 `risk[]`：
- `category`
- `level`
- `statement`
- `basis`
- `provenance`
- `confidence`

当前仅数值风险可派生 level，缺 basis/provenance/confidence。

### P2：评分审计字段

- `scoreVersion`
- `scoreInputs`
- `scoreReasons`

当前无等价字段。建议后端返回（或前端回写）统一审计对象。

> 禁止建议字段（estimatedMAU/estimatedConversion/estimatedRetention/estimatedRevenue/estimatedMarketSize）本报告未建议。

## 13. 拟修改文件清单（未来轮次，非本轮）

| 文件 | 修改目的 | 前端/后端 | 风险 | 建议轮次 |
|---|---|---|---|---|
| `server/index.js` | opportunities item 增加 provenance/dataTier/score audit 字段 | 后端 | 中 | Round 4F.1B-2 |
| `server/sources/*.js` | evidence 结构统一（sourceName/sourceType/sourceUrl/observedAt） | 后端 | 中高 | Round 4F.1B-2 |
| `client/src/types/hotspot.ts` | 与实际 API 对齐，补充新字段 | 前端 | 中 | Round 4F.1B-2 |
| `client/src/api/fetchOpportunities.ts` | 新字段响应类型校验 | 前端 | 中 | Round 4F.1B-2 |
| `client/src/pages/OpportunitiesPage/index.tsx` | 详情面板模块化重排与边界展示 | 前端 | 中 | Round 4F.1C |
| `client/src/viewModels/*Adapter.ts` | 证据/风险标准化映射 | 前端 | 中 | Round 4F.1C |

## 14. 风险与失败路径

1. 把 `providerStats` 当机会价值（会把“源状态”误读成“机会强度”）。
2. 把 fallback/mock 当真实观测（缺 item 级 dataTier，容易混淆）。
3. 把模型推断当观测数据（缺 provenance）。
4. 隐藏分数后破坏排序、筛选与报告摘要一致性。
5. 字段缺失被当 0（风险等级和结论偏移）。
6. CTA 改造不当破坏 Guided Clarification 或触发重复 stream。
7. 详情抽屉继续重复卡片信息而不增加证据解释价值。

## 15. 最终建议

**结论：需要补充代码/API 核查后再开发。**

理由：
- 详情 V1 的“可信解释”目标依赖 evidence/risk/provenance 结构化字段，而当前仅满足展示层，不满足审计层。
- 评分链路缺少 score 审计字段，无法支持“可解释分数”需求。
- real/mock/fallback item 级边界不清，若直接重构详情易造成“数据真实性误导”。

---

## 附录 A：核心审计问题 A-H 直答

### A. Opportunity 类型与数据模型
- 已覆盖类型：`HotspotItem/HotItem/OpportunitiesResponse/EvidenceItem/ProviderStats/ScoreExplanation/StandardRiskItem/AnalyzeRequest/AnalyzeResponse/SavedReportV1`。
- 字段是否模型推断：`productType/category/riskReason/positiveReason` 有规则推断属性；analyze/report 层包含更多推断字段。

### B. 正式 API 单条机会结构
- 已抓 real 样本：App Store、HN、GitHub。
- Product Hunt/GDELT：当前 providerStats 显示不可用（token 未配置、无有效文章）。
- fallback/seed：客户端 `hotspots.seed.json` + server mock seed。

### C. 评分数据链路
- `calculateHotspotScore` + `buildScoreExplanation` 仅前端执行。
- score 不仅排序，也影响筛选、详情显示、VM confidence、报告摘要。

### D. 证据数据链路
- 从 provider -> server normalize/enhance -> API -> 前端详情/报告。
- evidence 字段覆盖不足以支撑“证据边界解释”。

### E. 风险字段
- 数值风险主要来自 provider 规则 + market knowledge seed。
- 缺乏结构化依据与可信度。

### F. 核心判断与推断字段
- 详情当前“核心判断/风险理由”多为前端派生模板，不是 API 显式 verdict block。

### G. real/mock/fallback 边界
- response 级有，item 级不足；是当前误解风险核心。

### H. CTA 与验证工具数据传递
- query 传递 + auto-run + clarification + stream；已有去重与 abort 防护。

