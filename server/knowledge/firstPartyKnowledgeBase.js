export const firstPartyKnowledgeBase = {
  marketProfiles: {
    Japan: {
      aliases: ['日本', 'japan', 'jp'],
      paymentNotes: ['订阅、IAP、退款和税务路径需要进入前检查。'],
      localizationNotes: ['高语境市场，文案、客服和信任表达需要母语检查。'],
      complianceNotes: ['移动应用、订阅和 AI 内容需要提前检查平台审核与透明披露。'],
      platformNotes: ['App Store / Google Play 审核路径需要提前确认。'],
      acquisitionNotes: ['内容获客需要本地化素材和创意迭代验证。'],
      paymentComplexity: 'limited',
      localizationComplexity: 'limited',
      complianceComplexity: 'limited',
      platformComplexity: 'limited',
      acquisitionComplexity: 'limited',
    },
    'United States': {
      aliases: ['美国', 'united states', 'usa', 'us'],
      paymentNotes: ['信用卡、订阅和退款流程较成熟，但价格透明度仍需检查。'],
      localizationNotes: ['英语首版本地化门槛相对较低。'],
      complianceNotes: ['隐私、AI 内容披露和订阅取消路径需要检查。'],
      platformNotes: ['Web SaaS 平台风险较低，移动应用仍需审核准备。'],
      acquisitionNotes: ['SEO、内容、outbound 和 paid test 都可作为验证渠道。'],
      paymentComplexity: 'good',
      localizationComplexity: 'good',
      complianceComplexity: 'limited',
      platformComplexity: 'good',
      acquisitionComplexity: 'limited',
    },
    'Southeast Asia': {
      aliases: ['东南亚', 'southeast asia', 'sea'],
      paymentNotes: ['本地钱包、本地支付和结算路径需要逐市场确认。'],
      localizationNotes: ['语言和支付习惯差异较大，不宜用单一市场假设覆盖。'],
      complianceNotes: ['不同国家平台、隐私和支付规则差异较大。'],
      platformNotes: ['移动端分发和本地支付体验需要提前验证。'],
      acquisitionNotes: ['内容、社群和本地渠道差异明显，需要小样本验证。'],
      paymentComplexity: 'limited',
      localizationComplexity: 'limited',
      complianceComplexity: 'limited',
      platformComplexity: 'limited',
      acquisitionComplexity: 'limited',
    },
    Indonesia: {
      aliases: ['印尼', 'indonesia'],
      paymentNotes: ['本地钱包、本地银行转账和结算路径需要检查。'],
      localizationNotes: ['语言、本地内容语境和客服表达需要验证。'],
      complianceNotes: ['支付、隐私和平台政策需要本地化检查。'],
      platformNotes: ['移动端体验和应用商店分发路径需要确认。'],
      acquisitionNotes: ['内容和社群渠道可验证，但需要本地素材。'],
      paymentComplexity: 'limited',
      localizationComplexity: 'limited',
      complianceComplexity: 'limited',
      platformComplexity: 'limited',
      acquisitionComplexity: 'limited',
    },
    Brazil: {
      aliases: ['巴西', 'brazil'],
      paymentNotes: ['本地支付方式、税务和退款路径需要进入前检查。'],
      localizationNotes: ['葡语文案和客服表达需要本地化检查。'],
      complianceNotes: ['支付、隐私和消费者保护规则需要预审。'],
      platformNotes: ['Web 与移动分发均需检查支付和隐私声明。'],
      acquisitionNotes: ['内容、本地社群和 paid test 需要小样本验证。'],
      paymentComplexity: 'limited',
      localizationComplexity: 'limited',
      complianceComplexity: 'limited',
      platformComplexity: 'limited',
      acquisitionComplexity: 'limited',
    },
    'Latin America': {
      aliases: ['拉美', 'latin america', 'latam'],
      paymentNotes: ['本地支付、汇率、结算和退款路径需要逐市场确认。'],
      localizationNotes: ['西语/葡语市场不能简单合并，需要分市场验证。'],
      complianceNotes: ['隐私、消费者保护和支付规则存在市场差异。'],
      platformNotes: ['移动端和本地支付体验需要前置验证。'],
      acquisitionNotes: ['内容和 paid test 可用，但素材需要本地化。'],
      paymentComplexity: 'limited',
      localizationComplexity: 'limited',
      complianceComplexity: 'limited',
      platformComplexity: 'limited',
      acquisitionComplexity: 'limited',
    },
    Europe: {
      aliases: ['欧洲', '欧美', 'europe', 'eu'],
      paymentNotes: ['订阅、VAT、退款和支付透明度需要检查。'],
      localizationNotes: ['多语言进入会提高本地化复杂度，英语首版可先验证。'],
      complianceNotes: ['隐私、cookie、AI 内容披露和订阅取消路径需要预审。'],
      platformNotes: ['Web SaaS 平台风险较低，App 仍需审核准备。'],
      acquisitionNotes: ['SEO、内容和 outbound 可作为早期验证渠道。'],
      paymentComplexity: 'limited',
      localizationComplexity: 'limited',
      complianceComplexity: 'limited',
      platformComplexity: 'good',
      acquisitionComplexity: 'limited',
    },
  },
  capabilityProfiles: {
    haipayPayment: { label: 'HaiPay 支付适配', status: 'available' },
    localPayout: { label: '本地结算支持', status: 'available' },
    multiCurrencySettlement: { label: '多币种结算', status: 'available' },
    subscriptionPayment: { label: '订阅支付检查', status: 'available' },
    appStoreReviewSupport: { label: 'App Store 审核支持', status: 'available' },
    googlePlayReviewSupport: { label: 'Google Play 审核支持', status: 'available' },
    localizationTranslation: { label: '本地化翻译检查', status: 'available' },
    antiFraudChargebackSupport: { label: '拒付与风控支持', status: 'available' },
    lowCostTokenSupply: { label: '低成本 token 供应评估', status: 'available' },
    overseasEntitySupport: { label: '海外主体支持', status: 'available' },
  },
};

export function getFirstPartyMarketProfile(targetMarket) {
  const normalized = String(targetMarket || '').trim().toLowerCase();
  if (!normalized || normalized === '未明确' || normalized === 'global') return null;

  return Object.entries(firstPartyKnowledgeBase.marketProfiles).find(([, profile]) => (
    profile.aliases.some((alias) => normalized.includes(alias.toLowerCase()))
  ))?.[1] || null;
}

export function getFirstPartyCapabilityProfiles() {
  return firstPartyKnowledgeBase.capabilityProfiles;
}
