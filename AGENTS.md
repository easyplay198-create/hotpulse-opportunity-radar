# AGENTS.md

## 项目名称
万道出海 · HotPulse / HotPulse Market Opportunity Radar

## 当前产品定位
万道出海 · HotPulse 是一个“出海企业情报站 + MVP 前市场验证与机会决策系统”。

它不是旧版“热点速判工具”，不是内容创作者选题工具，不是普通 AI 热榜，不是泛资讯站，也不是只针对小团队的工具。“小团队”只是早期优先用户之一，不是产品总定位。

## 目标用户
所有准备出海、正在评估海外市场、需要做海外进入前验证或海外增长决策的企业 / 团队。

### 早期优先用户
- 3-10 人 AI 应用 / 工具 / SaaS 出海团队
- 已有产品想测试海外市场的公司
- 游戏 / 短剧 / 语聊内容产品团队

## 产品分层
1. 出海企业情报站：解决使用频率，让用户每天 / 每周愿意打开。
2. 可追溯机会发现：把资讯、案例、趋势、信号转译成机会假设。
3. 机会顾问：结合用户资源、产品阶段、预算做个性化匹配。
4. 验证报告：输出可执行的 MVP 验证方案。
5. 执行服务入口：承接支付、本地化、token、上架、投流等服务。

产品闭环：出海情报 → 信号识别 → 机会发现 → 个性化匹配 → 验证报告 → 执行服务。

## 当前首页方向
1. 今日出海机会简报
2. 今日可追溯机会发现
3. 案例与模式观察
4. 我的机会顾问
5. 市场信号榜

市场信号榜是原始信号池，不等同于可直接进入机会。可进入机会必须经过证据链、风险、适配度与验证路径判断。

## 明确纠偏
- 不要把项目拉回旧版“热点速判工具”。
- 不要只服务内容创作者。
- 不要只做三平台热榜。
- 不要再做 `/api/hot/weibo`。
- 当前真实来源统一是 `/api/opportunities?source=real`。
- 旧 `HotspotItem` / 内容热点评分模型不是当前核心语义。
- `/api/hotspots` 不是当前主接口。

## 当前真实 API 边界
- 主接口：`/api/opportunities`
- 真实来源：`/api/opportunities?source=real`
- API 不可用时，前端可 fallback 到本地 seed，保证原型可演示。

## 当前关键概念
- Opportunity
- evidenceChain
- evidenceStrength
- providerStats
- paymentRisk
- localizationRisk
- competitionRisk
- market knowledge
- advisor matching
- discoverable opportunities
- intelligence brief

## 工程规则
### 技术栈
前端：
- React
- TypeScript
- Vite

样式与 UI：
- 优先使用现有 CSS / CSS Modules / 普通 CSS 结构。
- 不随意引入 Tailwind、Chakra、MUI、shadcn 或其他新 UI 框架，除非用户明确要求。

状态管理：
- 默认使用 React 局部 state 与派生计算。
- 不主动引入 Zustand、Redux、React Query，除非后续状态复杂度确实需要。

### 开发方式
- 小步迭代，优先保持当前功能稳定。
- 不擅自扩展功能。
- 不新增与本次任务无关的页面、后端逻辑、评分逻辑或数据源。
- Cursor 执行前应说明准备修改哪些文件。
- 如需求模糊，优先按“更轻、更稳、更容易验证”的方向处理。

### 代码结构原则
- 页面层只负责组合模块、获取数据、分发 props、组织页面结构。
- 业务计算应集中在 features / lib / data 相关文件中，不要散落在 JSX 中。
- 类型定义应集中维护，避免在多个组件中重复定义隐式结构。
- 函数命名应体现意图，如 `calculateHotspotScore`、`buildScoreExplanation`、`fetchOpportunities`。

## 当前阶段禁止事项
除非用户明确要求，不要主动：
- 新增功能
- 改前端页面
- 改后端逻辑
- 改评分逻辑
- 改 evidence / providerStats
- 改现有组件
- 新增用户系统、数据库、权限系统、AI 对话框、历史趋势页或部署配置
- 把页面改造成大而全后台或通用数据聚合平台
