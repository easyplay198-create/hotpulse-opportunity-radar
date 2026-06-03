# 万道出海 · HotPulse 技术设计文档

## 1. 文档目标
本文档记录 HotPulse 当前技术设计边界，服务“出海机会情报与市场进入验证”这一产品定位。

HotPulse 当前不是旧版 `/api/hotspots` / `HotspotItem` / 内容热点评分体系。旧 `HotspotItem` / 内容热点评分模型不是当前核心语义。当前技术设计必须服务“出海企业情报站 + MVP 前市场验证与机会决策系统”。

## 2. 当前技术栈
前端：
- React
- TypeScript
- Vite

原则：
- 不随意引入新 UI 框架。
- 小步迭代，避免过度工程化。
- 保持前后端边界可替换。
- 不擅自扩展功能、评分逻辑或数据源。

## 3. 当前真实 API
当前主接口：
- `/api/opportunities`

当前真实来源：
- `/api/opportunities?source=real`

不要再做：
- `/api/hot/weibo`
- 将 `/api/hotspots` 作为当前主接口
- 将课程原版“三平台热榜”作为当前项目目标

## 4. source=real 返回约定
当前 `/api/opportunities?source=real` 应返回：
- Hacker News 10 条
- Apple App Store 10 条
- GitHub 10 条
- 总计 30 条

这些真实来源只代表可追溯线索，不等于完整市场结论。

## 5. 当前数据链路
1. 后端 `/api/opportunities` 提供原始 opportunity items。
2. 前端 `fetchOpportunities` / `getHotspotListFromApi` 获取数据。
3. 前端仍运行 `calculateHotspotScore` + `buildScoreExplanation`。
4. 后端中的静态 `score` / `verdict` 不驱动页面。
5. API 不可用时 fallback 到本地 seed，保证原型可演示。

当前不要随意把评分迁移到后端，除非后续明确进入后端评分阶段。

## 6. 当前关键概念
- Opportunity：当前核心机会 / 信号条目语义。
- evidenceChain：机会或信号背后的证据链。
- evidenceStrength：证据强度，应具备真实区分度。
- providerStats：数据源获取与返回统计，如 fetchedCount / returnedCount。
- paymentRisk：支付适配与收款风险。
- localizationRisk：本地化成本、语言、文化与市场适配风险。
- competitionRisk：竞争压力与进入难度。
- market knowledge：市场进入相关静态知识库。
- advisor matching：结合用户资源和产品阶段的个性化机会匹配。
- discoverable opportunities：经过信号转译后可观察、可验证的机会。
- intelligence brief：今日出海机会简报，用于提高打开频率。

## 7. 技术语义纠偏
- 热门产品不是机会本体，热门产品只是证据、标杆竞品或市场信号。
- 大厂产品不能直接作为机会标题，只能作为证据、标杆竞品或市场信号。
- 机会标题必须是机会假设，不能直接用大厂产品名。
- 市场信号榜是原始信号池，不等同于可直接进入机会。
- 没有真实 evidence 的机会不能生成。
- 没有直接评论证据时，必须写“推断痛点 / 验证假设 / 置信度”。

## 8. 数据源与 providerStats
`providerStats` 用于记录来源链路的健康度和返回情况，不应被当成 opportunity 本身的商业价值判断。

至少应关注：
- provider 名称
- fetchedCount
- returnedCount
- 数据源是否可用
- 数据是否来自 real source 或 fallback seed

本次不改 evidence / providerStats，仅记录当前设计边界。

## 9. 评分边界
当前前端仍运行：
- `calculateHotspotScore`
- `buildScoreExplanation`

这些函数当前承担页面排序与解释展示。后端中的静态 `score` / `verdict` 不驱动页面。

评分逻辑不要在没有明确任务时迁移到后端，也不要扩展新的评分字段。后续如进入“后端评分阶段”，需要单独设计：
- 输入字段
- evidence 权重
- 风险权重
- advisor matching 权重
- 前后端责任划分

## 10. fallback 策略
当 API 不可用时，前端 fallback 到本地 seed。

fallback 的目的：
- 保证原型可演示
- 保证页面结构可验证
- 避免外部数据源不稳定阻断产品体验

fallback 不应被误认为真实市场结论。

## 11. 首页技术方向
当前首页方向包括：
1. 今日出海机会简报
2. 今日可追溯机会发现
3. 案例与模式观察
4. 我的机会顾问
5. 市场信号榜

首页第一屏后续优先服务“今日出海机会简报”，而不是堆完整报告或三平台热榜。

## 12. 当前不做
除非用户明确要求，不要主动：
- 改前端页面
- 改后端逻辑
- 改评分逻辑
- 改 evidence / providerStats
- 改现有组件
- 新增数据源
- 启动前端页面
- 运行构建
