# 万道出海 · HotPulse / HotPulse Market Opportunity Radar

万道出海 · HotPulse 是一个“出海企业情报站 + MVP 前市场验证与机会决策系统”。

它不是旧版热点速判工具，不是内容创作者选题工具，不是普通 AI 热榜，也不是大而全数据聚合平台。

## 产品分层
第一层是出海企业情报站，用“今日出海机会简报”提高打开频率。

第二层是可追溯机会发现，把资讯、案例、趋势、信号转译成机会假设。

第三层是机会顾问，结合企业自身条件做个性化匹配。

第四层是验证报告，输出可执行 MVP 验证方案。

第五层是执行服务入口，承接支付、本地化、token、上架、投流等服务。

产品闭环：出海情报 → 信号识别 → 机会发现 → 个性化匹配 → 验证报告 → 执行服务。

## 数据来源说明

1. 默认 API Mock
- `/api/opportunities`
- 用于稳定演示和页面结构验证
- 不是最终市场结论

2. 真实证据源
- `/api/opportunities?source=real`
- Hacker News：技术社区讨论信号（当前返回 20 条）
- Apple App Store / iTunes Search API：应用商店信号（当前 10 条）
- GitHub Search API：开发者 / 开源趋势信号（当前 10 条）
- Product Hunt GraphQL API：新产品趋势与发布信号（配置 `PRODUCT_HUNT_TOKEN` 时最多 10 条）
- HotPulse Market Knowledge：静态市场进入知识库，用于支付、本地化、合规、获客、AI 成本等进入前诊断

3. fallback
- 当前端 API 不可用时使用本地 seed
- 用于保证原型可演示

真实信号只代表可追溯线索，不等于完整市场结论。市场信号榜是原始信号池，不等同于可直接进入机会。

`/api/opportunities?source=real` 的当前口径：
- 未配置 `PRODUCT_HUNT_TOKEN`：HN 20 + App Store 10 + GitHub 10 = 40 条
- 已配置 `PRODUCT_HUNT_TOKEN`：HN 20 + App Store 10 + GitHub 10 + Product Hunt 最多 10 = 约 50 条

如果 Product Hunt token 缺失，`providerStats.productHunt` 会返回 `ok: false` 与 `skippedReason`，但不会影响其他来源。

## 部署说明

### 本地开发
- 启动后端：`cd server && npm run dev`
- 启动前端：`cd client && npm run dev`
- 打开：`http://127.0.0.1:5173/?source=real`

### 前端部署到 Vercel
- Root Directory: `client`
- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`
- Environment Variables:
  - `VITE_API_BASE` = Railway 后端公网地址，不要末尾斜杠

### 后端部署到 Railway
- Root Directory: `server`
- Start Command: `npm start`
- Environment Variables:
  - `PORT` = Railway 自动注入或留空
  - `CLIENT_ORIGIN` = Vercel 前端域名
  - `PRODUCT_HUNT_TOKEN` = 可选
  - `CACHE_TTL` = 可选（当前默认缓存已足够，不强制）

### 数据源口径
- 无 `PRODUCT_HUNT_TOKEN`：HN 20 + App Store 10 + GitHub 10 + GDELT 最多 10 = 约 50 条
- 有 `PRODUCT_HUNT_TOKEN`：再加 Product Hunt 最多 10 = 约 60 条
- Product Hunt token 缺失时会 skipped，不影响其他 real 数据源

### 部署后验收
- 后端：`/api/health`、`/api/opportunities?source=real`
- 前端：Vercel 页面可打开，数据源状态面板显示 `providerStats`
- Product Hunt 未配置 token 时应显示未启用
- GDELT 正常或异常都不应导致页面崩溃

## 当前关键文档
- `AGENTS.md`：项目协作规则、定位纠偏与工程边界
- `PRD.md`：产品定位、用户、闭环和商业化方向
- `RESEARCH.md`：研究沉淀、风险与差异化判断
- `TECH_DESIGN.md`：当前 API、数据链路和技术语义边界
- `docs/`：产品策略、情报策略、证据体系、数据源策略、商业验证与决策日志
