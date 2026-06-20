# Round 4F.2A 信号来源覆盖审计

## 1. 执行摘要

- **40 条是否是硬上限**：不是当前代码硬上限。当前 `server/index.js` 的 `/api/opportunities?source=real` 硬上限是 `.slice(0, 50)`。仓库 README 仍有旧口径：“未配置 `PRODUCT_HUNT_TOKEN`：HN 20 + App Store 10 + GitHub 10 = 40 条”，但当前代码中 App Store provider 本身返回 20，真实 API 本轮返回 50。
- **当前真实有效来源数**：用户可见外部来源当前为 3 个：Hacker News、Apple App Store、GitHub。Product Hunt 未配置，GDELT 当前失败/无有效结果。HotPulse Market Knowledge 不是外部 provider，而是本地知识库补充证据，当前每条 item 都附加 1 条。
- **GitHub 失败原因**：本地本轮 GitHub 请求成功，不是 API 返回 0，也不是映射为 0；raw 30、dedup 30、provider valid 15、最终 API 返回 10。若正式环境显示 GitHub 无有效结果，最可能是运行时网络、GitHub API rate limit、正式缓存或 providerStats 旧结果，不是当前映射/URL/字段过滤误杀。
- **GDELT 失败原因**：当前代码对 GDELT 使用 3 个 7 天窗口 query，每个 `maxrecords=10`、8 秒超时。审计中 GDELT 出现 429；另一次有 Commerce query 返回 10 篇 usable article，但噪音很高，且服务端当次 providerStats 为 `GDELT returned no usable articles`。失败路径是外部可用性 + query 相关性 + 新闻噪音共同导致。
- **Product Hunt 缺失原因**：依赖 `PRODUCT_HUNT_TOKEN`。缺失 token 时 provider 不发请求，直接返回 `{ ok:false, skippedReason:'PRODUCT_HUNT_TOKEN is not configured' }`，providerStats 能明确显示未配置。
- **是否应该直接扩到 100**：不建议。当前 50 条里 HN 低互动信号 18 条、所有 item 都只有 1 个外部来源，直接扩大到 100 主要会增加同质化和弱信号，不会等比例增加决策价值。
- **推荐下一步**：选择“先修复现有来源，再扩大候选池”。先处理 GitHub/GDELT/Product Hunt 的可观测性、失败原因与配额设计，再做候选池 100-200 + 默认返回 40-60 + pagination/load more。

## 2. 当前数据链路

当前机会页真实链路：

```text
前端 /opportunities?source=real
→ client/src/api/fetchOpportunities.ts
→ GET /api/opportunities?source=real
→ server/index.js
→ getHackerNewsOpportunities()
→ getAppStoreOpportunities()
→ getGitHubOpportunities()
→ getProductHuntOpportunities()
→ getGdeltOpportunities()
→ ensureEvidenceItem()
→ enhanceWithMarketKnowledge()
→ primaryItems / remainingItems
→ filter(item.evidence.length > 0)
→ slice(0, 50)
→ providerStats.returnedCount
→ API response { source, generatedAt, count, providerStats, items }
→ client buildHotspotListFromItems()
→ OpportunitiesPage local sort/filter
→ OpportunityGrid renders all filtered rows
```

前端 adapter 只做字段映射、排序和筛选：

- `fetchOpportunities('real')`：调用 `/api/opportunities?source=real`，70 秒超时，校验 `count === items.length`。
- `buildHotspotListFromItems()`：把 `HotspotItem[]` 映射为 `HotItem[]`，会重新计算 score/verdict，但不截断数量。
- `OpportunitiesPage`：`items.map(buildRadarOpportunity)` 后按筛选和排序展示；没有额外 `slice(0, N)`。

## 3. 数量上限链路

### 3.1 当前代码中的数量控制

| 阶段 | 文件 | 当前逻辑 | 数量影响 |
|---|---|---:|---|
| HN request | `server/sources/hackerNewsOpportunities.js` | 3 queries × `hitsPerPage=20` | raw 最多 60 |
| HN provider output | 同上 | dedup → valid → `.slice(0, 20)` | provider 最多 20 |
| App Store request | `server/sources/appStoreOpportunities.js` | 3 terms × `limit=25` | raw 最多 75 |
| App Store provider output | 同上 | dedup → valid URL → `.slice(0, 20)` | provider 最多 20 |
| GitHub request | `server/sources/githubOpportunities.js` | 3 queries × `per_page=10` | raw 最多 30 |
| GitHub provider output | 同上 | dedup → valid URL → `.slice(0, 15)` | provider 最多 15 |
| Product Hunt request | `server/sources/productHuntOpportunities.js` | GraphQL `posts(first: 10)` | provider 最多 10 |
| GDELT request | `server/sources/gdeltOpportunities.js` | 3 queries × `maxrecords=10`, `timespan=7d` | raw 最多 30 |
| GDELT provider output | 同上 | usable title/url → dedup → `.slice(0, 10)` | provider 最多 10 |
| API fairness pool | `server/index.js` | 每个 provider 先 `.slice(0, 10)` 进入 primaryItems | 每源最多先占 10 |
| API remaining pool | `server/index.js` | 每个 provider `.slice(10)` 进入 remainingItems | 补充剩余 |
| API final cap | `server/index.js` | `filter(evidence.length > 0).slice(0, 50)` | 当前硬上限 50 |
| Analyze real loader | `server/index.js` | providers flatMap 后 `.slice(0, 50)` | 分析页也受 50 上限影响 |
| Frontend API adapter | `client/src/api/fetchOpportunities.ts` | 校验 count/items | 不截断 |
| Frontend mapper | `client/src/api/getHotspotList.ts` | map 全量 items | 不截断 |
| Frontend page | `client/src/pages/OpportunitiesPage/index.tsx` | sort/filter 全量展示 | 不截断 |

### 3.2 40 从哪里来

当前仓库里没有发现：

- `slice(0, 40)`
- `limit=40`
- `pageSize=40`
- 前端展示 40 的二次截断

能定位到的 40 来源是 README 旧说明：

```text
未配置 PRODUCT_HUNT_TOKEN：HN 20 + App Store 10 + GitHub 10 = 40 条
```

但当前代码已经不是这个分配：App Store provider 返回 20，`server/index.js` 总 cap 为 50。本轮本地 API 实测：

```text
API count = 50
HN returnedCount = 20
App Store returnedCount = 20
GitHub returnedCount = 10
Product Hunt returnedCount = 0
GDELT returnedCount = 0
```

结论：**40 是旧文档/旧生产口径或某次真实结果，不是当前代码硬编码上限。当前代码硬编码上限是 50。**

### 3.3 将上限提高到 100 的影响

需要触达：

- `server/index.js` `/api/opportunities?source=real` final `.slice(0, 50)`。
- `server/index.js` analyze loader `.slice(0, 50)`。
- 各 provider 自身配额：HN 20、App Store 20、GitHub 15、PH 10、GDELT 10；只改总 cap 到 100 不会自动有 100 条。
- 前端 sessionStorage cache：`hotpulse.opportunitiesCache.v1` 存更多 items，体积增大。
- 前端排序/筛选/渲染：当前没有分页，100 条会一次性渲染全部卡片。
- API timeout：real source 前端 70 秒，GDELT 8 秒内部超时；提高 provider 配额会增加失败概率。
- UI 风险：列表更长、弱信号更多、详情打开前筛选负担增大。

## 4. Provider 状态表

本轮本地 API 调用时间：2026-06-20T08:49Z 左右。

| Provider | provider 文件 | 请求入口 | 查询参数 | 默认数量 | raw | 映射成功/valid | 过滤掉 | 去重后 | 最终进入 API | providerStats | 最近失败原因 | 密钥 | 分页 | 速率限制处理 | 重复风险 | 数据质量风险 |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---|---|---|---|---|---|---|
| Hacker News | `server/sources/hackerNewsOpportunities.js` | `getHackerNewsOpportunities()` | `AI tool`, `developer tool`, `SaaS startup`; `hitsPerPage=20`; `tags=story` | 20 | 60 | 20 | 40 by provider slice | 60 | 20 | ok true, fetched 20, returned 20 | 无 | 否 | 否 | objectID dedup，可去重同帖 | 低互动多，技术社区偏样本 |
| Apple App Store | `server/sources/appStoreOpportunities.js` | `getAppStoreOpportunities()` | `ai assistant`, `productivity app`, `developer tool`; `entity=software`; `limit=25` | 20 | 68 | 20 | 46 by provider slice / 2 duplicate | 66 | 20 | ok true, fetched 20, returned 20 | 无 | 否 | 否 | trackId dedup | 大厂/高评分 app 占比高，国家默认为 Global |
| GitHub | `server/sources/githubOpportunities.js` | `getGitHubOpportunities()` | `ai tool`, `developer tool`, `llm agent`; `sort=stars`; `order=desc`; `per_page=10` | 15 | 30 | 15 | 15 by provider slice | 30 | 10 | ok true, fetched 15, returned 10 | 本地无失败；正式若失败需查 rate/network/cache | 否，但未认证速率低 | 支持 API pagination，但当前未用 | 无处理 | repo id dedup | stars 偏历史/开源关注，不等于商业需求 |
| Product Hunt | `server/sources/productHuntOpportunities.js` | `getProductHuntOpportunities()` | GraphQL `posts(first: 10)` | 10 | 0 | 0 | 0 | 0 | 0 | ok false, skippedReason token missing | `PRODUCT_HUNT_TOKEN is not configured` | 是 | GraphQL connection 支持，当前未翻页 | 无处理 | 产品重发/镜像站可能重复 | 发布日热度短，votes 不等于持续需求 |
| GDELT | `server/sources/gdeltOpportunities.js` | `getGdeltOpportunities()` | AI/Content/Commerce 3 queries; `maxrecords=10`; `timespan=7d`; `sort=datedesc` | 10 | 0 或 10 | 0 或 10 | 取决于 429/usable | 0 或 10 | 0 | ok false, error no usable | `GDELT returned no usable articles`; direct raw 曾遇到 429 | 否 | API 支持 maxrecords/startdatetime 等，当前未分页 | 仅 8 秒 abort，无 backoff | URL dedup | 新闻噪音高，产品机会相关性弱 |
| HotPulse Market Knowledge | `server/sources/marketEntryKnowledge.js` + JSON seed | `enhanceWithMarketKnowledge()` | targetMarket normalize 后查本地 seed | 每 item 最多追加 1 条 | 50 evidence | 50 evidence | 不作为独立 item | N/A | 50 evidence | 不在 providerStats | 无外部失败 | 否 | N/A | N/A | 每条都重复附加 Global 知识库 | 不是外部市场信号，不能当独立来源 |

## 5. GitHub 审计

### 5.1 请求是否成功

本地本轮成功：

```text
query "ai tool": status 200, raw 10, total_count 166243
query "developer tool": status 200, raw 10, total_count 32467
query "llm agent": status 200, raw 10, total_count 69525
```

### 5.2 是 API 返回 0，还是映射后变成 0

都不是。本地链路：

```text
raw 30
→ repo.id dedup 30
→ valid html_url 30
→ provider slice(0, 15)
→ ensureEvidenceItem 15
→ API primary GitHub slice(0, 10)
→ final API returnedCount 10
```

### 5.3 查询词是否过窄

不算过窄，反而偏宽。GitHub `total_count` 很高，但 `sort=stars` 会强烈偏向历史头部和通用开源项目，不一定是“近期出海机会”。

### 5.4 时间范围是否过严

代码没有在 query 中设置 `pushed:` 或 `created:` 时间范围，也没有过滤更新时间。`freshnessScore(repo.updated_at)` 只影响评分，不会过滤。

### 5.5 stars / forks / 更新时间过滤是否误杀

没有过滤 stars/forks/更新时间。只用于 evidenceStrength 和内部分数字段。

### 5.6 URL 或字段缺失是否导致过滤

只过滤 `html_url` 不是有效 http(s) 的 repo。本轮 raw 30 中 valid URL 30，没有误杀。

### 5.7 去重是否把 GitHub 数据全部覆盖

没有。GitHub 内部按 repo id dedup，本轮 dedup 后仍 30。API 层没有跨 provider 去重，仅全局 `.slice(0, 50)` 会让 GitHub 15 条中的后 5 条被截断。

### 5.8 providerStats 是否准确

本地准确反映：

```json
{ "ok": true, "fetchedCount": 15, "returnedCount": 10 }
```

注意 `fetchedCount` 实际是 provider valid 后数量，不是 GitHub raw API 数量。

### 5.9 本地与正式环境是否一致

本地当前成功。正式 Render/Railway 若显示 GitHub 无有效结果，需要直接看正式 `/api/opportunities?source=real` providerStats 与服务端日志。当前仓库没有 Render 专用配置文件；README 提到的是 Railway/Vercel 环境变量。

### 5.10 推荐最小修复点

不直接改代码。本轮建议后续 4F.2A-1：

1. providerStats 增加 rawCount / dedupCount / acceptedCount / returnedCount，避免把 fetchedCount 误解为 API raw。
2. GitHub query 增加可配置 recent/quality 策略，而不是单纯 `sort=stars`。
3. 如正式环境经常失败，加入 GitHub unauthenticated rate limit 日志与可选 token，但不阻塞无 token 运行。
4. 全局 cap 改造前，先明确 GitHub returned 10 是 fairness primary cap 造成，不是 provider 失败。

## 6. GDELT 审计

### 6.1 请求是否成功

不稳定。一次 direct raw 中：

```text
AI query: 429
Content query: 429
Commerce query: 200, raw 10, usable 10
```

另一轮 direct raw 中 3 个 query 均 429。服务端 API 当次 providerStats：

```json
{ "ok": false, "fetchedCount": 0, "returnedCount": 0, "error": "GDELT returned no usable articles" }
```

### 6.2 原始 article 数量

按当前代码理论最多 30。实测波动为 0 或 10。

### 6.3 语言、时间、主题条件

- `timespan=7d`
- `sort=datedesc`
- 无语言限制
- 无国家白名单
- query 三组：AI、Content、Commerce

### 6.4 标题或 URL 是否缺失

代码会在 `fetchQuery` 中过滤 `article.title && article.url`。实测 Commerce query 10 篇都有 title/url，但内容相关性较弱。

### 6.5 哪一步判定为 unusable

两条路径：

1. `fetchQuery` 遇到非 2xx，例如 429，会 throw；`Promise.allSettled` 忽略 rejected group。
2. 所有 fulfilled group 汇总后，如果 `items.length === 0`，返回 `{ ok:false, skippedReason:'GDELT returned no usable articles' }`。

### 6.6 是否因为产品机会相关性过低

部分是。Commerce query 样本包括财经、教育、地区新闻等，虽然命中 query，但不是可直接进入机会的产品信号。当前代码没有 relevance filter，只靠 query 文本和 title/url 可用性。

### 6.7 是否存在大量新闻噪音

是。GDELT 是新闻索引，适合宏观事件、政策、支付/合规风险观察，不适合作为默认产品机会 item 源。

### 6.8 当前 GDELT 是否适合继续作为产品机会源

不建议作为默认机会 item provider。更适合降级为：

- 市场背景/风险情报源；
- 特定主题触发的辅助证据；
- signal cluster 的宏观补充，而不是单条 opportunity。

### 6.9 应该修复、降级还是移出默认 provider

建议先降级，不直接移除：

- 4F.2A-1：增加失败观测字段，避免 429 被概括成 no usable。
- 4F.2A-2：从默认机会池中降权或只作为背景候选池。
- 4F.2B：作为 topic cluster 的 secondary sourceRef。

### 6.10 推荐最小处理方案

1. 给 GDELT providerStats 增加 per-query status。
2. 增加简单 domain/language/topic allowlist 或 relevance filter。
3. 对 429 做 backoff/cache，避免连续请求。
4. UI/文案上标记为“新闻/宏观参考”，不要与 App Store/GitHub/HN 同权。

## 7. Product Hunt 审计

### 7.1 当前代码依赖哪种 Token

依赖环境变量：

```text
PRODUCT_HUNT_TOKEN
```

请求使用：

```text
Authorization: Bearer <token>
```

### 7.2 缺少 Token 时具体行为

`fetchProductHuntPosts()` 直接返回：

```js
{ ok: false, skippedReason: 'PRODUCT_HUNT_TOKEN is not configured', items: [] }
```

不会发外部请求。

### 7.3 providerStats 是否明确显示未配置

是。本轮 API：

```json
{
  "ok": false,
  "fetchedCount": 0,
  "returnedCount": 0,
  "skippedReason": "PRODUCT_HUNT_TOKEN is not configured"
}
```

### 7.4 配置后预计使用哪个 endpoint

```text
POST https://api.producthunt.com/v2/api/graphql
```

GraphQL query：

```graphql
posts(first: 10) {
  edges {
    node {
      id name tagline description url website votesCount commentsCount createdAt topics { ... }
    }
  }
}
```

### 7.5 当前字段映射是否完整

基本可展示，但偏轻：

- 有 votes/comments/topics/tagline/website。
- 没有 maker、launch day rank、thumbnail、pricing、company geography。
- 没有分页 cursor。
- 没有跨来源产品 identity。

### 7.6 是否支持分页

Product Hunt GraphQL connection 通常支持 cursor 分页，但当前代码只用 `posts(first: 10)`，没有 `after`。

### 7.7 是否有请求额度或缓存处理

provider 内没有专门额度处理。API 层有 60 秒 in-memory cache。

### 7.8 Token 应放在哪个环境

- 本地：`server/.env` 的 `PRODUCT_HUNT_TOKEN`。
- 正式后端：部署平台的 server 环境变量，例如 Railway/Render dashboard 中的 `PRODUCT_HUNT_TOKEN`。
- 前端/Vercel 不应配置该 token。

### 7.9 本地和 Render/Railway 分别如何配置

本地：只放 server 运行环境，不提交 `.env`。

正式：在后端服务环境变量中配置，重启服务后验证 providerStats 从 skipped 变为 ok 或明确 error。

### 7.10 配置后最小验收样本

1. `/api/opportunities?source=real` 中 `providerStats.productHunt.ok === true`。
2. `fetchedCount > 0`。
3. `returnedCount > 0`，除非被全局 cap 截断。
4. items 中至少 1 条 `source === 'Product Hunt'`。
5. evidence.url 是 Product Hunt URL 或 website URL。
6. 不输出 token，不在前端 bundle 出现 token。

## 8. 当前数据质量与同质化统计

本轮本地 `/api/opportunities?source=real`：

| 指标 | 数量 |
|---|---:|
| API `count` | 50 |
| items.length | 50 |
| Hacker News | 20 |
| Apple App Store | 20 |
| GitHub | 10 |
| Product Hunt | 0 |
| GDELT | 0 |
| HotPulse Market Knowledge evidence | 50 |
| 产品类型：AI 应用 | 20 |
| 产品类型：AI 工具 | 16 |
| 产品类型：开发者工具 | 12 |
| 产品类型：SaaS | 2 |
| 重复标题数量 | 0 |
| 同一产品不同来源重复数量（近似） | 0 |
| 只有一个外部来源的 item | 50 |
| 两个以上独立来源的 item | 0 |
| 低互动 HN（points < 10） | 18 |
| 无有效外部 URL | 0 |
| 无有效 retrievedAt | 0 |
| knowledge_base-only item | 0 |

当前同质化特点：

- 每条 item 都是单 provider 外部信号 + 同一条知识库补充。
- 没有跨来源合并，GitHub/App Store/HN 之间无法形成同一 opportunity topic。
- HN 弱互动占 HN 的 90%（18/20）。
- App Store 多为 AI app / 高评价成熟产品，容易变成竞品观察而非早期机会。
- GitHub 由 stars 排序主导，偏成熟开源项目。

结论：**把 50 或旧口径 40 直接扩大到 100，不会显著增加决策价值；更可能扩大弱信号和同质化样本。**

## 9. 候选池与分页方案

### 方案 1：直接将返回数量改成 100

优点：

- 实现最简单，只改 `.slice(0, 50)` 和 provider 配额。
- 前端改动少，现有列表能直接显示。

缺点：

- 当前 provider 总有效上限约 75（HN20 + AppStore20 + GitHub15 + PH10 + GDELT10），只改 API cap 不会达到 100。
- 单页渲染 100 卡片，筛选前信息密度过高。
- 低互动 HN 和成熟 App Store/GitHub 头部项目变多。
- 不解决“每条只有一个外部来源”的核心问题。

结论：不推荐。

### 方案 2：后端候选池 100-200，API 默认返回 40-60

设计：

- provider raw pool 拉大；
- 后端保留 candidate pool；
- 默认 API 返回 40-60；
- 支持 `limit` / `cursor` / `page` / `load more`；
- providerStats 拆分 raw/dedup/accepted/returned。

优点：

- 保持首屏轻量。
- 可逐步引入过滤、排序、缓存。
- 能记录候选池质量，不把所有候选直接暴露为机会。

风险：

- 需要明确 cache key：source + page/cursor/filter。
- 需要防止 GDELT/Product Hunt 慢请求拖垮默认响应。
- 需要 UI load more / pagination。
- 需要避免 provider 配额之间互相挤压。

结论：推荐作为 4F.2A-2。

### 方案 3：跨来源聚合为机会主题

目标形态：

```text
AI 搜索与浏览器助手
├─ App Store
├─ GitHub
├─ Product Hunt
├─ Reddit
└─ 新闻信号
```

现有代码支持度：

- 现有 item 有 `title/source/evidence/productType/tags`，但没有 cluster/topic identity。
- 没有 `sourceRefs`、`normalizedProductName`、`opportunityTopic`、`independentSourceCount`。
- 去重只在 provider 内，不做跨 provider 语义聚合。

需要新增字段：

- `signalClusterId`
- `opportunityTopic`
- `sourceRefs[]`
- `independentSourceCount`
- `normalizedEntity`
- `clusterConfidence`
- `clusterLimitations`

结论：这是最能提升决策价值的方向，但应放在 4F.2B，等 provider 可观测性和候选池先稳定。

## 10. 新来源优先级

| 来源 | 可提供信号 | 是否适合 HotPulse ICP | 接入方式 | Token | 稳定性 | 合规风险 | 噪音 | 成本 | 建议 |
|---|---|---|---|---|---|---|---|---|---|
| Google Play | Android 海外应用评分、安装量区间、类别 | 高，补齐 App Store 偏 iOS | 官方/第三方/公共页，官方能力有限 | 可能需要第三方 | 中 | 中 | 中 | 中 | P0 |
| Reddit | 目标用户痛点、替代品讨论、社区验证 | 高，适合 MVP 前验证 | Reddit API | 需要 | 中 | 中 | 高 | 中 | P0 |
| Chrome Web Store | 浏览器插件需求、评分、用户量 | 中高，适合 AI 插件/效率工具 | 公共页面/非正式 API | 通常否 | 中低 | 中 | 中 | 中 | P1 |
| npm | JS 工具下载/依赖趋势 | 中高，适合开发者工具 | npm registry API | 否 | 高 | 低 | 中 | 低 | P1 |
| PyPI | Python/AI 工具包下载与维护信号 | 中，适合 AI/devtool | PyPI JSON API + 下载统计需外部源 | 否/视下载源 | 高 | 低 | 中 | 低中 | P1 |
| Stack Overflow | 开发者问题、技术阻塞 | 中，适合 devtool | Stack Exchange API | 可选/建议 | 高 | 低中 | 高 | 中 | P2 |
| App Store reviews 内容 | 用户抱怨、功能缺口 | 高，比评分更有验证价值 | RSS/第三方/页面 | 可能 | 中 | 中 | 中 | 中 | P1 |
| 目标国家 App 排行榜 | 国家/品类热度 | 高，适合出海市场选择 | 第三方/榜单页 | 可能 | 中 | 中 | 中 | 中高 | P1 |
| YouTube 评论或趋势 | 内容产品/短剧/游戏反馈 | 中，适合内容产品 | YouTube Data API | 需要 | 中 | 中高 | 高 | 中高 | P2 |
| AlternativeTo / G2 / Capterra | 替代品、B2B 评价、竞品类目 | 中高，适合 SaaS | 官方/公共页/第三方 | 可能 | 中 | 中高 | 中 | 中高 | P2 |

推荐 4F.2A-3 只选 1-2 个：**Reddit + Google Play**。如果更偏开发者工具，可把 npm 作为 P1 快速补充。

## 11. 跨来源聚合可行性

当前可行，但不是小改。

现有问题：

- item 级 source 是单一 provider；
- evidence 虽可容纳多条，但当前只有“外部 provider + HotPulse knowledge”；
- 没有跨来源实体归一；
- 没有同一产品/主题的 sourceRefs；
- provider returnedCount 仍按 item.source 统计，不适合 cluster 后的多来源 attribution。

可行路线：

1. 保留原始 `SignalItem`。
2. 新增聚合层 `OpportunityTopic`。
3. `OpportunityTopic.sourceRefs[]` 指向原始 signal。
4. 详情页展示“证据链”和“独立来源数”。
5. LLM 机会假设层只消费 topic，不直接消费 raw provider item。

是否阻塞 LLM 机会假设层：

- 4F.2A-1 不阻塞，反而提供更可靠输入。
- 4F.2A-2 部分阻塞；没有候选池和分页，LLM 会受样本截断影响。
- 4F.2A-3 不阻塞，但新增来源前应先有候选池。
- 4F.2B 是高质量 LLM opportunity hypothesis 的关键前置。

## 12. 拟修改文件

本轮不修改代码。后续建议可能涉及：

| 轮次 | 文件 |
|---|---|
| 4F.2A-1 | `server/sources/githubOpportunities.js` |
| 4F.2A-1 | `server/sources/gdeltOpportunities.js` |
| 4F.2A-1 | `server/sources/productHuntOpportunities.js` |
| 4F.2A-1 | `server/index.js` providerStats 字段 |
| 4F.2A-2 | `server/index.js` 数量机制、candidate pool、pagination |
| 4F.2A-2 | `client/src/api/fetchOpportunities.ts` query 参数 |
| 4F.2A-2 | `client/src/pages/OpportunitiesPage/index.tsx` load more/pagination |
| 4F.2B | 新增 cluster/topic builder，例如 `server/lib/buildOpportunityTopics.js` |
| 4F.2B | 类型定义：sourceRefs、independentSourceCount、opportunityTopic |

## 13. 风险与失败路径

- **旧文档风险**：README 仍写 40 条旧口径，和当前代码 50 不一致。
- **providerStats 语义风险**：`fetchedCount` 当前是 valid 后数量，不是 raw API 数量。
- **缓存风险**：server in-memory cache 60 秒；前端 sessionStorage cache 按 source 保存，可能让用户看到旧 providerStats。
- **GitHub rate risk**：未认证 GitHub API 有 rate limit；当前没有 rate limit status 结构化记录。
- **GDELT 429 risk**：无 backoff、无 per-query status 暴露，容易被概括为 no usable。
- **Product Hunt token risk**：token 只能放后端，不能进入 Vercel/frontend。
- **UI 性能风险**：当前列表无分页，返回 100 会一次性渲染。
- **同质化风险**：数量扩大不等于独立来源扩大。
- **分析链路风险**：analyze loader 也有 `.slice(0, 50)`；只改机会 API 会造成页面和分析输入不一致。

## 14. 推荐实施轮次

### 4F.2A-1：修复现有 provider

范围：

- GitHub：增加 raw/dedup/accepted/returned stats；审查正式环境失败原因；可选 token/rate log。
- GDELT：记录 per-query status、429、raw articles、usable articles；降级为辅助信号。
- Product Hunt：配置后验收；不把 token 放前端。

是否阻塞 LLM：不阻塞，但强烈建议先做，避免 LLM 消费错误 provider 语义。

### 4F.2A-2：候选池和数量机制

范围：

- provider 配额；
- candidate pool；
- 去重；
- 默认返回数量；
- pagination / load more；
- cache key 设计。

是否阻塞 LLM：部分阻塞。没有候选池，LLM 输入会受当前 50 条截断和弱信号影响。

### 4F.2A-3：新增来源

建议只选：

- Reddit；
- Google Play。

如果优先服务开发者工具，可替换/补充 npm。

是否阻塞 LLM：不阻塞，但不建议在 4F.2A-1/2 前接入。

### 4F.2B：跨来源机会聚合

范围：

- signal cluster；
- opportunity topic；
- sourceRefs；
- independentSourceCount。

是否阻塞 LLM：是高质量机会假设层的关键前置。否则 LLM 只能在单来源 item 上做弱推理。

## 15. 最终建议

**先修复现有来源，再扩大候选池。**

理由：

1. 当前 40 不是代码硬上限，当前硬上限是 50。
2. 当前有效外部来源只有 3 个，且每条 item 只有 1 个外部来源。
3. GitHub 本地成功但被全局 cap 截到 10；正式失败需要日志和 stats 澄清。
4. GDELT 不稳定且噪音高，不应直接扩大默认输出。
5. Product Hunt 缺 token，是明确配置缺口。
6. 直接扩到 100 会放大弱信号，不会解决独立来源不足。
