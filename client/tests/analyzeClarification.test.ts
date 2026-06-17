import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyFieldAnswer,
  hasAllExplicit,
  mergeStructuredBrief,
  parseClarificationResult,
  validateClarificationAnswer,
} from '../src/lib/analyzeClarification';

test('MBTI case keeps multi-market ambiguous and business model missing', () => {
  const text = '做一个 MBTI 游戏，一款人格驱动的沉浸生活模拟手游。目标市场日本、欧美，20–30 岁的年轻用户，治愈系游戏。';
  const parsed = parseClarificationResult(text);
  assert.equal(parsed.fields.targetMarket.status, 'ambiguous');
  assert.equal(parsed.fields.businessModel.status, 'missing');
});

test('SaaS is not always forced to AI SaaS', () => {
  const text = '做一款面向企业运营团队的 SaaS 产品，目标市场日本。';
  const parsed = parseClarificationResult(text);
  assert.equal(parsed.fields.productType.value, 'SaaS 产品');
});

test('Cross-border keyword alone does not map to ecommerce tool', () => {
  const text = '做一款跨境协作平台，目标市场美国。';
  const parsed = parseClarificationResult(text);
  assert.notEqual(parsed.fields.productType.value, '跨境电商工具');
});

test('Target user recognizes en dash age range', () => {
  const text = '目标用户：20–30 岁，喜欢治愈系游戏的年轻用户';
  const parsed = parseClarificationResult(text);
  assert.equal(parsed.fields.targetUser.status, 'explicit');
});

test('Young users with constraints are not treated as broad', () => {
  const text = '目标用户：20–30 岁、喜欢治愈系游戏的年轻用户';
  const parsed = parseClarificationResult(text);
  assert.notEqual(parsed.fields.targetUser.status, 'ambiguous');
});

test('Single-line structured fields do not swallow each other', () => {
  const text = '产品类型：AI SaaS，目标市场：日本，目标用户：独立开发者，核心痛点：人工调研成本高，商业模式：订阅';
  const parsed = parseClarificationResult(text);
  assert.equal(parsed.fields.productType.value, 'AI SaaS');
  assert.equal(parsed.fields.targetMarket.value, '日本');
  assert.equal(parsed.fields.targetUser.value, '独立开发者');
  assert.equal(parsed.fields.painPoint.value, '人工调研成本高');
  assert.equal(parsed.fields.businessModel.value, '订阅');
});

test('Multi-line structured fields parse correctly', () => {
  const text = [
    '产品类型：SaaS 产品',
    '目标市场：美国',
    '目标用户：中小企业增长负责人',
    '核心痛点：多平台数据分散，复盘慢',
    '商业模式：订阅 / 月卡',
  ].join('\n');
  const parsed = parseClarificationResult(text);
  assert.equal(hasAllExplicit(parsed.fields), true);
});

test('Undecided answer is answered but not explicit', () => {
  const parsed = parseClarificationResult('做一款游戏产品，目标市场日本。');
  const next = applyFieldAnswer(parsed.fields, 'businessModel', '暂未确定');
  assert.equal(next.businessModel.status, 'missing');
  assert.equal(next.businessModel.value, '暂未确定');
  assert.equal(hasAllExplicit(next), false);
});

test('Custom market single value passes validation', () => {
  const result = validateClarificationAnswer('targetMarket', '韩国');
  assert.equal(result.ok, true);
});

test('Custom market with 日本、欧美 fails validation', () => {
  const result = validateClarificationAnswer('targetMarket', '日本、欧美');
  assert.equal(result.ok, false);
});

test('Custom market with 日本和美国 fails validation', () => {
  const result = validateClarificationAnswer('targetMarket', '日本和美国');
  assert.equal(result.ok, false);
});

test('Custom market 东南亚 passes as one region', () => {
  const result = validateClarificationAnswer('targetMarket', '东南亚');
  assert.equal(result.ok, true);
});

test('Custom empty value fails validation', () => {
  const result = validateClarificationAnswer('targetMarket', '   ');
  assert.equal(result.ok, false);
});

test('Failed custom market should not become explicit', () => {
  const validation = validateClarificationAnswer('targetMarket', '日本、欧美');
  assert.equal(validation.ok, false);
});

test('When all fields missing, primary questions are capped to 4', () => {
  const parsed = parseClarificationResult('想做个产品');
  assert.equal(parsed.unresolvedFields.length, 5);
  assert.equal(parsed.questions.length, 4);
});

test('URL seed keeps known market and product type', () => {
  const parsed = parseClarificationResult('面向海外用户，核心是自动生成素材。', {
    productType: 'AI SaaS',
    targetMarket: '日本',
  });
  assert.equal(parsed.fields.productType.status, 'explicit');
  assert.equal(parsed.fields.productType.value, 'AI SaaS');
  assert.equal(parsed.fields.targetMarket.status, 'explicit');
  assert.equal(parsed.fields.targetMarket.value, '日本');
});

test('Seed conflict keeps ambiguous and exposes conflict reason', () => {
  const parsed = parseClarificationResult('目标市场日本、欧美，做一款游戏产品。', {
    targetMarket: '日本',
  });
  assert.equal(parsed.fields.targetMarket.status, 'ambiguous');
  assert.equal(parsed.fields.targetMarket.reason?.includes('机会入口已指定“日本”'), true);
  assert.equal(parsed.fields.targetMarket.reason?.includes('日本、欧洲'), true);
});

test('No seed input should not expose seed conflict reason', () => {
  const parsed = parseClarificationResult('目标市场日本、欧美，做一款游戏产品。');
  assert.equal(parsed.fields.targetMarket.reason?.includes('机会入口已指定'), false);
});

test('merge keeps each structured field only once and avoids nested supplement', () => {
  const once = mergeStructuredBrief(
    '产品类型：AI SaaS，目标市场：日本，目标用户：独立开发者，核心痛点：人工调研成本高，商业模式：订阅',
    {
      productType: 'AI SaaS',
      targetMarket: '日本',
      targetUser: '独立开发者',
      painPoint: '人工调研成本高',
      businessModel: '订阅 / 月卡',
    },
  );
  const twice = mergeStructuredBrief(once, {
    productType: 'AI SaaS',
    targetMarket: '日本',
    targetUser: '独立开发者',
    painPoint: '人工调研成本高',
    businessModel: '订阅 / 月卡',
  });
  for (const label of ['产品类型：', '目标市场：', '目标用户：', '核心痛点：', '商业模式：']) {
    assert.equal((twice.match(new RegExp(label, 'g')) ?? []).length, 1);
  }
  assert.equal((twice.match(/产品补充说明：/g) ?? []).length <= 1, true);
});

test('Full brief should require no clarification', () => {
  const parsed = parseClarificationResult([
    '产品类型：AI SaaS',
    '目标市场：日本',
    '目标用户：独立开发者',
    '核心痛点：人工调研成本高',
    '商业模式：订阅 / 月卡',
  ].join('\n'));
  assert.equal(parsed.questions.length, 0);
  assert.equal(hasAllExplicit(parsed.fields), true);
});

test('Parsing new input should not inherit previous status', () => {
  const first = parseClarificationResult('产品类型：AI SaaS\n目标市场：日本\n目标用户：独立开发者\n核心痛点：人工调研成本高\n商业模式：订阅 / 月卡');
  assert.equal(hasAllExplicit(first.fields), true);
  const second = parseClarificationResult('做一个游戏产品');
  assert.equal(second.fields.businessModel.status, 'missing');
  assert.equal(hasAllExplicit(second.fields), false);
});
