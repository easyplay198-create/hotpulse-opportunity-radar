# Round 4F.1C 评分语义审计

## 1. 执行摘要

### 当前 0-100 分到底代表什么

当前公开展示的 0-100 分（`valueScore`）本质是**前端规则加权指数**，由 5 个 0-100 输入字段线性加权后四舍五入得到，不是外部统一市场指标，也不是成功概率或投资回报率。

公式（代码实锤）：

```text
score =
0.3 × trendVelocity
+ 0.2 × discussionVolume
+ 0.25 × contentFit
+ 0.2 × commercialValue
- 0.15 × competitionLevel
```

对应代码：
- `client/src/features/hotspot-scoring/score.ts`
- `client/src/features/hotspot-scoring/score-config.ts`

### 是否适合继续公开

不建议继续以“综合分”形式公开当前 0-100 分。
建议结论：**公开隐藏、内部暂时保留**。

### 最大三个误导风险

1. **伪精确风险**：`67` vs `66` 看似可比较，但跨来源输入语义并不一致（App Store/HN/GitHub/GDELT/Product Hunt 量纲不同）。
2. **可信度误读风险**：证据强度、证据数量、来源数量、dataTier、provider 健康状态都不进入该分值，用户却容易把高分理解为“高可信”。
3. **风险已纳入误读风险**：`paymentRisk/localizationRisk/complianceRisk/acquisitionRisk/aiCostRisk/competitionRisk`不进入该分值，用户仍可能误读为“综合风险已考虑完”。

### 短期建议（V1）

- 前台隐藏数值总分展示（卡片角标、详情综合分、高分榜文案）。
- 内部继续保留 score 供排序与兼容逻辑使用。
- 外显以“证据强度 + 关键风险 + 下一步动作”替代“单一总分”。
- verdict 继续保留但降级语义（从“进入建议”改为“验证优先级标签”）。

### 长期建议（V2）

- 建议启动 Score V2（非本轮实施），引入：`scoreVersion`、`scoreInputs`、`scoreReasons`。
- 明确 evidence-aware 与 risk-aware 机制，避免与可信度/风险脱钩。
- 按来源与产品类型进行归一化或分桶，不再直接跨源硬比较。

---

## 2. 当前评分公式与输入字段

### 2.1 公式、阈值、解释

- 评分函数：`calculateHotspotScore()` in `client/src/features/hotspot-scoring/score.ts`
- 权重配置：`SCORE_WEIGHTS` in `client/src/features/hotspot-scoring/score-config.ts`
- verdict 阈值：`VERDICT_THRESHOLDS` in `client/src/features/hotspot-scoring/score-config.ts`
  - `>=75` -> `do_now`
  - `>=50` -> `watch`
  - `<50` -> `skip`
- 解释文本：`buildScoreExplanation()` in `client/src/features/hotspot-scoring/score-explain.ts`
  - 高/低阈值仅按 70/40 划分描述词，不改变分值。

### 2.2 输入字段审计（按字段）

| 字段 | 类型 | 输入范围 | 生成位置 | 原始观测 or 派生 | 缺失处理 | 误读风险 |
| -- | -- | -- | -- | -- | -- | -- |
| `trendVelocity` | number | 0-100（clamp 后） | 各 provider：`server/sources/*.js`；seed：`server/data/opportunities.seed.json`、`client/src/data/hotspots.seed.json` | 多为“外部观测映射 + 内部规则”混合 | provider 内部默认 0 或规则基值后 clamp；seed 固定值 | 容易被误解为真实市场增速 |
| `discussionVolume` | number | 0-100（clamp 后） | 同上 | 多为“外部观测映射 + 内部规则”混合 | 同上 | 容易被误解为跨平台可比讨论量 |
| `contentFit` | number | 0-100（clamp 后） | 同上 | 基本为关键词规则派生 | 多由固定底座 + regex 命中 | 易被误解为客观用户匹配度 |
| `commercialValue` | number | 0-100（clamp 后） | 同上 | 基本为关键词规则派生 | 多由固定底座 + regex/价格字段 | 易被误解为真实商业价值 |
| `competitionLevel` | number | 0-100（clamp 后） | 同上 | 部分来源由观测映射，部分来源规则估算 | 默认 0 或规则底座后 clamp | 易被误解为真实竞品格局数据 |

### 2.3 字段在映射链路中的落地

- 前端统一在 `client/src/api/getHotspotList.ts` 使用 `HotspotScoreInput` 读取上述 5 字段，并重新计算 `valueScore` 与 `verdict`。
- 即使 transport item 内有 `score/verdict`（seed 常见），前端当前仍**以本地公式重算结果为准**。

---

## 3. 输入字段真实性分类

分类定义采用题述 A-F。

| 字段 | 类别 | 生成位置 | 真实来源 | 可否公开描述为市场事实 | 限制 |
| -- | -- | -- | -- | -- | -- |
| `trendVelocity` | B + C（混合） | `server/sources/hackerNewsOpportunities.js` / `appStoreOpportunities.js` / `githubOpportunities.js` / `productHuntOpportunities.js` / `gdeltOpportunities.js` | points/comments/stars/rating 等映射 + freshness/规则底座 | 不建议直接描述为“市场增速事实” | 跨源量纲不同，GDELT/seed 更偏规则 |
| `discussionVolume` | B + C（混合） | 同上 | comments/ratingCount/forks/issues 等映射；GDELT 为 index 映射 | 不建议 | 跨平台原始计数含义差异大 |
| `contentFit` | C | 同上 | regex 关键词命中（标题/描述/topic） | 不可描述为市场事实 | 主观规则强、可复现但不等于客观需求 |
| `commercialValue` | C（App Store部分含B） | 同上 | 关键词命中；App Store 含 free/paid 简单规则 | 不可描述为市场事实 | 不含真实收入/ARPU/LTV |
| `competitionLevel` | B + C（混合） | 同上 | stars/forks/points/comments 映射 + 类别规则 | 不可描述为完整竞品事实 | 未接入系统化竞品覆盖率与价格带数据 |

补充：
- D（知识库补充）主要进入风险类字段与 evidence（`HotPulse Market Knowledge`），**不进入本 5 输入分数公式**。
- E（模型推断）不在该 5 输入生成链路中。
- F（不明来源）主要出现在 seed/mock 的手填数值，无法追溯原始外部观测过程。

---

## 4. 跨来源可比性

### 4.1 来源生成差异（代码依据）

- App Store：评分/评分数映射 + 文本 regex（`server/sources/appStoreOpportunities.js`）
- Hacker News：points/comments/freshness 映射 + 文本 regex（`server/sources/hackerNewsOpportunities.js`）
- GitHub：stars/forks/issues/freshness 映射 + 文本 regex（`server/sources/githubOpportunities.js`）
- Product Hunt：votes/comments 映射 + 文本 regex（`server/sources/productHuntOpportunities.js`）
- GDELT：文章标题/域名/国家/queryName + index 规则（`server/sources/gdeltOpportunities.js`）
- mock seed：静态手工种子（`server/data/opportunities.seed.json` via `server/sources/mockOpportunities.js`）
- fallback seed：客户端静态种子（`client/src/data/hotspots.seed.json`）

### 4.2 必答问题

1. 同一个 `trendVelocity=70` 在 App Store/HN/GitHub 是否同义？
   - **否**。三者底层映射分别基于 rating+ratingCount、points+freshness、stars+freshness。语义不同。

2. `discussionVolume` 是否跨平台同量纲？
   - **否**。HN 用 comments+points，GitHub 用 forks+issues，App Store 用 ratingCount+rating，GDELT 甚至含 index 规则。

3. `commercialValue` 是否有统一可验证依据？
   - **否**。主要是关键词规则与少量价格字段，不是统一商业指标。

4. `competitionLevel` 是否真的来自竞品数据？
   - **部分否**。多数是“热度代理 + 规则估算”，不是完整竞品图谱。

5. `contentFit` 是否只是内部主观规则？
   - **基本是**。由 regex/关键词规则派生。

6. 不同来源放进同一总分是否具数学可比性？
   - **弱可比，不具严格可比性**。

7. real/mock/fallback 使用同一公式是否合理？
   - 工程上“可复用”，语义上“风险高”。同一公式会放大“样本/回退数据与真实数据等价”的误读。

8. 67 和 66 是否代表稳定机会差异？
   - **不能保证**。分差可能仅由映射阈值、regex 命中或来源差异导致。

---

## 5. 评分与证据的关系

### 5.1 是否参与分数（结论）

- `evidenceStrength`：**不参与 score**
- `evidenceCount`：**不参与 score**
- `sourceCount`：**不参与 score**
- `provenance`：**不参与 score**
- `dataTier`：**不参与 score**
- provider 可用状态：**不参与 score**
- 是否有外部 URL：**不参与 score**

代码依据：
- 分数仅由 `HotspotScoreInput` 五字段构成：`client/src/features/hotspot-scoring/score.ts`
- 证据/来源/dataTier 在 score 计算链路中未读取。

### 5.2 风险分析

1. 低证据 item 高分：**可能**（分数不看证据强度）。
2. fallback item 高分：**可能**（公式同构）。
3. mock 高于 real：**可能**（同公式，输入可更“漂亮”）。
4. 单一来源高于多来源：**可能**（sourceCount 不参与）。
5. 高分但无外部 URL：**可能**（URL 不参与 score）。
6. 用户误解高分=高可信：**高概率发生**。

---

## 6. 评分与风险的关系

### 6.1 风险字段是否参与 score

以下均**不参与** `calculateHotspotScore`：
- `paymentRisk`
- `localizationRisk`
- `competitionRisk`
- `complianceRisk`
- `acquisitionRisk`
- `aiCostRisk`

注意：`competitionLevel`（入分）与 `competitionRisk`（不入分）是不同字段，语义并不等价。

### 6.2 风险分析

1. 高风险机会仍可能高分：**是**。
2. `competitionLevel` vs `competitionRisk`：**两个概念，且来源链路不同**。
3. UI 是否易误读“分数已含风险”：**是**（“综合分”文案易误导）。
4. “综合分”命名是否准确：**不准确**，更接近“规则机会指数”。
5. `reasonPositive/reasonNegative` 是否完整反映风险：**否**，仅覆盖 5 输入字段高低，不覆盖全风险域。

---

## 7. 分数和 verdict 使用范围

### 7.1 关键使用点总览

| 文件 | 函数/组件 | 使用字段 | 用途 | 用户可见 | 隐藏总分后的影响 |
| -- | -- | -- | -- | -- | -- |
| `client/src/features/hotspot-scoring/score.ts` | `calculateHotspotScore` | `trendVelocity...competitionLevel` | 计算 `score` | 否（计算层） | 内部保留即可 |
| `client/src/features/hotspot-scoring/score-config.ts` | `getVerdictFromScore` | `score` | 产出 `do_now/watch/skip` | 间接可见 | 若隐藏分数，verdict 仍可保留 |
| `client/src/api/getHotspotList.ts` | `buildHotspotListFromItems` | `valueScore`,`verdict` | transport->view 映射与重算 | 间接可见 | 核心兼容点，建议保留 |
| `client/src/pages/OpportunitiesPage/index.tsx` | `OpportunityGrid`/排序预设 | `score`,`valueScore`,`verdict`,`highScore` | 卡片展示、默认排序、`高分机会榜`、筛选 | 是 | 需替换 UI 文案与筛选入口 |
| `client/src/pages/SignalsPage/index.tsx` | `sortKey=score` | `valueScore` | 信号榜默认排序之一 | 是 | 需改排序名与说明 |
| `client/src/components/HotList.tsx` | 卡片 | `valueScore`,`verdict` | 机会分与建议标签 | 是 | 直接受影响 |
| `client/src/components/TopOpportunities.tsx` | top3 | `valueScore`,`verdict` | 首页/模块榜单展示 | 是 | 直接受影响 |
| `client/src/components/OpportunityMatrix.tsx` | matrix | `valueScore`,`verdict` | 坐标定位与分组统计 | 是 | X/Y文案及数值点位需改 |
| `client/src/lib/buildOpportunityRanking.ts` | `buildOpportunityRanking` | `valueScore/score/discoveryScore` | 排名与推荐理由 | 可能间接 | 可内部保留 |
| `client/src/lib/buildDailyIntelligenceBrief.ts` | `rising` 排序 | `valueScore` | Brief 列表构建 | 间接 | 内部可保留，外显需降语义 |
| `client/src/lib/buildDiscoverableOpportunities.ts` | `trendTag` | `valueScore` | “持续升温/值得验证”打标 | 是（间接） | 标签逻辑需复审 |
| `client/src/viewModels/decisionViewModels.ts` | `toScoreBand`,`confidenceFromEvidence` | `score`,`scoreBand`,`confidence`,`verdict` | 统一决策 VM | 是（多页面） | 核心兼容层 |
| `client/src/viewModels/opportunityDecisionAdapter.ts` | `buildOpportunityDecisionVM` | `scoreBand`,`confidence`,`verdict` | 详情/报告/决策条 | 是 | 需同步改显示策略 |
| `client/src/components/ui/ScoreBadge.tsx` | `ScoreBadge` | `score`,`band` | 统一分数视觉组件 | 是 | 若隐藏公开分可停用 |
| `client/src/components/ui/DecisionBar.tsx` | `DecisionBar` | `score`,`scoreBand`,`confidence`,`verdict` | Analyze 结果总览 | 是 | 需改成非数值主导 |
| `client/src/components/report/ReportScoreSummary.tsx` | `ReportScoreSummary` | `valueScore/score` | 报告分数摘要 | 是 | 直接受影响 |
| `client/src/lib/reportStorage.ts` | `saveReport` | `summary.score`,`confidence`,`verdict` | 报告本地持久化 | 是（Report 页） | 需迁移兼容字段 |
| `client/src/pages/ReportPage/index.tsx` | 列表/详情 | `summary.score`,`confidence`,`verdict` | 报告展示 | 是 | 直接受影响 |
| `client/src/components/analyze/AnalyzeMatchedSignals.tsx` | 匹配信号 | `relevanceScore ?? valueScore` | 匹配参考分回退 | 是 | 需避免把 valueScore 当相关性 |
| `client/src/components/TopOpportunityBoard.tsx` | 机会榜 | `discoveryScore`,`confidenceLevel` | 看板展示（文案含“机会分”） | 是 | 需改名/改口径 |
| `client/src/components/ui/OpportunityTable.tsx` | table | `score`,`scoreBand`,`verdict`,`confidence` | 通用决策表格 | 是 | 直接受影响 |

### 7.2 覆盖要求核对

- 机会卡片：已覆盖（`OpportunitiesPage`、`HotList`、`TopOpportunities`）
- 机会详情：已覆盖（`OpportunitiesPage` 抽屉、`OpportunityReportPreview`、`DecisionBar`）
- 默认排序：已覆盖（`OpportunitiesPage`、`SignalsPage`、`HotList`）
- 排序下拉：已覆盖（`OpportunitiesPage`）
- 高分筛选/高分榜：已覆盖（`SignalPreset.highScore` + 文案）
- 状态筛选：已覆盖（`do_now/watch/skip`）
- 首页：已覆盖（`HomePage` 平均分、建议态）
- 验证工具：已覆盖（`AnalyzeMatchedSignals`、`DecisionBar`、`AnalyzeActionReport`）
- 报告：已覆盖（`ReportPage`、`ReportScoreSummary`、`reportStorage`）
- 报告存储：已覆盖（`summary.score` 写入/读取）
- ViewModel：已覆盖（`decisionViewModels`、`opportunityDecisionAdapter`、`analyzeDecisionAdapter`）
- API 请求：已覆盖（`fetchOpportunities` 不带 score 参数；score 为客户端重算）
- 测试：现有测试主要聚焦 data tier/evidence/viewModel，未覆盖 score 语义校验
- fallback/mock：已覆盖（同公式重算）

---

## 8. 用户语义风险

从普通用户认知看，以下表达存在高歧义：
- “综合分 67”
- “高分榜”
- “综合分排序”
- “值得做 / 立即进入 / 暂缓 / 跳过”

用户很可能误解为：
- 成功概率
- 投资回报率
- 市场规模
- 商业价值真实性
- 进入建议（强决策）
- 数据可信度
- 综合风险结论

当前 UI 未充分、持续、强约束地说明：
- 分数是内部规则指数
- 不代表成功概率/市场规模/真实收入
- 不代表证据可信度
- 不代表最终进入建议

---

## 9. 四种迁移方案评估

### 方案 A：继续公开 0-100 分

- 改名建议：`机会指数（规则）` 或 `规则机会信号指数`
- 必加说明：明确“非成功概率/非市场规模/非风险总分/非可信度评分”
- 风险：伪精确仍在，67 vs 66 仍会被过度解读
- 结论：**不建议**

### 方案 B：公开隐藏，内部保留

- 内部保留：排序、兼容历史逻辑、部分模型/适配层
- 卡片右上角：改成“证据强度 + 风险标签”或“验证优先级”
- 默认排序：可继续内部 score 排序，但不外显数值
- 筛选：高分筛选改为“证据较强 / 风险可控 / 需优先验证”
- 报告：`summary.score` 可继续存储但默认不展示
- verdict：保留但改语义文案（验证优先级，不是进入建议）
- 结论：**建议（短期最稳）**

### 方案 C：改为宽区间/阶段状态

- 可由原 score 映射，但若不引入证据/风险仍可能“换皮不换质”
- 若仅映射区间，仍有同样语义缺陷
- 需同步引入 evidence/risk 约束才有意义
- 结论：**可作为过渡，不宜单独落地**

### 方案 D：拆成多维信号，不提供总分

- 可支持维度（现有可用）：证据强度、风险维度、来源范围、dataTier
- 现阶段不可信维度：统一商业价值、跨源竞争压力绝对值
- 需要后续重构：Score V2/归一化/校准机制
- 结论：**中长期最合理方向**

---

## 10. 短期 V1 建议

基于“只用现有数据，不重构公式”：

1. 是否隐藏公开分数：**是**
2. 是否保留内部排序：**是**
3. 是否保留高分筛选：**不建议原样保留**，改为证据/风险导向筛选
4. 是否保留 verdict：**保留，但降级语义**（验证优先级标签）
5. 卡片和详情展示：主展示“证据强度、风险、下一步动作”，弱化或隐藏数值总分
6. 报告 score：可继续存储用于兼容，但默认不作为主结论展示
7. 必增解释文案：明确“非成功概率、非市场规模、非可信度、非风险总分”

---

## 11. 中长期 Score V2 建议

- 需要 Score V2：**是**
- 需要 `scoreVersion`：**是**
- 需要 `scoreInputs`：**是**（用于解释与追溯）
- 需要 `scoreReasons`：**是**
- 需要 evidence-aware score：**是**
- 需要 risk-aware score：**是**
- 需要按来源/产品类型归一化：**是**
- 需要真实用户验证数据校准：**是**（否则仍是规则指数）

---

## 12. 决策矩阵

| 功能 | 当前是否依赖分数 | 用户是否看见 | 短期保留/隐藏/改名 | 技术影响 | 产品风险 |
| -- | -- | -- | -- | -- | -- |
| 卡片右上角分数 | 是 | 是 | 隐藏 | 中 | 高 |
| 详情综合分 | 是 | 是 | 隐藏或改名 | 中 | 高 |
| 综合分排序 | 是 | 是（文案） | 内部保留、外部改名 | 低-中 | 中 |
| 高分榜 | 是 | 是 | 改为“证据较强/优先验证”榜 | 中 | 高 |
| do_now/watch/skip | 是（阈值） | 是 | 保留但语义改名 | 低 | 中-高 |
| report score | 是 | 是 | 默认隐藏，兼容存储保留 | 中 | 高 |
| ViewModel confidence | 部分依赖 score（与证据混合） | 是 | 保留但降 score 权重（后续） | 中 | 中 |
| 首页摘要（averageScore） | 是 | 间接是 | 隐藏 | 低 | 中 |
| 验证工具输入/输出 | 间接依赖 | 是（DecisionBar） | 弱化分数、强化证据与风险 | 中 | 中-高 |

---

## 13. 拟修改文件清单

本阶段不改代码，仅列后续候选影响面：

- `client/src/pages/OpportunitiesPage/index.tsx`
- `client/src/pages/SignalsPage/index.tsx`
- `client/src/components/HotList.tsx`
- `client/src/components/TopOpportunities.tsx`
- `client/src/components/OpportunityMatrix.tsx`
- `client/src/components/ui/ScoreBadge.tsx`
- `client/src/components/ui/DecisionBar.tsx`
- `client/src/components/report/ReportScoreSummary.tsx`
- `client/src/pages/ReportPage/index.tsx`
- `client/src/lib/reportStorage.ts`
- `client/src/viewModels/decisionViewModels.ts`
- `client/src/viewModels/opportunityDecisionAdapter.ts`

---

## 14. 风险和失败路径

### 风险

1. 只隐藏显示不改文案，用户仍会把 verdict 当强进入建议。
2. 只改 UI 不改数据语义，内部团队仍会用分数做过度决策。
3. 直接移除 score 而不做兼容，会破坏排序/存量报告读取/VM 结构。

### 失败路径

- 失败路径 A：公开分数继续保留 + 不加强免责声明 -> 误导持续累积。
- 失败路径 B：一刀切删 score -> 排序与历史数据兼容破坏。
- 失败路径 C：仅换皮成等级标签 -> 伪精确问题迁移而非解决。

---

## 15. 最终建议

**结论选择：公开隐藏、内部暂时保留。**

理由：
1. 当前分数是规则指数，不具备跨来源严格可比与可解释性。
2. 与证据可信度、风险完整性脱钩，前台公开容易形成错误决策暗示。
3. 立即完全重构会阻塞当前节奏；短期最稳是“前台降语义 + 内部保兼容”，并为 Score V2 留接口。

---

## 附：必答核对（简表）

### verdict 语义核对

- verdict 是否完全由 `valueScore` 决定：**是（hotspot 评分链路）**
- evidenceStrength 是否改变 verdict：**否**
- 风险字段是否改变 verdict：**否（competitionRisk 等不参与）**
- dataTier 是否改变 verdict：**否**
- 缺失证据是否改变 verdict：**否（会影响其他层，不影响该阈值逻辑）**
- 阈值是否有数据验证依据：**当前代码层未见校准证据**

### 是否阻塞详情 UI 重构

- **不阻塞结构重构本身**，但若继续公开现有总分，会持续引入语义风险。
- 建议在详情 UI 重构前先确定“分数公开策略（至少隐藏/降级）”。
