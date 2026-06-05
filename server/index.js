import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { getMockOpportunities } from './sources/mockOpportunities.js';
import { getHackerNewsOpportunities } from './sources/hackerNewsOpportunities.js';
import { getAppStoreOpportunities } from './sources/appStoreOpportunities.js';
import { getGitHubOpportunities } from './sources/githubOpportunities.js';
import { getProductHuntOpportunities } from './sources/productHuntOpportunities.js';
import { getGdeltOpportunities } from './sources/gdeltOpportunities.js';
import { getMarketEntryKnowledge } from './sources/marketEntryKnowledge.js';

const app = express();
const PORT = process.env.PORT || 3001;
const CACHE_TTL_MS = 60 * 1000;
const opportunitiesCache = new Map();

const allowedOrigins = (process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.length > 0) {
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Not allowed by CORS'));
      return;
    }

    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
      callback(null, true);
      return;
    }

    callback(null, true);
  },
}));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'hot-signal-dashboard-server' });
});

function isValidHttpUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

function normalizeEvidenceArray(evidence) {
  if (!Array.isArray(evidence)) return [];

  const allowedTypes = new Set([
    'community_signal',
    'app_store_signal',
    'search_trend_signal',
    'official_doc',
    'industry_report',
    'news_signal',
    'competitor_signal',
    'payment_doc',
    'compliance_doc',
    'ad_cost_signal',
    'user_review_signal',
    'developer_signal',
  ]);
  const allowedStrength = new Set(['high', 'medium', 'low']);

  return evidence
    .filter((ev) => ev
      && typeof ev.title === 'string'
      && isValidHttpUrl(ev.url)
      && typeof ev.source === 'string'
      && allowedTypes.has(ev.type)
      && typeof ev.retrievedAt === 'string'
      && allowedStrength.has(ev.evidenceStrength))
    .map((ev) => ({
      title: ev.title,
      url: ev.url,
      source: ev.source,
      type: ev.type,
      retrievedAt: ev.retrievedAt,
      evidenceStrength: ev.evidenceStrength,
      metadata: ev.metadata,
    }));
}

function ensureEvidenceItem(item) {
  const normalizedEvidence = normalizeEvidenceArray(item?.evidence);
  if (normalizedEvidence.length === 0) return null;
  return { ...item, evidence: normalizedEvidence };
}

function enhanceWithMarketKnowledge(item) {
  const knowledge = getMarketEntryKnowledge(item?.targetMarket || 'Global');
  if (!knowledge) return item;

  const mergedEvidence = normalizeEvidenceArray([
    ...(Array.isArray(item.evidence) ? item.evidence : []),
    ...(Array.isArray(knowledge.evidence) ? knowledge.evidence : []),
  ]);

  return {
    ...item,
    paymentFit: item.paymentFit || knowledge.paymentFit,
    paymentRisk: item.paymentRisk ?? knowledge.paymentRisk,
    localizationRisk: item.localizationRisk ?? knowledge.localizationRisk,
    complianceRisk: item.complianceRisk ?? knowledge.complianceRisk,
    acquisitionRisk: item.acquisitionRisk ?? knowledge.acquisitionRisk,
    aiCostRisk: item.aiCostRisk ?? knowledge.aiCostRisk,
    marketEntryKnowledge: knowledge.market,
    marketEntryNotes: item.marketEntryNotes ?? knowledge.entryNotes,
    evidence: mergedEvidence,
  };
}

app.get('/api/opportunities', async (req, res) => {
  const mockMode = req.query.mock;

  if (mockMode === 'error') {
    res.status(500).json({
      source: 'mock',
      error: 'mock_error',
      message: 'Mock server error',
    });
    return;
  }

  if (mockMode === 'empty') {
    res.json({
      source: 'mock',
      generatedAt: new Date().toISOString(),
      count: 0,
      items: [],
    });
    return;
  }

  if (mockMode === 'invalid') {
    res.json({
      source: 'mock',
      generatedAt: new Date().toISOString(),
      count: 5,
      items: null,
    });
    return;
  }

  const source = req.query.source === 'real' ? 'real' : (req.query.source === 'hn' ? 'hn' : 'mock');
  const cacheKey = source === 'real'
    ? '/api/opportunities?source=real'
    : source === 'hn'
      ? '/api/opportunities?source=hn'
      : '/api/opportunities';
  const now = Date.now();
  const cachePath = source === 'real'
    ? '/api/opportunities?source=real'
    : source === 'hn'
      ? '/api/opportunities?source=hn'
      : '/api/opportunities';

  const cached = opportunitiesCache.get(cacheKey);
  if (cached) {
    const isExpired = now - cached.cachedAt > CACHE_TTL_MS;

    if (!isExpired) {
      console.log(`[cache hit] ${cachePath}`);
      res.json(cached.body);
      return;
    }

    console.log(`[cache expired] ${cachePath}`);
    opportunitiesCache.delete(cacheKey);
  }

  console.log(`[cache miss] ${cachePath}`);

  try {
    let body;

    if (source === 'hn') {
      const items = (await getHackerNewsOpportunities())
        .map(ensureEvidenceItem)
        .filter(Boolean)
        .map(enhanceWithMarketKnowledge);
      body = {
        source: 'hacker-news',
        generatedAt: new Date().toISOString(),
        count: items.length,
        items,
      };
    } else if (source === 'real') {
      const providerStats = {
        hackerNews: { ok: true, fetchedCount: 0, returnedCount: 0 },
        appStore: { ok: true, fetchedCount: 0, returnedCount: 0 },
        github: { ok: true, fetchedCount: 0, returnedCount: 0 },
        productHunt: { ok: true, fetchedCount: 0, returnedCount: 0 },
        gdelt: { ok: true, fetchedCount: 0, returnedCount: 0 },
      };

      let hnValidItems = [];
      let appStoreValidItems = [];
      let githubValidItems = [];
      let productHuntValidItems = [];
      let gdeltValidItems = [];

      try {
        const hnItems = await getHackerNewsOpportunities();
        hnValidItems = hnItems.map(ensureEvidenceItem).filter(Boolean).map(enhanceWithMarketKnowledge);
        providerStats.hackerNews.fetchedCount = hnValidItems.length;
      } catch (error) {
        providerStats.hackerNews.ok = false;
        providerStats.hackerNews.fetchedCount = 0;
        providerStats.hackerNews.returnedCount = 0;
        providerStats.hackerNews.error = error instanceof Error ? error.message : 'fetch failed';
      }

      try {
        const appStoreItems = await getAppStoreOpportunities();
        appStoreValidItems = appStoreItems.map(ensureEvidenceItem).filter(Boolean).map(enhanceWithMarketKnowledge);
        providerStats.appStore.fetchedCount = appStoreValidItems.length;
      } catch (error) {
        providerStats.appStore.ok = false;
        providerStats.appStore.fetchedCount = 0;
        providerStats.appStore.returnedCount = 0;
        providerStats.appStore.error = error instanceof Error ? error.message : 'fetch failed';
      }

      try {
        const githubItems = await getGitHubOpportunities();
        githubValidItems = githubItems.map(ensureEvidenceItem).filter(Boolean).map(enhanceWithMarketKnowledge);
        providerStats.github.fetchedCount = githubValidItems.length;
      } catch (error) {
        providerStats.github.ok = false;
        providerStats.github.fetchedCount = 0;
        providerStats.github.returnedCount = 0;
        providerStats.github.error = error instanceof Error ? error.message : 'fetch failed';
      }

      try {
        const productHuntResult = await getProductHuntOpportunities();
        if (productHuntResult.ok) {
          productHuntValidItems = productHuntResult.items.map(ensureEvidenceItem).filter(Boolean).map(enhanceWithMarketKnowledge);
          providerStats.productHunt.fetchedCount = productHuntValidItems.length;
        } else {
          providerStats.productHunt.ok = false;
          providerStats.productHunt.skippedReason = productHuntResult.skippedReason;
        }
      } catch (error) {
        providerStats.productHunt.ok = false;
        providerStats.productHunt.fetchedCount = 0;
        providerStats.productHunt.returnedCount = 0;
        providerStats.productHunt.error = error instanceof Error ? error.message : 'fetch failed';
      }

      try {
        const gdeltResult = await getGdeltOpportunities();
        if (gdeltResult.ok) {
          gdeltValidItems = gdeltResult.items.map(ensureEvidenceItem).filter(Boolean).map(enhanceWithMarketKnowledge);
          providerStats.gdelt.fetchedCount = gdeltValidItems.length;
        } else {
          providerStats.gdelt.ok = false;
          providerStats.gdelt.error = gdeltResult.skippedReason || 'GDELT skipped';
        }
      } catch (error) {
        providerStats.gdelt.ok = false;
        providerStats.gdelt.fetchedCount = 0;
        providerStats.gdelt.returnedCount = 0;
        providerStats.gdelt.error = error instanceof Error ? error.message : 'fetch failed';
      }

      const primaryItems = [
        ...hnValidItems.slice(0, 10),
        ...appStoreValidItems.slice(0, 10),
        ...githubValidItems.slice(0, 10),
        ...productHuntValidItems.slice(0, 10),
        ...gdeltValidItems.slice(0, 10),
      ];
      const remainingItems = [
        ...hnValidItems.slice(10),
        ...appStoreValidItems.slice(10),
        ...githubValidItems.slice(10),
        ...productHuntValidItems.slice(10),
        ...gdeltValidItems.slice(10),
      ];
      const items = [...primaryItems, ...remainingItems]
        .filter((item) => item.evidence.length > 0)
        .slice(0, 50);

      providerStats.hackerNews.returnedCount = items.filter((item) => item.source === 'Hacker News').length;
      providerStats.appStore.returnedCount = items.filter((item) => item.source === 'Apple App Store').length;
      providerStats.github.returnedCount = items.filter((item) => item.source === 'GitHub').length;
      providerStats.productHunt.returnedCount = items.filter((item) => item.source === 'Product Hunt').length;
      providerStats.gdelt.returnedCount = items.filter((item) => item.source === 'GDELT').length;

      const allProvidersFailed = !providerStats.hackerNews.ok && !providerStats.appStore.ok && !providerStats.github.ok && !providerStats.productHunt.ok && !providerStats.gdelt.ok;

      if (allProvidersFailed || items.length < 10) {
        res.status(502).json({
          source: 'real',
          error: 'provider_error',
          message: allProvidersFailed ? 'All real providers failed' : `Real opportunities insufficient: ${items.length}`,
          providerStats,
        });
        return;
      }

      body = {
        source: 'real',
        generatedAt: new Date().toISOString(),
        count: items.length,
        providerStats,
        items,
      };
    } else {
      const items = getMockOpportunities().map(enhanceWithMarketKnowledge);
      body = {
        source: 'mock',
        generatedAt: new Date().toISOString(),
        count: items.length,
        items,
      };
    }

    opportunitiesCache.set(cacheKey, {
      cachedAt: now,
      body,
    });

    res.json(body);
  } catch (error) {
    if (source === 'real') {
      res.status(502).json({
        source: 'real',
        error: 'provider_error',
        message: error instanceof Error ? error.message : 'Real providers error',
      });
      return;
    }

    if (source === 'hn') {
      res.status(502).json({
        source: 'hacker-news',
        error: 'provider_error',
        message: error instanceof Error ? error.message : 'HN provider error',
      });
      return;
    }

    throw error;
  }
});

function loadAnalyzeItems(source) {
  if (source !== 'real') return Promise.resolve({ source: source === 'fallback' ? 'fallback' : 'mock', items: getMockOpportunities().map(enhanceWithMarketKnowledge) });
  return Promise.allSettled([
    getHackerNewsOpportunities(),
    getAppStoreOpportunities(),
    getGitHubOpportunities(),
    getProductHuntOpportunities(),
    getGdeltOpportunities(),
  ]).then((results) => {
    const items = results.flatMap((result) => {
      if (result.status !== 'fulfilled') return [];
      const value = result.value;
      const rawItems = Array.isArray(value) ? value : value?.items;
      return Array.isArray(rawItems) ? rawItems : [];
    }).map(ensureEvidenceItem).filter(Boolean).map(enhanceWithMarketKnowledge).slice(0, 50);
    if (items.length === 0) return { source: 'fallback', items: getMockOpportunities().map(enhanceWithMarketKnowledge) };
    return { source: 'real', items };
  }).catch(() => ({ source: 'fallback', items: getMockOpportunities().map(enhanceWithMarketKnowledge) }));
}

function parseQueryIntent(query, profile = {}) {
  const text = `${query || ''} ${profile.targetMarket || ''}`.toLowerCase();
  const has = (pattern) => pattern.test(text);
  const targetMarket = has(/日本|japan/) ? '日本' : has(/台湾|taiwan/) ? '台湾' : has(/泰国|thailand/) ? '泰国' : has(/印尼|indonesia/) ? '印尼' : has(/东南亚|southeast asia|\bsea\b/) ? '东南亚' : has(/欧美|美国|\bus\b|europe/) ? '欧美' : has(/拉美|latin america/) ? '拉美' : has(/中东|middle east/) ? '中东' : (profile.targetMarket && profile.targetMarket !== 'Global' ? profile.targetMarket : '未明确');
  let productCategory = '通用工具';
  if (has(/社交|社区|聊天|匿名聊天|交友|约会|dating|陌生人社交|兴趣社区|陪伴|搞基|gay|同性|lgbtq|男同|queer/)) productCategory = '社交 / dating 产品';
  else if (has(/开发者|插件|workflow|github|vscode|api|代码|ide/)) productCategory = '开发者工具 / 插件';
  else if (has(/英语|学习|教育|课程|语言学习|学习工具|刷题|口语/)) productCategory = 'AI 教育工具';
  else if (has(/短剧|内容|追剧|视频|剧集|订阅内容/)) productCategory = '短剧 / 内容产品';
  else if (has(/图片|设计|生成图|绘图|创作|素材|海报/)) productCategory = 'AI 图片工具';
  else if (has(/游戏|手游|休闲游戏|内购|关卡|玩法/)) productCategory = '游戏';
  else if (has(/saas|b2b|企业工具|crm|管理后台|协作|项目管理/)) productCategory = 'SaaS / B2B 工具';
  else if (has(/支付|订阅|本地支付|内购|收款|转化率|付费|虚拟礼物/)) productCategory = '支付 / 订阅验证';
  else if (has(/ai|人工智能|智能体|agent|自动化|效率工具/)) productCategory = 'AI 工具';
  const audienceMap = { '开发者工具 / 插件': '开发者 / 小型技术团队', 'AI 教育工具': '学生 / 语言学习用户 / 早期付费用户', '社交 / dating 产品': '社交用户 / 匿名社交用户 / 兴趣社区用户 / 早期种子用户', '短剧 / 内容产品': '内容消费用户 / 短剧用户', 'SaaS / B2B 工具': '出海企业 / 中小团队 / B2B 用户', 'AI 图片工具': '创作者 / 设计师 / 内容团队' };
  const businessModel = has(/订阅|subscription|会员/) ? '订阅' : has(/虚拟礼物|打赏|礼物/) ? '虚拟礼物' : has(/增值|premium|pro/) ? '增值会员' : has(/广告/) ? '广告' : has(/b2b|企业|saas/) ? 'B2B SaaS' : '未明确';
  const flagMap = { 'AI 工具': ['ai-cost', 'subscription', 'competition', 'retention', 'localization'], 'AI 教育工具': ['localization', 'education-fit', 'subscription', 'retention', 'ai-cost', 'competition'], '开发者工具 / 插件': ['developer-adoption', 'workflow-fit', 'integration-risk', 'pricing', 'competition'], '短剧 / 内容产品': ['content-rights', 'payment', 'localization', 'acquisition-cost', 'app-store-compliance'], '社交 / dating 产品': ['user-generated-content', 'privacy', 'content-moderation', 'user-safety', 'cold-start-community', 'app-store-compliance', 'payment-subscription'], '支付 / 订阅验证': ['payment-fit', 'local-payment', 'subscription-conversion', 'refund-risk', 'compliance'] };
  const confidence = productCategory === '通用工具' ? 0.45 : productCategory === '社交 / dating 产品' ? 0.82 : 0.72;
  return { productCategory, targetMarket, audience: audienceMap[productCategory] || '早期目标用户', businessModel, sensitivityFlags: flagMap[productCategory] || ['acquisition', 'localization', 'payment'], confidence, interpretationNote: `系统将该输入理解为「${productCategory}」方向。目标市场为「${targetMarket}」，商业模式为「${businessModel}」。`, rawQuery: query || '' };
}

function evidenceRank(value) { if (value === 'high') return 3; if (value === 'medium') return 2; return 1; }
function strongestEvidence(item) { return (item.evidence || []).reduce((max, ev) => Math.max(max, evidenceRank(ev.evidenceStrength)), 1); }
function riskLevel(value) { return value >= 75 ? '高' : value >= 40 ? '中' : '低'; }
function candidateText(item) { return `${item.title || ''} ${item.summary || ''} ${item.description || ''} ${(item.tags || []).join(' ')} ${item.targetMarket || ''} ${item.targetUser || ''} ${item.category || ''} ${item.productType || ''} ${(item.evidence || []).map((ev) => `${ev.title} ${ev.source}`).join(' ')}`.toLowerCase(); }
function categoryKeywords(category) {
  if (category.includes('社交')) return ['社交', '社区', '聊天', '交友', '约会', 'dating', 'anonymous', 'community', 'social', 'lgbtq'];
  if (category.includes('教育')) return ['学习', '英语', '教育', '课程', '语言', '口语', 'learn', 'education'];
  if (category.includes('开发者')) return ['开发者', 'github', 'api', '插件', 'vscode', '代码', 'developer', 'workflow'];
  if (category.includes('短剧')) return ['短剧', '内容', '视频', '剧集', 'content', 'video'];
  if (category.includes('图片')) return ['图片', '设计', '生成图', '绘图', 'image', 'design'];
  if (category.includes('AI')) return ['ai', '人工智能', '智能体', 'agent', '自动化'];
  return category.split(/[ /]+/).filter(Boolean);
}
function calculateRelevanceScore(intent, item) {
  const text = candidateText(item);
  const queryTokens = String(intent.rawQuery || '').toLowerCase().split(/\s+|，|。|,|\//).filter((token) => token.length > 1);
  const keywords = categoryKeywords(intent.productCategory);
  const queryIntentMatch = Math.min(100, queryTokens.filter((token) => text.includes(token)).length * 25 + keywords.filter((token) => text.includes(token)).length * 18);
  const categoryMatch = keywords.some((token) => text.includes(token)) ? 85 : 0;
  const audienceTokens = intent.audience.toLowerCase().split(/[ /]+/).filter((token) => token.length > 1);
  const audienceMatch = audienceTokens.some((token) => text.includes(token)) ? 70 : categoryMatch > 0 ? 35 : 0;
  const marketMatch = intent.targetMarket === '未明确' || intent.targetMarket === 'Global' ? 45 : text.includes(intent.targetMarket.toLowerCase()) ? 100 : 10;
  const evidenceFit = Math.min(100, strongestEvidence(item) * 25 + ((item.evidence || []).length > 1 ? 20 : 0));
  const finalRelevanceScore = Math.round(queryIntentMatch * 0.35 + categoryMatch * 0.25 + audienceMatch * 0.15 + marketMatch * 0.10 + evidenceFit * 0.15);
  const relevanceLabel = finalRelevanceScore >= 80 ? '强匹配' : finalRelevanceScore >= 65 ? '匹配' : finalRelevanceScore >= 45 ? '弱相关参考' : '不相关';
  const rejectionReason = finalRelevanceScore < 45 ? `品类或受众不相关：${item.category || item.productType || '该信号'} 与 ${intent.productCategory} 不属于同一验证方向。` : undefined;
  return { queryIntentMatch, categoryMatch, audienceMatch, marketMatch, evidenceFit, finalRelevanceScore, eligible: finalRelevanceScore >= 45, relevanceLabel, rejectionReason };
}
function matchAnalyzeItems(items, intent) {
  return [...items].map((item) => ({ item, relevance: calculateRelevanceScore(intent, item) })).sort((a, b) => b.relevance.finalRelevanceScore - a.relevance.finalRelevanceScore || (b.item.valueScore || 0) - (a.item.valueScore || 0));
}
function buildRiskMatrixForIntent(intent) {
  const rows = intent.productCategory.includes('社交') ? [['隐私安全', 85], ['内容审核', 85], ['社区冷启动', 82], ['应用商店合规', 75], ['支付订阅', 60], ['本地化文化风险', 72], ['用户安全', 80]] : intent.productCategory.includes('教育') ? [['本地化', 72], ['获客', 60], ['订阅转化', 62], ['AI 成本', 70], ['竞争', 75], ['留存', 70]] : intent.productCategory.includes('开发者') ? [['工作流嵌入', 75], ['开发者采用', 72], ['定价', 60], ['集成成本', 58], ['竞品替代', 65]] : intent.productCategory.includes('短剧') ? [['内容版权', 82], ['支付', 72], ['获客成本', 80], ['本地化', 70], ['应用商店合规', 60]] : [['获客', 60], ['本地化', 58], ['支付转化', 55], ['竞争', 62], ['留存', 60]];
  return rows.map(([label, value]) => ({ label, value, level: riskLevel(value) }));
}
function buildSevenDayPlanForIntent(intent) {
  if (intent.productCategory.includes('社交')) return ['Day 1-2：确定目标市场和核心人群，做匿名 landing page，测试价值主张。', 'Day 3：设计 2-3 个使用场景，如匹配、匿名聊天、兴趣社区。', 'Day 4-5：投放小预算广告或社群招募，收集 waitlist 和访谈样本。', 'Day 6：验证隐私、安全、审核和付费意愿，记录拒绝原因。', 'Day 7：根据注册率、访谈质量、付费意愿和风险成本决定继续、调整或暂停。'];
  if (intent.productCategory.includes('教育')) return ['Day 1-2：确定学习场景和目标市场，做 landing page 和 demo 文案。', 'Day 3：准备 2-3 个学习任务样例，测试用户是否理解价值。', 'Day 4-5：招募 10-20 个目标用户试用，观察完成率和反馈。', 'Day 6：验证订阅意愿、AI 成本和本地化表达。', 'Day 7：根据注册率、试用完成率和付费意愿决定继续、调整或暂停。'];
  if (intent.productCategory.includes('开发者')) return ['Day 1-2：定义目标开发者工作流和痛点，做 demo 页面或录屏。', 'Day 3：在 GitHub、HN、开发者社群收集反馈。', 'Day 4-5：邀请 10 个开发者试用最小 demo。', 'Day 6：验证是否能嵌入真实工作流，以及愿意付费的触发点。', 'Day 7：根据安装意愿、重复使用频率和反馈决定继续、调整或暂停。'];
  if (intent.productCategory.includes('短剧')) return ['Day 1-2：确定目标市场、内容类型和付费路径。', 'Day 3：制作 2-3 个本地化内容钩子或短样片。', 'Day 4-5：小预算测试点击、完播、收藏或 waitlist。', 'Day 6：验证支付路径、订阅意愿和本地化接受度。', 'Day 7：根据点击率、留资率、付费意愿和版权风险决定继续、调整或暂停。'];
  return ['Day 1-2：明确目标人群和表达页。', 'Day 3：准备最小 demo 或 landing page。', 'Day 4-5：做小样本访谈或投放测试。', 'Day 6：整理反馈、成本和风险。', 'Day 7：决定继续、调整或暂停。'];
}
function clarifyingQuestions() { return [{ id: 'target_market', text: '你想优先验证哪个市场？', options: ['日本', '台湾', '泰国', '东南亚', '欧美', '拉美', 'Global'] }, { id: 'product_shape', text: '产品更偏哪种形态？', options: ['工具型产品', '内容产品', '社交社区', '订阅服务', '开发者工具', 'AI 功能'] }, { id: 'business_model', text: '你计划怎么变现？', options: ['订阅会员', '一次性付费', '虚拟礼物', '增值功能', '广告', '暂不考虑变现'] }, { id: 'seed_channel', text: '是否已有种子用户渠道？', options: ['有社群', '有内容渠道', '有 B2B 客户', '有 KOL 合作', '暂无'] }, { id: 'main_risk', text: '你最担心哪个风险？', options: ['需求不真实', '获客成本高', '支付转化低', '本地化不足', '合规风险', '竞争太强'] }]; }
function evidenceGapsForIntent(intent) { const gaps = ['缺少目标市场的直接用户需求信号', '缺少同类产品评论或下载趋势证据', '缺少目标用户付费意愿数据', '缺少低成本获客测试结果']; if (intent.productCategory.includes('社交')) gaps.push('缺少社区冷启动可行性证据', '缺少内容审核和用户安全成本评估'); if (intent.productCategory.includes('AI')) gaps.push('缺少留存和订阅转化证据', '缺少 AI 成本与付费能力匹配验证'); if (intent.productCategory.includes('开发者')) gaps.push('缺少工作流嵌入频率证据', '缺少开发者愿意付费的证据'); return gaps; }

function buildMvpValidationPlanObjects(sevenDayPlan) {
  return sevenDayPlan.map((step, index) => ({
    day: step.split('：')[0] || `Day ${index + 1}`,
    goal: step.split('：')[1] || step,
    action: step,
    successMetric: index < 2 ? '完成可测试表达和首批反馈' : '获得可判断的注册、访谈或留资信号',
    stopCondition: '如果目标用户无法理解价值或没有有效反馈，暂停扩大投入。',
    requiredResource: index < 2 ? '1 个落地页 / demo 文案' : '小样本用户、访谈记录或低预算测试',
  }));
}

function buildRuleAnalyzeResponse({ query, profile, source, loaded }) {
  const intent = parseQueryIntent(query, profile);
  const scored = matchAnalyzeItems(loaded.items, intent);
  const eligible = scored.filter((entry) => entry.relevance.finalRelevanceScore >= 45);
  const strongMatches = eligible.filter((entry) => entry.relevance.finalRelevanceScore >= 65);
  const top = strongMatches[0]?.item;
  const topScore = strongMatches[0]?.relevance.finalRelevanceScore ?? 0;
  const riskItems = buildRiskMatrixForIntent(intent);
  const sevenDayPlan = buildSevenDayPlanForIntent(intent);
  const rejectedSignals = scored.filter((entry) => entry.relevance.finalRelevanceScore < 45).slice(0, 5).map((entry) => ({ id: entry.item.id, title: entry.item.title, finalRelevanceScore: entry.relevance.finalRelevanceScore, rejectionReason: entry.relevance.rejectionReason || '与当前输入方向不相关。' }));
  const noMatch = strongMatches.length === 0;
  const recommendation = noMatch ? {
    title: '当前缺少足够相关信号，建议先做小样本验证', verdict: '持续观察', matchScore: Math.max(0, eligible[0]?.relevance.finalRelevanceScore ?? 0), targetMarket: intent.targetMarket, evidenceStrength: 'low', summary: '当前信号库中没有找到与该方向高度相关的可追溯信号。HotPulse 不建议基于无关信号做进入判断。', nextStep: '先明确目标市场、产品形态和变现方式，再用 landing page、访谈和小预算测试验证需求。'
  } : {
    title: `${intent.targetMarket} · ${intent.productCategory} 验证建议`, verdict: topScore >= 80 ? '优先验证' : '持续观察', matchScore: topScore, targetMarket: intent.targetMarket, evidenceStrength: strongestEvidence(top) >= 3 ? 'high' : strongestEvidence(top) >= 2 ? 'medium' : 'low', summary: `当前最相关信号是「${top.title}」，建议只把它作为验证参考，不要直接当成市场结论。`, nextStep: sevenDayPlan[0], reportItemId: top.id
  };
  const matchedSignals = eligible.slice(0, 3).map((entry) => ({ ...entry.item, relevanceScore: entry.relevance.finalRelevanceScore, relevanceLabel: entry.relevance.relevanceLabel }));
  const warnings = loaded.source !== 'real' ? ['当前为 mock/fallback 数据，仅用于结构演示，不代表真实市场结论。'] : [];
  return {
    version: '2.1', analysisId: `analysis-${Date.now()}`, source: loaded.source, generatedAt: new Date().toISOString(),
    steps: [
      { id: 'parse', label: '解析产品方向', status: 'done', summary: `识别为 ${intent.productCategory}，目标市场 ${intent.targetMarket}` },
      { id: 'signals', label: '检索市场信号', status: 'done', summary: `从 ${loaded.items.length} 条当前信号中检索相关线索` },
      { id: 'evidence', label: '匹配证据链', status: 'done', summary: `找到 ${strongMatches.length} 条匹配信号，${eligible.length - strongMatches.length} 条弱相关参考` },
      { id: 'risk', label: '扫描风险矩阵', status: 'done', summary: `按 ${intent.productCategory} 生成风险矩阵` },
      { id: 'plan', label: '生成验证方案', status: 'done', summary: '生成按输入方向定制的 7 天 MVP 验证动作' },
    ],
    parsedIntent: intent,
    projectUnderstanding: { productSummary: query, productCategory: intent.productCategory, targetAudience: intent.audience, targetMarket: intent.targetMarket, businessModel: intent.businessModel, knownConditions: [query].filter(Boolean), missingConditions: ['目标市场细分', '种子用户渠道', '付费方式', '可投入资源'], confidence: intent.confidence },
    userConditions: { stage: profile.productStage || profile.stage || '未明确', budget: profile.budgetRange || profile.budget || '未明确', resources: Array.isArray(profile.assets) ? profile.assets : [], teamCapabilities: Array.isArray(profile.capabilities) ? profile.capabilities : [], constraints: Array.isArray(profile.avoidDirections) ? profile.avoidDirections : [] },
    keyAssumptions: ['需求真实存在', '目标用户能理解价值', '可以低成本触达首批用户', '存在可接受的付费或留存路径'].map((statement, index) => ({ id: `assumption-${index + 1}`, type: ['demand', 'solution', 'acquisition', 'payment'][index], statement, criticality: index === 0 ? 'high' : 'medium', whyItMatters: '这是进入前必须验证的关键假设。' })),
    analysisTrace: [
      { step: '解析用户输入', status: 'completed', action: '提取产品类型、用户和市场', finding: `项目被理解为 ${intent.productCategory}`, uncertainty: intent.targetMarket === '未明确' ? '目标市场仍未明确' : '市场方向已有初步输入' },
      { step: '拆解关键假设', status: 'completed', action: '拆分需求、获客、付费和 MVP 假设', finding: '需要先验证需求和首批用户反馈', uncertainty: '真实付费意愿仍需补证' },
      { step: '匹配市场信号', status: 'completed', action: '用相关性分过滤候选信号', finding: `找到 ${strongMatches.length} 条匹配信号`, uncertainty: noMatch ? '当前没有足够相关证据' : '信号仅可作为验证参考' },
      { step: '排除无关信号', status: 'completed', action: '排除品类或受众不一致的候选', finding: `排除 ${rejectedSignals.length} 条无关信号`, uncertainty: '被排除信号不参与进入判断' },
      { step: '生成 MVP 验证路径', status: 'completed', action: '按输入方向和资源生成 7 天动作', finding: sevenDayPlan[0], uncertainty: '需要用实际用户反馈验证' },
    ],
    evidenceBoard: [
      { title: '用户输入的项目方向', source: '用户输入', sourceType: 'user_input', evidenceStrength: 'medium', supports: '项目理解与关键假设拆解', url: null, sourceItemId: null, note: '来自用户输入，不代表外部市场证据。' },
      ...matchedSignals.slice(0, 3).map((item) => ({ title: item.title, source: item.evidence?.[0]?.source || item.platformId || 'HotPulse', sourceType: loaded.source === 'real' ? 'real_signal' : 'mock_signal', evidenceStrength: item.evidence?.[0]?.evidenceStrength || 'low', supports: '与项目方向相关的市场信号参考', url: item.evidence?.[0]?.url || null, sourceItemId: item.id, note: loaded.source === 'real' ? '可追溯市场信号。' : '结构演示，不代表真实市场结论。' })),
    ],
    projectEvaluation: [
      { label: '输入相关性', score: Math.max(50, topScore || 55), explanation: '基于输入完整度和候选相关性。' },
      { label: '市场需求证据', score: noMatch ? 25 : 60, explanation: noMatch ? '缺少直接相关信号。' : '存在相关信号可参考。' },
      { label: '目标用户清晰度', score: intent.audience ? 65 : 35, explanation: '用户画像仍需细分。' },
      { label: '获客可行性', score: 45, explanation: '需要小样本触达验证。' },
      { label: '支付/订阅可行性', score: intent.businessModel === '未明确' ? 35 : 55, explanation: '变现方式需要验证。' },
      { label: 'MVP 可行性', score: 70, explanation: '可先用轻量页面验证。' },
    ],
    riskBottlenecks: riskItems.slice(0, 3).map((risk) => ({ title: risk.label, level: risk.level === '高' ? 'high' : risk.level === '中' ? 'medium' : 'low', why: `${risk.label}可能影响验证结论。`, impact: '如果不先验证，可能导致进入判断失真。', validationAction: '用 landing page、访谈或小样本测试验证。', stopOrAdjust: '如果反馈不足或风险成本过高，应调整方向或暂停。' })),
    mvpValidationPlan: buildMvpValidationPlanObjects(sevenDayPlan),
    matchedSignals,
    matchedOpportunities: strongMatches.slice(0, 3).map((entry) => ({ id: `matched-${entry.item.id}`, title: entry.item.title, sourceItemId: entry.item.id, fitScore: entry.relevance.finalRelevanceScore, reason: `${entry.relevance.relevanceLabel}：与 ${intent.productCategory} / ${intent.targetMarket} 的验证方向相关。`, firstStep: sevenDayPlan[0], riskWarning: `优先关注${riskItems[0]?.label || '主要风险'}。` })),
    recommendation, riskMatrix: riskItems, sevenDayPlan,
    clarifyingQuestions: clarifyingQuestions(), evidenceGaps: noMatch ? evidenceGapsForIntent(intent) : [], warnings,
    relevanceScores: { topSignalScores: scored.slice(0, 5).map((entry) => ({ id: entry.item.id, title: entry.item.title, ...entry.relevance })), rejectedSignals },
  };
}

function coerceLlmResponseToAnalyzeResponse(llmJson, fallback, loadedSource) {
  const recommendation = llmJson.recommendation || {};
  const evidenceBoard = Array.isArray(llmJson.evidenceBoard) ? llmJson.evidenceBoard.map((item) => ({ ...item, url: item.url || undefined, sourceItemId: item.sourceItemId || undefined, note: item.sourceType === 'mock_signal' ? `${item.note || ''} 结构演示，不代表真实市场结论。`.trim() : item.note })) : fallback.evidenceBoard;
  return {
    ...fallback,
    version: '2.1-ai',
    projectUnderstanding: llmJson.projectUnderstanding || fallback.projectUnderstanding,
    userConditions: llmJson.userConditions || fallback.userConditions,
    keyAssumptions: Array.isArray(llmJson.keyAssumptions) ? llmJson.keyAssumptions : fallback.keyAssumptions,
    analysisTrace: Array.isArray(llmJson.analysisTrace) ? llmJson.analysisTrace : fallback.analysisTrace,
    evidenceBoard,
    projectEvaluation: Array.isArray(llmJson.projectEvaluation) ? llmJson.projectEvaluation : fallback.projectEvaluation,
    riskBottlenecks: Array.isArray(llmJson.riskBottlenecks) ? llmJson.riskBottlenecks : fallback.riskBottlenecks,
    mvpValidationPlan: Array.isArray(llmJson.mvpValidationPlan) ? llmJson.mvpValidationPlan : fallback.mvpValidationPlan,
    clarifyingQuestions: Array.isArray(llmJson.clarifyingQuestions) ? llmJson.clarifyingQuestions : fallback.clarifyingQuestions,
    evidenceGaps: Array.isArray(llmJson.evidenceGaps) ? llmJson.evidenceGaps : fallback.evidenceGaps,
    warnings: [...(Array.isArray(llmJson.warnings) ? llmJson.warnings : []), ...(loadedSource !== 'real' ? ['当前为 mock/fallback 数据，仅用于结构演示，不代表真实市场结论。'] : [])],
    recommendation: { ...fallback.recommendation, title: recommendation.title || fallback.recommendation.title, verdict: recommendation.verdict || fallback.recommendation.verdict, summary: recommendation.summary || fallback.recommendation.summary, nextStep: recommendation.nextStep || fallback.recommendation.nextStep },
  };
}

async function analyzeWithLLM({ query, profile, source, candidateSignals, fallback }) {
  if (!process.env.OPENAI_API_KEY) return null;
  const signalSummary = candidateSignals.slice(0, 12).map((item) => ({ id: item.id, title: item.title, source: item.evidence?.[0]?.source || item.platformId, evidenceStrength: item.evidence?.[0]?.evidenceStrength || 'low', url: item.evidence?.[0]?.url || null, type: item.evidence?.[0]?.type || item.category, targetMarket: item.targetMarket || null, targetUser: item.targetUser || null }));
  const systemPrompt = '你是 HotPulse 的出海项目验证分析引擎。你的任务不是推荐热门机会，而是围绕用户输入的项目做验证。用户输入是主线，市场信号只是辅助证据。不允许伪造真实数据。如果没有真实证据，必须输出 evidenceGaps 和 warnings。所有判断必须区分 user_input、real_signal、mock_signal、market_knowledge、system_inference。source=mock 时必须提醒 mock 只用于结构演示。MVP 路径和风险必须根据用户条件、资源、预算和项目类型生成。只返回严格 JSON，不要 Markdown。';
  const userPrompt = JSON.stringify({ query, profile, source, candidateSignals: signalSummary, requiredSchema: ['projectUnderstanding', 'userConditions', 'keyAssumptions', 'analysisTrace', 'evidenceBoard', 'projectEvaluation', 'riskBottlenecks', 'mvpValidationPlan', 'recommendation', 'clarifyingQuestions', 'evidenceGaps', 'warnings'] });
  const response = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-4o-mini', temperature: 0.2, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }] }) });
  if (!response.ok) throw new Error(`OpenAI request failed: ${response.status}`);
  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI returned empty content');
  return coerceLlmResponseToAnalyzeResponse(JSON.parse(content), fallback, source);
}

app.post('/api/analyze', async (req, res) => {
  const body = req.body || {};
  const query = typeof body.query === 'string' ? body.query.trim() : '';
  const requestedSource = body.source === 'real' ? 'real' : body.source === 'fallback' ? 'fallback' : 'mock';
  const profile = body.profile && typeof body.profile === 'object' ? body.profile : {};
  const loaded = await loadAnalyzeItems(requestedSource);
  const fallback = buildRuleAnalyzeResponse({ query, profile, source: requestedSource, loaded });
  try {
    const aiResult = await analyzeWithLLM({ query, profile, source: loaded.source, candidateSignals: loaded.items, fallback });
    if (aiResult) {
      res.json(aiResult);
      return;
    }
  } catch (error) {
    fallback.warnings = [...(fallback.warnings || []), 'AI 语义分析暂不可用，当前结果来自本地规则引擎。'];
    fallback.analysisTrace = [...(fallback.analysisTrace || []), { step: 'AI 语义分析兜底', status: 'completed', action: '切换到本地规则引擎', finding: error instanceof Error ? error.message : 'AI 分析失败', uncertainty: '结果为规则引擎输出，建议补充真实信号后复核。' }];
  }
  if (!process.env.OPENAI_API_KEY) fallback.warnings = [...(fallback.warnings || []), 'AI 语义分析暂不可用，当前结果来自本地规则引擎。'];
  res.json(fallback);
});

const server = app.listen(PORT, () => {
  console.log(`HotPulse mock API server running at http://localhost:${PORT}`);
  console.log(`PID: ${process.pid}`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);
});

server.on('error', (error) => {
  console.error('HotPulse server failed to start', error);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down');
  server.close(() => process.exit(0));
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down');
  server.close(() => process.exit(0));
});
