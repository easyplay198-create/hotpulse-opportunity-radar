# PRAXON / 派克森商机雷达

PRAXON（中文名：派克森）是“AI驱动的出海商机发现与验证系统”。

## 前端启动

在 `client` 目录安装依赖并启动 Vite：

```bash
npm install
npm run dev
```

默认访问：

```bash
http://localhost:5173/
```

当前首页仍使用本地 Mock 链路：

```text
hotspots.seed.json → getHotspotList → calculateHotspotScore + buildScoreExplanation → HomePage → TopOpportunities / OpportunityMatrix / HotList
```

## Mock API Server

Day 10 新增了最小 Express Mock API 边界，不会切换首页主数据源。

在 `server` 目录安装依赖并启动：

```bash
npm install
npm run dev
```

默认服务地址：

```bash
http://localhost:3001
```

可用接口：

```bash
GET /api/health
GET /api/opportunities
```

其中 `/api/opportunities` 返回来自 `server/data/opportunities.seed.json` 的 Mock 市场机会数据。

### Day 12 联调调试参数（仅开发用）

`/api/opportunities` 支持以下 query 参数用于联调：

```bash
GET /api/opportunities?mock=error   # 返回 500
GET /api/opportunities?mock=empty   # 返回空数据：{ source, generatedAt, count: 0, items: [] }
GET /api/opportunities?mock=invalid # 返回非法结构（items 非数组）
```

这些参数只用于开发调试，不用于生产。

server 侧已经通过 `source provider` 解耦到 `server/data/opportunities.seed.json`，便于后续替换真实数据源。

首页仍保留 fallback：当 API 异常或结构非法时，会退回前端本地 `hotspots.seed.json` 链路。

### Day 12 收尾：Mock API 内存缓存

`/api/opportunities` 正常请求启用最小内存缓存：

- TTL = 60 秒
- 首次请求日志：`[cache miss] /api/opportunities`
- 60 秒内再次请求日志：`[cache hit] /api/opportunities`
- 缓存过期后再次请求日志：`[cache expired] /api/opportunities`（随后重新 miss）

说明：这是 Mock 阶段的进程内缓存，仅用于验证缓存机制。

## Vite API 代理

前端开发服务已配置 `/api` 代理到 Express：

```text
/api → http://localhost:3001
```

本地联调时需要同时启动：

1. `server`：`npm run dev`
2. `client`：`npm run dev`

## 校验

在 `client` 目录运行：

```bash
npm exec tsc -- --noEmit
npm run build
```
