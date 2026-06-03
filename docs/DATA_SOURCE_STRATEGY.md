# HotPulse 数据源策略

## 1. 核心原则
当前核心风险不是数据源不够多，而是容易做成大而全数据聚合平台。

每个数据源都必须直接驱动“验证 / 观察 / 暂不进入”的进入建议。不追求大而全，优先支持 MVP 前进入决策。

当前不只是抓产品信号，还要抓情报信号。产品信号、社区信号、开发者信号、趋势信号、案例信号和资源信号都应服务机会发现与验证判断。

## 2. 未来数据源分类
- 产品信号
- 社区信号
- 开发者信号
- 趋势信号
- 案例信号
- 资源信号

## 3. P0 数据源
- HN Algolia API
- iTunes Search API
- Google Play 非官方 API / Apify
- Product Hunt GraphQL API
- pytrends / Google Trends Alpha API
- NewsAPI / FreeNewsAPI

## 4. P1 数据源
- GDELT
- Exploding Topics
- Appfigures
- GitHub Search API
- Reddit .json 低频访问
- DataReportal 静态知识库
- Stripe / Adyen / Paddle / dLocal / Airwallex 支付文档静态库
- AppsFlyer CPI 基准报告

## 5. P2 暂不碰
- Sensor Tower
- Brandwatch
- TikTok Official Research API
- Reddit Commercial API
- Semrush API
- CB Insights
- Crunchbase
- Similarweb

## 6. 数据源进入标准
新增数据源前应回答：
- 它支持哪类信号识别？
- 它能否补充 evidenceChain？
- 它能否帮助判断支付、本地化、上架、获客、成本或竞争风险？
- 它是否能直接支持“验证 / 观察 / 暂不进入”？
- 它是否会让产品滑向大而全数据聚合平台？

## 7. 当前真实来源
当前 `/api/opportunities?source=real` 的真实来源包括：
- Hacker News 10 条
- Apple App Store 10 条
- GitHub 10 条
- 总计 30 条

当前真实来源只代表可追溯线索，不等于完整市场结论。
