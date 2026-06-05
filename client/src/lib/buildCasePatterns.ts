export type CasePattern = {
  id: string;
  icon: string;
  patternType: string;
  title: string;
  suitableFor: string;
  insight: string;
  validationAction: string;
  isExample: true;
};

export function buildCasePatterns(): CasePattern[] {
  return [
    {
      id: 'case-localization',
      icon: '🌐',
      patternType: '本地化验证',
      title: '先用单页本地化测试日本市场',
      suitableFor: 'AI 工具 / SaaS 出海团队',
      insight: '先验证文案、市场命名和用户理解度，再决定是否投入完整本地化。',
      validationAction: '先做 1 个目标市场 landing page，再看留资与点击反馈。',
      isExample: true,
    },
    {
      id: 'case-payment',
      icon: '💳',
      patternType: '支付链路',
      title: '先验证支付链路，再扩产品范围',
      suitableFor: '短剧 / 内容 / 订阅型团队',
      insight: '支付是否顺畅，往往比功能完整度更早决定能否进入。',
      validationAction: '先做支付按钮 / 订阅页测试，不急着做完整产品。',
      isExample: true,
    },
    {
      id: 'case-ads',
      icon: '📈',
      patternType: '小预算投放',
      title: '用小预算验证拉美内购和留资意愿',
      suitableFor: '游戏 / 增长 / 投放团队',
      insight: '先用低预算对比点击率和留资质量，避免一开始重投放。',
      validationAction: '先做 $50-$200 测试，观察点击与邮箱收集。',
      isExample: true,
    },
  ];
}
