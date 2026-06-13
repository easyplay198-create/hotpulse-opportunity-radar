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
import { getFirstPartyCapabilityProfiles, getFirstPartyMarketProfile } from './knowledge/firstPartyKnowledgeBase.js';
import { buildLlmDraftForAnalyze } from './analyze/llmOrchestrator.js';
import { canonicalSnapshotsEqual, createCanonicalInvariantSnapshot } from './analyze/llmGuardrails.js';

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

function detectTargetMarket(query, profile = {}) {
  const detect = (value) => {
    const text = String(value || '').toLowerCase();
    if (/日本|japan|日语/.test(text)) return '日本';
    if (/台湾|taiwan/.test(text)) return '台湾';
    if (/泰国|thailand/.test(text)) return '泰国';
    if (/印尼|indonesia/.test(text)) return '印尼';
    if (/东南亚|southeast asia|\bsea\b|越南|vietnam|菲律宾|philippines/.test(text)) return '东南亚';
    if (/美国|usa|\bus\b/.test(text)) return '美国';
    if (/欧美|欧洲|europe/.test(text)) return '欧美';
    if (/拉美|latin america|巴西|brazil/.test(text)) return '拉美';
    if (/中东|middle east/.test(text)) return '中东';
    return null;
  };
  return detect(query) || detect(profile.targetMarket) || (profile.targetMarket && profile.targetMarket !== 'Global' ? profile.targetMarket : '未明确');
}

function parseQueryIntent(query, profile = {}) {
  const text = `${query || ''} ${profile.targetMarket || ''}`.toLowerCase();
  const has = (pattern) => pattern.test(text);
  const targetMarket = detectTargetMarket(query, profile);
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

function isValidExternalUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function metadataNumber(metadata, keys) {
  for (const key of keys) {
    const value = metadata?.[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  }
  return 0;
}

function normalizeEvidenceSourceType(evidence, sourceMode) {
  const raw = `${evidence?.source || ''} ${evidence?.type || ''} ${evidence?.sourceType || ''}`.toLowerCase();
  if (raw.includes('user_input')) return 'user_input';
  if (sourceMode === 'mock') return 'mock_signal';
  if (raw.includes('hacker') || raw.includes('hn') || raw.includes('community')) return 'community';
  if (raw.includes('itunes') || raw.includes('app store') || raw.includes('apple') || raw.includes('app_store')) return 'app_store';
  if (raw.includes('payment')) return 'payment_knowledge';
  if (raw.includes('localization')) return 'localization_knowledge';
  if (raw.includes('compliance') || raw.includes('policy')) return 'compliance_knowledge';
  if (raw.includes('cost') || raw.includes('token')) return 'ai_cost_knowledge';
  if (raw.includes('mock')) return 'mock_signal';
  if (sourceMode === 'fallback') return 'fallback_signal';
  return sourceMode === 'real' ? 'market_signal' : 'mock_signal';
}

function calculateEvidenceStrength(evidence, sourceMode) {
  const hasUrl = isValidExternalUrl(evidence?.url);
  const sourceType = normalizeEvidenceSourceType(evidence, sourceMode);
  if (sourceType === 'user_input') return 'medium';
  if (sourceType === 'mock_signal') return 'low';

  const metadata = evidence?.metadata || {};
  let strength = evidence?.evidenceStrength === 'high' || evidence?.evidenceStrength === 'medium' || evidence?.evidenceStrength === 'low'
    ? evidence.evidenceStrength
    : 'low';

  if (sourceType === 'community') {
    const points = metadataNumber(metadata, ['points', 'score']);
    const comments = metadataNumber(metadata, ['comments', 'commentCount', 'num_comments']);
    if (points >= 200 && comments >= 50) strength = 'high';
    else if (points >= 50 || comments >= 20) strength = 'medium';
    else strength = 'low';
  }

  if (sourceType === 'app_store') {
    const ratingCount = metadataNumber(metadata, ['ratingCount', 'userRatingCount']);
    const averageRating = metadataNumber(metadata, ['averageRating', 'rating', 'averageUserRating']);
    if (ratingCount >= 1000 && averageRating >= 4.2) strength = 'high';
    else if (ratingCount >= 100 || averageRating >= 4.0) strength = 'medium';
    else strength = 'low';
  }

  if (!hasUrl && strength === 'high') return 'medium';
  return strength;
}

function normalizeJudgmentEvidence(response, sourceMode) {
  const records = [];
  const seen = new Set();

  for (const signal of Array.isArray(response.matchedSignals) ? response.matchedSignals : []) {
    const primary = Array.isArray(signal.evidence) ? signal.evidence[0] : null;
    if (!primary) continue;
    const key = `${signal.id || ''}:${primary.url || primary.title || signal.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    records.push({
      title: signal.title || primary.title || '市场信号',
      summary: signal.summary || primary.note || primary.supports || '可追溯市场信号，用于辅助验证方向。',
      source: primary.source || signal.source || 'HotPulse',
      sourceType: normalizeEvidenceSourceType(primary, sourceMode),
      url: primary.url || null,
      strength: calculateEvidenceStrength(primary, sourceMode),
      metadata: primary.metadata || {},
    });
  }

  for (const item of Array.isArray(response.evidenceBoard) ? response.evidenceBoard : []) {
    const key = `${item.sourceItemId || ''}:${item.url || item.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    records.push({
      title: item.title || '验证证据',
      summary: item.supports || item.note || '用于辅助判断的证据项。',
      source: item.source || 'HotPulse',
      sourceType: normalizeEvidenceSourceType(item, sourceMode),
      url: item.url || null,
      strength: calculateEvidenceStrength(item, sourceMode),
      metadata: item.metadata || {},
    });
  }

  return records.slice(0, 8);
}

function extractPainPoint(query) {
  const text = String(query || '');
  const direct = text.match(/(?:核心痛点是|痛点是|解决)([^，。,.]{3,40})/);
  if (direct?.[1]) return direct[1].trim();
  if (/获客|渠道|投放/.test(text)) return '获客渠道与转化效率待验证';
  if (/支付|订阅|价格|付费/.test(text)) return '付费意愿与支付路径待验证';
  if (/本地化|日语|翻译|文化/.test(text)) return '本地化表达与使用习惯待验证';
  if (/效率|自动化/.test(text)) return '效率提升是否足够强待验证';
  return '未明确';
}

function extractPlatformForm(query, intent) {
  const text = String(query || '');
  if (/App|移动|iOS|Android/i.test(text)) return '移动 App';
  if (/Web|网站|SaaS/i.test(text) || intent.productCategory.includes('SaaS')) return 'Web SaaS';
  if (/插件|VSCode|Chrome/i.test(text)) return '浏览器 / 开发者插件';
  if (/游戏/.test(text)) return '游戏';
  if (/API/i.test(text)) return 'API 服务';
  return '未明确';
}

const ACQUISITION_CHANNEL_RULES = [
  { pattern: /YouTube\s*Shorts/i, channel: '内容获客', detail: 'YouTube Shorts' },
  { pattern: /TikTok/i, channel: '内容获客', detail: 'TikTok' },
  { pattern: /小红书/i, channel: '内容获客', detail: '小红书' },
  { pattern: /短视频/i, channel: '内容获客', detail: '短视频' },
  { pattern: /内容获客/i, channel: '内容获客', detail: null },
  { pattern: /SEO/i, channel: '搜索 / SEO', detail: 'SEO' },
  { pattern: /搜索/i, channel: '搜索 / SEO', detail: null },
  { pattern: /投放|广告/, channel: '小预算投放', detail: null },
  { pattern: /社群|社区/, channel: '社群 / 社区', detail: null },
];

function extractAcquisitionChannel(query) {
  const text = String(query || '');
  const matched = ACQUISITION_CHANNEL_RULES.find((rule) => rule.pattern.test(text));
  return {
    acquisitionChannel: matched?.channel || '未明确',
    acquisitionChannelDetail: matched?.detail || null,
  };
}

function buildChannelHypothesisStatement(assumptions) {
  if (assumptions.acquisitionChannelDetail) {
    return `${assumptions.acquisitionChannelDetail} 能否低成本触达早期样本仍待验证。`;
  }
  if (assumptions.acquisitionChannel && assumptions.acquisitionChannel !== '未明确') {
    return `${assumptions.acquisitionChannel} 能否低成本触达早期样本仍待验证。`;
  }
  return '渠道待明确，触达早期样本的方式仍待验证。';
}

function buildJudgmentAssumptions(query, profile, intent) {
  const targetMarket = detectTargetMarket(query, profile);
  const acquisition = extractAcquisitionChannel(query);
  return {
    productType: intent.productCategory || '未明确',
    targetMarket,
    targetUser: intent.audience || '未明确',
    painPoint: extractPainPoint(query),
    businessModel: intent.businessModel || '未明确',
    acquisitionChannel: acquisition.acquisitionChannel,
    acquisitionChannelDetail: acquisition.acquisitionChannelDetail,
    platformForm: extractPlatformForm(query, intent),
    validationScope: `${profile.validationGoal || '需求是否存在'} / ${profile.budgetRange || '未明确预算'}`,
  };
}

function buildMissingInfo(assumptions) {
  const labels = {
    productType: '产品类型',
    targetMarket: '目标市场',
    targetUser: '目标用户',
    painPoint: '核心痛点',
    businessModel: '商业模式',
    acquisitionChannel: '获客渠道',
    platformForm: '平台形态',
  };
  return Object.entries(labels)
    .filter(([key]) => !assumptions[key] || assumptions[key] === '未明确')
    .map(([key, label]) => ({
      key,
      label,
      reason: `${label}仍不明确，当前结论会降级为预验证。`,
      example: `请补充${label}的具体描述。`,
    }));
}

function knowledgeSignal(key, label, status, impact = 'medium', reportOnly = true, provenance = 'computed', evidenceType = 'computed_rule') {
  return {
    key,
    label,
    status,
    impact,
    provenance,
    evidenceType,
    reportOnly,
  };
}

function unknownKnowledgeSignal(key, label, impact = 'high') {
  return knowledgeSignal(key, label, 'unknown', impact, true, 'unknown', 'unknown');
}

function knowledgeBaseSignal(key, label, status = 'warn', impact = 'medium') {
  return knowledgeSignal(key, label, status, impact, true, 'knowledge_base', 'first_party_knowledge');
}

function blockProvenance(level, signals) {
  if (level === 'unknown') return 'unknown';
  if (signals.some((signal) => signal.status === 'fail' && signal.provenance === 'computed')) return 'computed';
  if (signals.some((signal) => signal.status === 'warn' && signal.provenance === 'computed')) return 'computed';
  if (signals.some((signal) => signal.provenance === 'knowledge_base')) return 'knowledge_base';
  if (signals.some((signal) => signal.provenance === 'computed')) return 'computed';
  return 'unknown';
}

function blockConfidence(level, signals, provenance) {
  if (level === 'unknown' || provenance === 'unknown') return 'low';
  if (signals.some((signal) => signal.status === 'fail')) return 'medium';
  if (provenance === 'knowledge_base' || provenance === 'computed') return 'medium';
  return 'low';
}

function knowledgeBlock(level, summary, signals, verdictImpact, actionImpact, forcedProvenance) {
  const provenance = forcedProvenance || blockProvenance(level, signals);
  return {
    level,
    summary,
    provenance,
    confidence: blockConfidence(level, signals, provenance),
    signals: signals.map((signal) => ({
      ...signal,
      provenance: signal.provenance || provenance,
      evidenceType: signal.evidenceType || (signal.provenance === 'knowledge_base' ? 'first_party_knowledge' : 'computed_rule'),
    })),
    verdictImpact,
    actionImpact,
  };
}

function marketKnowledgeSignal(profile, key, field, label, status = 'warn', impact = 'medium') {
  const note = profile?.[field]?.[0];
  if (!note) return null;
  return knowledgeBaseSignal(key, `${label}：${note}`, status, impact);
}

function marketComplexityLevel(profile, field) {
  return profile?.[field] || null;
}

function mergeLevel(current, next) {
  const rank = { unknown: 0, good: 1, limited: 2, blocked: 3 };
  if (!next) return current;
  if (current === 'unknown') return next;
  return rank[next] > rank[current] ? next : current;
}

function levelStatus(level) {
  if (level === 'good') return 'pass';
  if (level === 'blocked') return 'fail';
  if (level === 'unknown') return 'unknown';
  return 'warn';
}

function levelImpact(level) {
  if (level === 'blocked') return 'high';
  if (level === 'limited') return 'medium';
  return 'low';
}

function textIncludesAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function safePush(array, item) {
  if (item) array.push(item);
}

function isTrustedConstraint(block) {
  return block?.level === 'blocked' && (block.provenance === 'knowledge_base' || block.provenance === 'computed');
}

function isUntrustedBlocked(block) {
  return block?.level === 'blocked' && block.provenance === 'llm_inferred';
}

function confidenceRank(value) {
  if (value === 'high' || value === '中高' || value === '高') return 3;
  if (value === 'medium' || value === '中') return 2;
  return 1;
}

function confidenceCopy(rank) {
  if (rank >= 3) return { confidence: '高', confidenceLevel: 'high' };
  if (rank === 2) return { confidence: '中', confidenceLevel: 'medium' };
  return { confidence: '低', confidenceLevel: 'low' };
}

function clampVerdictConfidence(verdict, { evidence, firstPartyKnowledge }) {
  if (!verdict || verdict.confidence === '样本') return verdict;
  const evidenceList = Array.isArray(evidence) ? evidence : [];
  const nonUserEvidence = evidenceList.filter((item) => item.sourceType !== 'user_input');
  const mediumHighEvidence = nonUserEvidence.filter((item) => item.strength === 'medium' || item.strength === 'high').length;
  const mostlyLowEvidence = evidenceList.length === 0 || mediumHighEvidence === 0;
  const knowledgeBlocks = Object.values(firstPartyKnowledge || {});
  const coreUnknownCount = ['paymentFit', 'localizationCost', 'complianceRisk', 'aiCostRisk', 'acquisitionRisk']
    .filter((key) => firstPartyKnowledge?.[key]?.level === 'unknown').length;
  const hasTrustedBlocked = knowledgeBlocks.some((block) => isTrustedConstraint(block));
  const hasLlmInferred = knowledgeBlocks.some((block) => block?.provenance === 'llm_inferred' || block?.signals?.some((signal) => signal.provenance === 'llm_inferred'));

  let maxRank = 3;
  if (mostlyLowEvidence || coreUnknownCount >= 3) maxRank = 1;
  else if (hasTrustedBlocked || hasLlmInferred) maxRank = 2;
  else if (mediumHighEvidence < 2 || coreUnknownCount > 0) maxRank = 2;

  const currentRank = confidenceRank(verdict.confidenceLevel || verdict.confidence);
  if (currentRank <= maxRank) return { ...verdict, confidenceClamped: false };
  const clamped = confidenceCopy(maxRank);
  return {
    ...verdict,
    ...clamped,
    confidenceClamped: true,
    confidenceClampReason: mostlyLowEvidence
      ? '证据强度不足，confidence 最高只能为低。'
      : coreUnknownCount >= 3
        ? 'first-party knowledge 多个核心字段未知，confidence 最高只能为低。'
        : '存在来源或硬约束风险，confidence 已被后端钳制。',
  };
}

function buildFirstPartyKnowledge(assumptions, query = '') {
  const text = `${query || ''} ${Object.values(assumptions || {}).join(' ')}`.toLowerCase();
  const businessModel = String(assumptions.businessModel || '未明确');
  const targetMarket = String(assumptions.targetMarket || '未明确');
  const productType = String(assumptions.productType || '未明确');
  const platform = String(assumptions.platformForm || assumptions.platform || '未明确');
  const acquisitionChannel = String(assumptions.acquisitionChannel || '未明确');
  const marketProfile = getFirstPartyMarketProfile(targetMarket);
  const capabilities = getFirstPartyCapabilityProfiles();

  const isSubscription = /订阅|subscription|会员|月费|iap|内购/i.test(businessModel);
  const isOneTime = /一次性|买断|one.?time/i.test(businessModel);
  const isPaid = isSubscription || isOneTime || /付费|支付|价格|收款|硬件销售/i.test(businessModel);
  const marketNeedsLocalPayment = /东南亚|拉美|巴西|印尼|印度|菲律宾|泰国|越南/i.test(targetMarket);
  const maturePaymentMarket = /日本|欧美|美国|欧洲|韩国/i.test(targetMarket);
  const contentHeavy = /内容|短剧|社交|陪伴|客服|聊天|社区|ugc|老人|未成年人|游戏/i.test(text);
  const appLike = /app|移动|ios|android|应用/i.test(platform) || /app|移动|ios|android|应用/i.test(text);
  const webSaas = /web|saas|b2b/i.test(platform) || /saas|b2b/i.test(productType);
  const pluginLike = /插件|chrome|vscode|browser/i.test(platform) || /插件|chrome|vscode|browser/i.test(text);
  const gameLike = /游戏|手游/i.test(productType) || /游戏|手游/i.test(text);
  const regulated = /金融|借贷|支付牌照|医疗|药|保险|证券/i.test(text);
  const socialSensitive = /陪伴|社交|匿名|ugc|未成年人|老人|养老|约会|dating|聊天/i.test(text);
  const aiHeavy = /ai 图片|ai视频|视频|多模态|图片|绘图|生成图|陪伴聊天|agent|语音|模型/i.test(text);
  const aiLight = /文本|文案|摘要|轻量|客服/i.test(text);
  const lowPriceHighUsage = isSubscription && textIncludesAny(text, [/低价|低客单|便宜|\$0-\$5|高频|大量调用|token/i]);
  const contentAcquisition = /tiktok|youtube shorts|小红书|短视频|内容获客|素材/i.test(text);
  const b2bAcquisition = /b2b|saas|企业|outbound|seo/i.test(text);
  const offlineAcquisition = /老人|硬件|家庭|渠道合作|线下/i.test(text);

  const paymentFitSignals = [];
  let paymentFitLevel = 'good';
  let paymentFitSummary = '支付路径相对直接，仍需在验证中确认价格接受度。';
  if (businessModel === '未明确') {
    paymentFitLevel = 'unknown';
    paymentFitSummary = '尚未明确收费方式，无法判断支付适配。';
    paymentFitSignals.push(unknownKnowledgeSignal('payment_model_missing', '未明确收费方式'));
  } else if (textIncludesAny(text, [/跨境支付|支付牌照|收款产品|金融|借贷/])) {
    paymentFitLevel = 'blocked';
    paymentFitSummary = '方向涉及支付、金融或收款基础设施，进入前必须先确认牌照、结算和风控边界。';
    paymentFitSignals.push(knowledgeSignal('payment_infra_blocker', '支付/金融基础设施需要牌照与风控预审', 'fail', 'high'));
  } else if (marketNeedsLocalPayment) {
    paymentFitLevel = 'limited';
    paymentFitSummary = '目标市场可能需要本地钱包、本地支付或结算适配。';
    paymentFitSignals.push(knowledgeSignal('local_payment_needed', '需要检查本地支付方式', 'warn', 'high'));
  } else if (isSubscription && maturePaymentMarket) {
    paymentFitLevel = 'limited';
    paymentFitSummary = '订阅模式可行，但需要检查 IAP/Stripe、税务、退款与取消路径。';
    paymentFitSignals.push(knowledgeSignal('subscription_payment_check', '订阅支付与退款路径需验证', 'warn', 'high'));
  } else if (isOneTime) {
    paymentFitSignals.push(knowledgeSignal('one_time_lower_complexity', '一次性付费复杂度低于订阅', 'pass', 'medium'));
  } else {
    paymentFitSignals.push(knowledgeSignal('payment_interview_needed', '仍需价格接受度访谈', 'warn', 'medium'));
  }
  if (businessModel !== '未明确' && marketProfile) {
    const level = marketComplexityLevel(marketProfile, 'paymentComplexity');
    paymentFitLevel = mergeLevel(paymentFitLevel, level);
    safePush(paymentFitSignals, marketKnowledgeSignal(marketProfile, 'market_payment_profile', 'paymentNotes', '市场支付知识', levelStatus(level), levelImpact(level)));
  }
  if (businessModel !== '未明确' && capabilities.subscriptionPayment && isSubscription) {
    paymentFitSignals.push(knowledgeBaseSignal('subscription_payment_capability', `${capabilities.subscriptionPayment.label}可作为检查项`, 'pass', 'low'));
  }

  const paymentRiskSignals = [];
  let paymentRiskLevel = 'good';
  let paymentRiskSummary = '暂未发现高支付风险，但价格与退款仍需在验证中确认。';
  if (businessModel === '未明确') {
    paymentRiskLevel = 'unknown';
    paymentRiskSummary = '缺少付费方式，无法判断退款、拒付和价格透明度风险。';
    paymentRiskSignals.push(unknownKnowledgeSignal('payment_risk_unknown', '付费方式缺失'));
  } else {
    if (isSubscription) {
      paymentRiskLevel = 'limited';
      paymentRiskSummary = '订阅/IAP 需要重点检查退款、拒付、取消路径与价格透明度。';
      paymentRiskSignals.push(knowledgeSignal('subscription_refund_risk', '订阅退款与价格透明度风险', 'warn', 'high'));
    }
    if (/游戏|短剧|内容/i.test(productType)) {
      paymentRiskLevel = 'limited';
      paymentRiskSummary = '内容或游戏类产品更容易触发拒付、退款和风控问题。';
      paymentRiskSignals.push(knowledgeSignal('content_chargeback_risk', '内容/游戏拒付与风控风险', 'warn', 'high'));
    }
  }
  if (businessModel !== '未明确' && capabilities.antiFraudChargebackSupport) {
    paymentRiskSignals.push(knowledgeBaseSignal('chargeback_capability', `${capabilities.antiFraudChargebackSupport.label}可作为预检查项`, 'pass', 'low'));
  }

  const localizationSignals = [];
  let localizationLevel = 'good';
  let localizationSummary = '本地化复杂度较低，可先用轻量英文或简化文案验证。';
  if (targetMarket === '未明确') {
    localizationLevel = 'unknown';
    localizationSummary = '尚未明确目标市场，无法判断本地化成本。';
    localizationSignals.push(unknownKnowledgeSignal('localization_market_missing', '目标市场缺失'));
  } else if (!marketProfile) {
    localizationLevel = 'unknown';
    localizationSummary = '当前知识库尚未覆盖该市场，本地化成本需要先补充资料。';
    localizationSignals.push(unknownKnowledgeSignal('localization_market_not_covered', '知识库未覆盖该市场'));
  } else {
    const level = marketComplexityLevel(marketProfile, 'localizationComplexity');
    localizationLevel = mergeLevel(localizationLevel, level);
    if (level === 'limited') localizationSummary = marketProfile.localizationNotes?.[0] || localizationSummary;
    safePush(localizationSignals, marketKnowledgeSignal(marketProfile, 'market_localization_profile', 'localizationNotes', '市场本地化知识', levelStatus(level), levelImpact(level)));
  }
  if (localizationLevel !== 'unknown' && /日本|韩国|中东|阿拉伯/i.test(targetMarket)) {
    localizationLevel = 'limited';
    localizationSummary = '目标市场对语言、文化语境和 UI 文案精度要求较高。';
    localizationSignals.push(knowledgeSignal('high_context_market', '高语境市场需要母语文案检查', 'warn', 'high'));
  } else if (localizationLevel !== 'unknown' && /美国|欧美|欧洲|Global/i.test(targetMarket)) {
    localizationSignals.push(knowledgeSignal('english_market_lower_cost', '英语市场本地化成本较低', 'pass', 'low'));
  }
  if (localizationLevel !== 'unknown' && contentHeavy) {
    localizationLevel = localizationLevel === 'good' ? 'limited' : localizationLevel;
    localizationSummary = '产品依赖大量内容、陪伴或客服表达，本地化成本会明显提高。';
    localizationSignals.push(knowledgeSignal('content_heavy_localization', '内容/社交/陪伴表达需要本地化验证', 'warn', 'high'));
  }
  if (webSaas && !contentHeavy && localizationLevel === 'good') {
    localizationSignals.push(knowledgeSignal('tool_saas_low_copy', '工具型 SaaS 首版文案负担较低', 'pass', 'low'));
  }
  if (localizationLevel !== 'unknown' && capabilities.localizationTranslation) {
    localizationSignals.push(knowledgeBaseSignal('localization_capability', `${capabilities.localizationTranslation.label}可作为检查项`, 'pass', 'low'));
  }

  const complianceSignals = [];
  let complianceLevel = 'good';
  let complianceSummary = '暂未发现阻断性合规风险，但仍需在验证前检查隐私和平台规则。';
  if (regulated) {
    complianceLevel = 'blocked';
    complianceSummary = '涉及金融、支付牌照、医疗或高监管领域，必须先做合规预审。';
    complianceSignals.push(knowledgeSignal('regulated_category_blocked', '高监管品类需先合规预审', 'fail', 'high'));
  } else {
    if (marketProfile) {
      const level = marketComplexityLevel(marketProfile, 'complianceComplexity');
      complianceLevel = mergeLevel(complianceLevel, level);
      if (level === 'limited') complianceSummary = marketProfile.complianceNotes?.[0] || complianceSummary;
      safePush(complianceSignals, marketKnowledgeSignal(marketProfile, 'market_compliance_profile', 'complianceNotes', '市场合规知识', levelStatus(level), levelImpact(level)));
    }
    if (/ai|人工智能|模型|生成/i.test(text)) {
      complianceLevel = 'limited';
      complianceSummary = 'AI 产品需要检查数据隐私、AI 内容披露和平台审核要求。';
      complianceSignals.push(knowledgeSignal('ai_disclosure_privacy', 'AI 内容披露与隐私风险', 'warn', 'high'));
    }
    if (appLike) {
      complianceLevel = 'limited';
      complianceSummary = '移动应用需要提前检查 App Store / Google Play 审核路径。';
      complianceSignals.push(knowledgeSignal('app_store_review', '应用商店审核风险', 'warn', 'medium'));
    }
    if (isSubscription) {
      complianceLevel = 'limited';
      complianceSignals.push(knowledgeSignal('subscription_transparency', '订阅价格和取消路径需透明', 'warn', 'high'));
    }
    if (socialSensitive) {
      complianceLevel = 'limited';
      complianceSummary = '社交、陪伴、UGC、老人或未成年人场景需要更严格的隐私和安全检查。';
      complianceSignals.push(knowledgeSignal('sensitive_user_safety', '敏感人群/UGC 安全风险', 'warn', 'high'));
    }
  }
  if (appLike && capabilities.appStoreReviewSupport) {
    complianceSignals.push(knowledgeBaseSignal('app_review_capability', `${capabilities.appStoreReviewSupport.label}可作为预检查项`, 'pass', 'low'));
  }

  const aiCostSignals = [];
  let aiCostLevel = 'good';
  let aiCostSummary = '暂未发现明显 AI 单位经济风险。';
  if (/ai|人工智能|模型|生成|agent/i.test(text)) {
    aiCostLevel = aiLight ? 'limited' : 'limited';
    aiCostSummary = 'AI 功能需要估算单用户推理成本与毛利空间。';
    aiCostSignals.push(knowledgeSignal('ai_unit_cost_needed', '需要测算单用户推理成本', 'warn', 'high'));
    if (aiHeavy) {
      aiCostSummary = '图片、视频、多模态或陪伴聊天会显著提高推理成本风险。';
      aiCostSignals.push(knowledgeSignal('high_inference_cost', '高频/多模态推理成本风险', 'warn', 'high'));
    }
    if (lowPriceHighUsage) {
      aiCostLevel = 'blocked';
      aiCostSummary = '低价订阅叠加高频推理，可能无法支撑单位经济模型。';
      aiCostSignals.push(knowledgeSignal('low_price_high_usage_blocker', '低价高频推理可能不成立', 'fail', 'high'));
    }
    if (/低价 token|模型成本优势|已有成本优势/i.test(text)) {
      aiCostLevel = 'limited';
      aiCostSummary = '用户提到成本优势，但仍需用真实调用量验证毛利。';
      aiCostSignals.push(knowledgeSignal('claimed_cost_advantage', '已有成本优势仍需复核', 'warn', 'medium'));
    }
    if (capabilities.lowCostTokenSupply) {
      aiCostSignals.push(knowledgeBaseSignal('token_supply_capability', `${capabilities.lowCostTokenSupply.label}可作为成本检查项`, 'pass', 'low'));
    }
  } else {
    aiCostSignals.push(knowledgeSignal('not_ai_heavy', '非 AI 重推理方向', 'pass', 'low'));
  }

  const acquisitionSignals = [];
  let acquisitionLevel = 'good';
  let acquisitionSummary = '已有初步获客方向，但仍需用小样本测试验证。';
  if (acquisitionChannel === '未明确') {
    acquisitionLevel = 'unknown';
    acquisitionSummary = '尚未明确获客渠道，无法判断触达成本。';
    acquisitionSignals.push(unknownKnowledgeSignal('acquisition_missing', '获客渠道缺失'));
  } else {
    if (marketProfile) {
      const level = marketComplexityLevel(marketProfile, 'acquisitionComplexity');
      acquisitionLevel = mergeLevel(acquisitionLevel, level);
      if (level === 'limited') acquisitionSummary = marketProfile.acquisitionNotes?.[0] || acquisitionSummary;
      safePush(acquisitionSignals, marketKnowledgeSignal(marketProfile, 'market_acquisition_profile', 'acquisitionNotes', '市场获客知识', levelStatus(level), levelImpact(level)));
    }
    if (contentAcquisition) {
      acquisitionLevel = 'limited';
      acquisitionSummary = '内容获客需要素材测试和创意迭代，不能只看单条内容反馈。';
      acquisitionSignals.push(knowledgeSignal('creative_testing_needed', '需要测试 3 条素材', 'warn', 'medium'));
    }
    if (b2bAcquisition) {
      acquisitionLevel = 'limited';
      acquisitionSummary = 'B2B SaaS 冷启动更依赖访谈、outbound 与 SEO 组合验证。';
      acquisitionSignals.push(knowledgeSignal('b2b_outbound_needed', 'B2B 需要访谈/outbound/SEO 组合', 'warn', 'medium'));
    }
    if (offlineAcquisition) {
      acquisitionLevel = 'limited';
      acquisitionSummary = '家庭、老人或硬件方向不能只依赖线上广告，需要渠道合作验证。';
      acquisitionSignals.push(knowledgeSignal('offline_channel_needed', '需要线下或渠道合作验证', 'warn', 'high'));
    }
  }

  const platformSignals = [];
  let platformLevel = 'good';
  let platformSummary = '平台风险较低，优先关注支付、隐私和获客验证。';
  if (platform === '未明确' && !appLike && !pluginLike && !gameLike && !webSaas) {
    platformLevel = 'unknown';
    platformSummary = '尚未明确产品平台形态，无法判断上架、审核或权限风险。';
    platformSignals.push(unknownKnowledgeSignal('platform_missing', '平台形态缺失'));
  } else if (appLike) {
    platformLevel = 'limited';
    platformSummary = '移动 App 存在上架、审核、订阅/IAP 和隐私声明风险。';
    platformSignals.push(knowledgeSignal('app_platform_review', 'App 上架与审核风险', 'warn', 'high'));
  } else if (pluginLike) {
    platformLevel = 'limited';
    platformSummary = '浏览器或开发者插件需要检查商店审核与权限边界。';
    platformSignals.push(knowledgeSignal('extension_store_review', '插件商店审核与权限风险', 'warn', 'medium'));
  } else if (gameLike) {
    platformLevel = 'limited';
    platformSummary = '游戏需要检查年龄分级、内容审核和 IAP 政策。';
    platformSignals.push(knowledgeSignal('game_platform_policy', '游戏年龄分级与 IAP 政策', 'warn', 'high'));
  } else if (webSaas) {
    platformSignals.push(knowledgeSignal('web_saas_lower_platform_risk', 'Web SaaS 平台依赖较低', 'pass', 'low'));
  }
  if (platformLevel !== 'unknown' && marketProfile) {
    const level = marketComplexityLevel(marketProfile, 'platformComplexity');
    platformLevel = mergeLevel(platformLevel, level);
    safePush(platformSignals, marketKnowledgeSignal(marketProfile, 'market_platform_profile', 'platformNotes', '市场平台知识', levelStatus(level), levelImpact(level)));
  }

  const dimensions = {
    paymentFit: knowledgeBlock(paymentFitLevel, paymentFitSummary, paymentFitSignals, paymentFitLevel === 'blocked' ? '支付路径阻断时不能 validate。' : '支付适配会影响是否先做付费验证。', '影响 24h 价格和支付路径检查。'),
    paymentRisk: knowledgeBlock(paymentRiskLevel, paymentRiskSummary, paymentRiskSignals, '支付风险会降低直接 MVP 建议强度。', '影响退款、拒付和价格透明度检查。'),
    localizationCost: knowledgeBlock(localizationLevel, localizationSummary, localizationSignals, '本地化复杂度会提高进入门槛。', '影响 7d 本地语言 landing page 和母语用户审校。'),
    complianceRisk: knowledgeBlock(complianceLevel, complianceSummary, complianceSignals, complianceLevel === 'blocked' ? '合规阻断时必须先预审。' : '合规风险会限制直接投入。', '影响停止门槛与平台审核检查。'),
    aiCostRisk: knowledgeBlock(aiCostLevel, aiCostSummary, aiCostSignals, aiCostLevel === 'blocked' ? '单位经济不成立时不建议 MVP。' : 'AI 成本会影响价格和调用频次验证。', '影响模型成本测算和低成本替代测试。'),
    acquisitionRisk: knowledgeBlock(acquisitionLevel, acquisitionSummary, acquisitionSignals, '获客不清会降低判断可信度。', '影响素材测试、访谈和小预算投放。'),
    platformRisk: knowledgeBlock(platformLevel, platformSummary, platformSignals, '平台风险会影响上架前动作。', '影响审核、权限和平台政策检查。'),
  };

  const blockedCount = Object.values(dimensions).filter((item) => item.level === 'blocked').length;
  const limitedCount = Object.values(dimensions).filter((item) => item.level === 'limited').length;
  const unknownCount = Object.values(dimensions).filter((item) => item.level === 'unknown').length;
  const complexity = blockedCount > 0 || limitedCount >= 4 ? 'complex' : limitedCount >= 2 || unknownCount >= 2 ? 'moderate' : 'simple';
  const complexityLevel = complexity === 'complex' ? 'blocked' : complexity === 'moderate' ? 'limited' : 'good';
  dimensions.marketEntryComplexity = {
    ...knowledgeBlock(
      complexityLevel,
      complexity === 'complex'
        ? '存在多个进入前关键约束，建议先做低成本预验证与专项检查。'
        : complexity === 'moderate'
          ? '存在若干进入约束，适合用 24h / 7d 验证逐步拆解。'
          : '当前进入复杂度相对可控，但仍需保留停止门槛。',
      [knowledgeSignal('entry_complexity_summary', `综合复杂度：${complexity}`, complexity === 'simple' ? 'pass' : 'warn', complexity === 'complex' ? 'high' : 'medium')],
      '综合进入复杂度会钳制最终 verdict。',
      '影响是否直接进入 MVP 或先补证据。',
    ),
    complexity,
    blockedCount,
    limitedCount,
    unknownCount,
  };

  return dimensions;
}

function addKnowledgeMissingInfo(missingInfo, knowledge) {
  const additions = [];
  if (knowledge.paymentFit.level === 'unknown') {
    additions.push({ key: 'businessModel', label: '商业模式', reason: '未明确收费方式，无法判断支付适配。', example: '补充订阅、一次性付费、IAP、广告或其他收费路径。' });
  }
  if (knowledge.acquisitionRisk.level === 'unknown') {
    additions.push({ key: 'acquisitionChannel', label: '获客渠道', reason: '未明确获客渠道，无法判断触达成本。', example: '补充 SEO、社群、投放、应用商店、内容渠道或 outbound。' });
  }
  if (knowledge.localizationCost.level === 'unknown') {
    additions.push({ key: 'targetMarket', label: '目标市场', reason: '目标市场缺失或知识库未覆盖，无法判断本地化成本。', example: '补充具体目标市场，并优先选择已覆盖市场做第一轮验证。' });
  }
  if (knowledge.platformRisk.level === 'unknown') {
    additions.push({ key: 'platformForm', label: '平台形态', reason: '平台形态缺失，无法判断上架、审核或权限风险。', example: '补充 Web SaaS、移动 App、浏览器插件、游戏或 API 服务。' });
  }
  if (knowledge.complianceRisk.provenance === 'llm_inferred' || knowledge.paymentFit.provenance === 'llm_inferred' || knowledge.aiCostRisk.provenance === 'llm_inferred') {
    additions.push({ key: 'firstPartyProvenance', label: '判断来源', reason: '存在 AI 推断来源的关键约束，不能作为硬拦截依据。', example: '补充知识库、官方文档或可解释规则来源。' });
  }
  const seen = new Set(missingInfo.map((item) => item.key));
  return [...missingInfo, ...additions.filter((item) => !seen.has(item.key))];
}

function normalizeFirstPartyEvidence(firstPartyKnowledge) {
  return Object.entries(firstPartyKnowledge).map(([key, value]) => ({
    title: value.summary,
    summary: value.signals?.[0]?.reportOnly
      ? '出海关键约束预览。完整原因和操作拆解适合放入 Report 页。'
      : value.verdictImpact,
    source: 'HotPulse First-Party Knowledge Core',
    sourceType: 'first_party_knowledge',
    url: null,
    strength: value.provenance === 'knowledge_base' || value.signals?.some((signal) => signal.evidenceType === 'first_party_knowledge') ? 'medium' : 'low',
    metadata: {
      dimension: key,
      level: value.level,
      provenance: value.provenance,
      confidence: value.confidence,
      evidenceType: value.signals?.[0]?.evidenceType || 'hypothesis',
      reportOnly: value.signals?.some((signal) => signal.reportOnly) ?? true,
    },
  }));
}

function paidModelDependsOnPayment(assumptions) {
  return /订阅|subscription|会员|月费|iap|内购|一次性|买断|付费|支付|收款|硬件销售/i.test(String(assumptions.businessModel || ''));
}

function firstPartyConstraint(firstPartyKnowledge, assumptions) {
  const unknownCount = Object.values(firstPartyKnowledge).filter((item) => item.level === 'unknown').length;
  if (isTrustedConstraint(firstPartyKnowledge.complianceRisk)) {
    return { code: 'compliance', level: 'hold', nextMove: '先做合规预审', mainRisk: '合规风险可能阻断进入路径', reason: firstPartyKnowledge.complianceRisk.summary };
  }
  if (isUntrustedBlocked(firstPartyKnowledge.complianceRisk)) {
    return { code: 'compliance_untrusted', level: 'prevalidate', nextMove: '先补充合规依据，不直接采信 AI 推断', mainRisk: '合规风险来源未经验证', reason: '合规 blocked 来自非可信 provenance，已降级为预验证。' };
  }
  if (isTrustedConstraint(firstPartyKnowledge.paymentFit) && paidModelDependsOnPayment(assumptions)) {
    return { code: 'payment', level: 'prevalidate', nextMove: '先做支付适配检查', mainRisk: '支付适配可能阻断商业模式', reason: firstPartyKnowledge.paymentFit.summary };
  }
  if (isUntrustedBlocked(firstPartyKnowledge.paymentFit)) {
    return { code: 'payment_untrusted', level: 'prevalidate', nextMove: '先补充支付适配依据', mainRisk: '支付 blocked 来源未经验证', reason: '支付 blocked 来自非可信 provenance，不能作为硬拦截。' };
  }
  if (isTrustedConstraint(firstPartyKnowledge.aiCostRisk)) {
    return { code: 'ai_cost', level: 'hold', nextMove: '先测算单位经济模型', mainRisk: 'AI 单位经济模型可能不成立', reason: firstPartyKnowledge.aiCostRisk.summary };
  }
  if (isUntrustedBlocked(firstPartyKnowledge.aiCostRisk)) {
    return { code: 'ai_cost_untrusted', level: 'prevalidate', nextMove: '先补充 AI 成本依据', mainRisk: 'AI 成本 blocked 来源未经验证', reason: 'AI 成本 blocked 来自非可信 provenance，不能直接阻断。' };
  }
  if ((firstPartyKnowledge.marketEntryComplexity.level === 'blocked' || firstPartyKnowledge.marketEntryComplexity.complexity === 'complex') && firstPartyKnowledge.marketEntryComplexity.provenance === 'computed') {
    return { code: 'complexity', level: 'prevalidate', nextMove: '先做低成本预验证并补齐专项证据', mainRisk: '市场进入复杂度较高', reason: firstPartyKnowledge.marketEntryComplexity.summary };
  }
  if (unknownCount >= 3) {
    return { code: 'unknowns', level: 'insufficient', nextMove: '先补齐商业模式、获客渠道和平台形态', mainRisk: '多个关键约束未知', reason: 'first-party knowledge 多个维度仍为 unknown，当前判断需要降级。' };
  }
  return null;
}

function buildJudgmentVerdict({ mode, response, evidence, missingInfo, firstPartyKnowledge, assumptions }) {
  const highCount = evidence.filter((item) => item.strength === 'high' && item.url).length;
  const mediumCount = evidence.filter((item) => item.strength === 'medium').length;
  const externalCount = evidence.filter((item) => item.sourceType !== 'user_input' && item.url).length;
  const weakEvidence = highCount === 0 && mediumCount <= 1;
  const constraint = firstPartyKnowledge ? firstPartyConstraint(firstPartyKnowledge, assumptions) : null;

  if (mode === 'mock') {
    return {
      code: 'preview',
      level: 'preview',
      title: '样本模式：仅展示验证结果结构',
      confidence: '样本',
      confidenceLevel: 'low',
      nextMove: '切换真实数据源或补齐真实证据后再判断',
      mainRisk: '当前是 mock preview，不能作为真实进入判断。',
      reason: '样本模式不包含真实市场证据，所有结论只用于查看结构。',
      scorePreview: Math.min(response.recommendation?.matchScore || 25, 25),
    };
  }

  if (constraint) {
    return {
      code: constraint.level,
      level: constraint.level,
      title: constraint.level === 'insufficient' ? '信息不足，先补齐关键约束' : '先处理出海关键约束，再决定是否进入 MVP',
      confidence: '低',
      confidenceLevel: 'low',
      nextMove: constraint.nextMove,
      mainRisk: constraint.mainRisk,
      reason: constraint.reason,
      scorePreview: Math.min(response.recommendation?.matchScore || 45, 52),
      constraintTriggers: [constraint.code],
    };
  }

  if (mode === 'fallback' || missingInfo.length >= 3 || weakEvidence) {
    return {
      code: 'prevalidate',
      level: 'prevalidate',
      title: '先做低成本预验证，暂不建议正式投入',
      confidence: mode === 'fallback' || weakEvidence ? '低' : '中低',
      confidenceLevel: 'low',
      nextMove: '48 小时补齐用户访谈、价格和渠道证据',
      mainRisk: missingInfo[0]?.label ? `${missingInfo[0].label}不完整` : '证据覆盖不足',
      reason: mode === 'fallback'
        ? '当前使用本地规则或样本信号，不能当作正式市场判断。'
        : '现有证据较弱，不足以直接进入 MVP 开发。',
      scorePreview: Math.min(response.recommendation?.matchScore || 45, 55),
    };
  }

  if (highCount >= 2 && mediumCount + highCount >= 3 && externalCount >= 2) {
    return {
      code: 'validate',
      level: 'validate',
      title: '可以进入 7 天 MVP 验证',
      confidence: '中高',
      confidenceLevel: 'medium_high',
      nextMove: '执行 24h / 7d 验证计划，并记录停止门槛',
      mainRisk: response.riskBottlenecks?.[0]?.title || '支付、渠道或本地化风险',
      reason: '已有多个可追溯外部信号，但仍需要用真实用户反馈完成判断。',
      scorePreview: Math.min(response.recommendation?.matchScore || 72, 82),
    };
  }

  return {
    code: 'hold',
    level: 'hold',
    title: '继续观察，并先补关键证据',
    confidence: '中',
    confidenceLevel: 'medium',
    nextMove: '先验证痛点、价格和渠道，再决定是否扩大投入',
    mainRisk: response.riskBottlenecks?.[0]?.title || '关键假设未验证',
    reason: '当前方向有参考信号，但证据强度不足以形成进入判断。',
    scorePreview: Math.min(response.recommendation?.matchScore || 60, 68),
  };
}

function normalizeActionStage(raw, fallback) {
  if (raw && typeof raw === 'object') {
    const steps = Array.isArray(raw.actions) ? raw.actions.slice(0, 4) : Array.isArray(raw.steps) ? raw.steps.slice(0, 4) : fallback.steps;
    return {
      title: raw.stage || raw.name || raw.title || fallback.title,
      purpose: raw.goal || raw.purpose || fallback.purpose,
      steps,
      successMetric: raw.passCondition || raw.successMetric || fallback.successMetric,
      stopCondition: raw.stopCondition || fallback.stopCondition,
      deliverable: raw.requiredResource || raw.deliverable || fallback.deliverable,
      triggeredItems: Array.isArray(raw.triggeredItems) ? raw.triggeredItems : fallback.triggeredItems || [],
    };
  }
  return fallback;
}

function triggeredItem(firstPartyKnowledge, trigger, title, description, successMetric = '完成该项检查并记录结论。') {
  const block = firstPartyKnowledge?.[trigger] || {};
  return {
    title,
    description,
    successMetric,
    trigger,
    provenance: block.provenance || 'unknown',
  };
}

function appendTriggeredItems(stage, items) {
  const existingSteps = Array.isArray(stage.steps) ? stage.steps : [];
  const triggeredItems = [...(stage.triggeredItems || []), ...items];
  return {
    ...stage,
    steps: [...existingSteps, ...items.map((item) => item.title)].filter(Boolean).slice(0, 6),
    triggeredItems,
  };
}

function firstPartyActionTriggers(firstPartyKnowledge) {
  const actions = {
    twentyFourHours: [],
    sevenDays: [],
    stopGate: [],
  };

  if (firstPartyKnowledge.paymentFit.level === 'limited' || firstPartyKnowledge.paymentFit.level === 'blocked' || firstPartyKnowledge.paymentFit.level === 'unknown') {
    if (firstPartyKnowledge.paymentFit.provenance === 'unknown') {
      actions.twentyFourHours.push(triggeredItem(firstPartyKnowledge, 'paymentFit', '补充收费方式', '先明确订阅、IAP、一次性付费、广告或其他收费路径。', '收费方式被明确记录。'));
    } else {
      actions.twentyFourHours.push(
        triggeredItem(firstPartyKnowledge, 'paymentFit', '明确收费方式', '把收费方式拆成订阅、IAP、Stripe、本地支付或一次性付费路径。', '形成一版可验证的收费路径。'),
        triggeredItem(firstPartyKnowledge, 'paymentFit', '验证是否走 IAP / Stripe / 本地支付', '根据目标市场和平台检查支付路径是否可执行。', '确认至少 1 条支付路径可进入访谈验证。'),
        triggeredItem(firstPartyKnowledge, 'paymentFit', '做价格接受度访谈', '围绕目标用户访谈价格、退款和付款意愿。', '10 人中至少 2 人接受某个价格锚点。'),
      );
    }
  }

  if (firstPartyKnowledge.localizationCost.level === 'limited' || firstPartyKnowledge.localizationCost.level === 'blocked') {
    actions.sevenDays.push(
      triggeredItem(firstPartyKnowledge, 'localizationCost', '做目标语言 landing page 小样本测试', '用目标语言表达核心价值主张，观察理解和留资。', '至少获得 3 条可用文案反馈。'),
      triggeredItem(firstPartyKnowledge, 'localizationCost', '找 3 个母语用户审文案', '确认语气、长度、场景和信任表达是否自然。', '完成 3 份母语审校反馈。'),
      triggeredItem(firstPartyKnowledge, 'localizationCost', '限制首版文案长度', '首版只保留必要信息，降低本地化成本和 UI 风险。', '首版核心页面文案可在 1 天内审完。'),
    );
  }

  if (firstPartyKnowledge.complianceRisk.level === 'limited' || firstPartyKnowledge.complianceRisk.level === 'blocked') {
    actions.stopGate.push(
      triggeredItem(firstPartyKnowledge, 'complianceRisk', '无法明确平台审核路径时停止开发投入', '先确认 App、订阅、AI 内容披露、隐私或敏感人群规则。', '审核路径和风险清单被明确记录。'),
      triggeredItem(firstPartyKnowledge, 'complianceRisk', '订阅价格/取消路径不透明时停止投放', '避免在合规未清楚时扩大获客预算。', '订阅价格和取消路径已可被用户理解。'),
    );
  }

  if (firstPartyKnowledge.aiCostRisk.level === 'limited' || firstPartyKnowledge.aiCostRisk.level === 'blocked') {
    actions.twentyFourHours.push(
      triggeredItem(firstPartyKnowledge, 'aiCostRisk', '估算单用户推理成本', '估算一次核心任务的模型、图片、视频或 token 成本。', '得到单用户成本区间和毛利假设。'),
      triggeredItem(firstPartyKnowledge, 'aiCostRisk', '测试低成本模型替代', '准备低成本模型或缓存策略，验证质量是否足够。', '至少 1 个低成本替代方案可用。'),
      triggeredItem(firstPartyKnowledge, 'aiCostRisk', '限制高频调用场景', '先限制高频生成或陪伴调用，避免验证期成本失真。', '明确高频调用的限制策略。'),
    );
  }

  if (firstPartyKnowledge.acquisitionRisk.level === 'limited' || firstPartyKnowledge.acquisitionRisk.level === 'unknown') {
    if (firstPartyKnowledge.acquisitionRisk.provenance === 'unknown') {
      actions.sevenDays.push(triggeredItem(firstPartyKnowledge, 'acquisitionRisk', '补充获客渠道', '先明确 SEO、内容、投放、社群、应用商店或 outbound 中的优先渠道。', '至少确定 1 个可执行获客测试渠道。'));
    } else {
      actions.sevenDays.push(
        triggeredItem(firstPartyKnowledge, 'acquisitionRisk', '先测 3 条素材', '围绕不同卖点准备 3 条内容或广告素材。', '记录每条素材的点击、留言或留资表现。'),
        triggeredItem(firstPartyKnowledge, 'acquisitionRisk', '做小预算投放或 outbound 测试', '用低成本方式验证渠道触达，不扩大预算。', '获得初步 CPA / 留资率 / 预约率。'),
        triggeredItem(firstPartyKnowledge, 'acquisitionRisk', '记录 CPA / 留资率 / 预约率', '把渠道反馈转成继续、暂缓或停止判断。', '形成一张渠道测试记录。'),
      );
    }
  }

  if (firstPartyKnowledge.platformRisk.level === 'limited' || firstPartyKnowledge.platformRisk.level === 'blocked') {
    actions.stopGate.push(
      triggeredItem(firstPartyKnowledge, 'platformRisk', '无法确认上架或插件商店审核路径时暂停开发投入', '先确认平台审核、权限、IAP、隐私声明和内容规则。', '平台审核路径被明确记录。'),
    );
  }

  return actions;
}

function buildJudgmentActionPlan(response, firstPartyKnowledge) {
  const plan = Array.isArray(response.mvpValidationPlan) ? response.mvpValidationPlan : [];
  const base = {
    twentyFourHours: normalizeActionStage(plan[0], {
      title: '补齐证据验证',
      purpose: '确认目标用户是否真的有该痛点。',
      steps: ['写 1 页 landing page', '找 10 个目标用户访谈', '记录愿意留邮箱/预约的人数'],
      successMetric: '10 人中至少 3 人表达明确需求。',
      stopCondition: '少于 2 人愿意继续了解。',
      deliverable: '访谈记录 + 需求强度判断',
      triggeredItems: [],
    }),
    sevenDays: normalizeActionStage(plan[1], {
      title: '价格与渠道小测试',
      purpose: '验证愿不愿意付费，以及哪个渠道能触达。',
      steps: ['测试 2 个价格点', '跑 1 个小预算渠道', '记录点击、留资和预约'],
      successMetric: '至少 2 个用户接受价格或询问付款方式。',
      stopCondition: '无人接受价格，或触达成本明显过高。',
      deliverable: '价格反馈 + 渠道响应表',
      triggeredItems: [],
    }),
    stopGate: {
      title: '停止条件清单',
      purpose: '防止低证据方向继续消耗开发和投放预算。',
      steps: [
        '10 个目标用户中少于 2 人表达明确需求',
        '没有人愿意留下邮箱或预约',
        '用户认为当前替代方案已经足够',
      ],
      successMetric: '只有出现明确继续信号才扩大投入。',
      stopCondition: response.riskBottlenecks?.[0]?.stopOrAdjust || '没有明确需求、价格或渠道信号。',
      deliverable: '停止/继续决策记录',
      triggeredItems: [],
    },
  };

  if (!firstPartyKnowledge) return base;
  const triggers = firstPartyActionTriggers(firstPartyKnowledge);
  return {
    twentyFourHours: appendTriggeredItems(base.twentyFourHours, triggers.twentyFourHours),
    sevenDays: appendTriggeredItems(base.sevenDays, triggers.sevenDays),
    stopGate: appendTriggeredItems(base.stopGate, triggers.stopGate),
  };
}

function attachJudgmentSchema(response, { query, profile, loadedSource, mode }) {
  const intent = response.parsedIntent || parseQueryIntent(query, profile);
  const assumptions = buildJudgmentAssumptions(query, profile, intent);
  const firstPartyKnowledge = buildFirstPartyKnowledge(assumptions, query);
  const missingInfo = addKnowledgeMissingInfo(buildMissingInfo(assumptions), firstPartyKnowledge);
  const evidence = [...normalizeJudgmentEvidence(response, loadedSource), ...normalizeFirstPartyEvidence(firstPartyKnowledge)];
  const rawVerdict = buildJudgmentVerdict({ mode, response, evidence, missingInfo, firstPartyKnowledge, assumptions });
  const verdict = clampVerdictConfidence(rawVerdict, { evidence, firstPartyKnowledge });
  const actionPlan = buildJudgmentActionPlan(response, firstPartyKnowledge);
  const hypotheses = [
    { id: 'demand', title: '需求假设', statement: `${assumptions.targetUser} 对该痛点有明确需求。`, status: missingInfo.some((item) => item.key === 'targetUser' || item.key === 'painPoint') ? 'needs_input' : 'ready_to_test' },
    { id: 'payment', title: '付费假设', statement: `${assumptions.businessModel} 可以被目标用户接受。`, status: assumptions.businessModel === '未明确' ? 'needs_input' : 'ready_to_test' },
    { id: 'channel', title: '渠道假设', statement: buildChannelHypothesisStatement(assumptions), status: assumptions.acquisitionChannel === '未明确' ? 'needs_input' : 'ready_to_test' },
  ];
  const judgment = {
    mode,
    input: { rawText: query, source: loadedSource, requestedAt: response.generatedAt },
    assumptions,
    missingInfo,
    verdict,
    hypotheses,
    evidence,
    actionPlan,
    firstPartyKnowledge,
  };

  return {
    ...response,
    mode,
    input: judgment.input,
    assumptions,
    missingInfo,
    verdict,
    hypotheses,
    evidence,
    actionPlan,
    firstPartyKnowledge,
    judgment,
  };
}

app.post('/api/analyze', async (req, res) => {
  const body = req.body || {};
  const query = typeof body.query === 'string' ? body.query.trim() : '';
  const requestedSource = body.source === 'real' ? 'real' : body.source === 'fallback' ? 'fallback' : 'mock';
  const profile = body.profile && typeof body.profile === 'object' ? body.profile : {};
  const loaded = await loadAnalyzeItems(requestedSource);
  const fallback = buildRuleAnalyzeResponse({ query, profile, source: requestedSource, loaded });
  const localMode = loaded.source === 'mock' ? 'mock' : 'fallback';
  const canonical = attachJudgmentSchema(fallback, { query, profile, loadedSource: loaded.source, mode: localMode });
  const beforeDraftSnapshot = createCanonicalInvariantSnapshot(canonical);
  const llmDraft = await buildLlmDraftForAnalyze({
    canonicalResponse: canonical,
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    endpointStyle: process.env.OPENAI_ENDPOINT_STYLE || 'responses',
    timeoutMs: process.env.OPENAI_TIMEOUT_MS,
  });
  const responsePayload = {
    ...canonical,
    llmDraft,
    ...(llmDraft.status === 'success' ? { llmMode: 'draft_only' } : {}),
  };
  const afterDraftSnapshot = createCanonicalInvariantSnapshot(responsePayload);
  if (!canonicalSnapshotsEqual(beforeDraftSnapshot, afterDraftSnapshot)) {
    responsePayload.llmDraft = {
      ...llmDraft,
      status: 'rejected',
      warnings: [...(llmDraft.warnings || []), 'LLM draft was rejected because canonical fields changed after draft generation.'],
    };
  }
  res.json(responsePayload);
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
