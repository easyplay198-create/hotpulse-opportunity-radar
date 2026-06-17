export type ClarificationFieldKey =
  | 'productType'
  | 'targetMarket'
  | 'targetUser'
  | 'painPoint'
  | 'businessModel';

export type ClarificationStatus = 'explicit' | 'ambiguous' | 'inferred' | 'missing';

export type ClarificationFieldState = {
  field: ClarificationFieldKey;
  label: string;
  status: ClarificationStatus;
  value: string;
  candidates?: string[];
  reason?: string;
};

export type ClarificationQuestionOption = {
  value: string;
  label: string;
  suggested?: boolean;
};

export type ClarificationValidationResult = {
  ok: boolean;
  message?: string;
  hint?: string;
};

export type ClarificationQuestion = {
  field: ClarificationFieldKey;
  label: string;
  prompt: string;
  helper: string;
  options: ClarificationQuestionOption[];
};

export type ClarificationParseSeed = Partial<Record<'productType' | 'targetMarket', string>>;

export type ClarificationResult = {
  fields: Record<ClarificationFieldKey, ClarificationFieldState>;
  unresolvedFields: ClarificationFieldKey[];
  questions: ClarificationQuestion[];
};

export type StructuredBriefConditions = Record<ClarificationFieldKey, string>;

const UNDECIDED_VALUE = '暂未确定';
const OTHER_VALUE = '其他，我自己填写';
const MAX_PRIMARY_QUESTIONS = 4;
const FIELD_ORDER: ClarificationFieldKey[] = ['targetMarket', 'painPoint', 'targetUser', 'businessModel', 'productType'];

const FIELD_LABELS: Record<ClarificationFieldKey, string> = {
  productType: '产品类型',
  targetMarket: '目标市场',
  targetUser: '目标用户',
  painPoint: '核心痛点',
  businessModel: '商业模式',
};

const LABEL_TO_FIELD: Record<string, ClarificationFieldKey> = Object.fromEntries(
  Object.entries(FIELD_LABELS).map(([field, label]) => [label, field as ClarificationFieldKey]),
) as Record<string, ClarificationFieldKey>;

const KNOWN_LABELS = Object.values(FIELD_LABELS).join('|');
const LABEL_PATTERN = new RegExp(`(${KNOWN_LABELS})[：:]`, 'g');

const PENDING_TOKENS = new Set(['', '待补充', '待确认', '未知', '不确定', '暂未确定']);
const FEATURE_HEAVY_TERMS = /功能|玩法|模块|系统|引擎|流程|协作|社区|事件|体验|效率|自动化/;
const PAIN_INDICATOR_TERMS = /痛点|问题|困难|阻力|挑战|需要|需求|成本|压力|低效|转化|留存/;

const REGION_RULES: Array<[RegExp, string]> = [
  [/日本|Japan/i, '日本'],
  [/美国|US|USA/i, '美国'],
  [/欧美|欧洲|欧盟|Europe/i, '欧洲'],
  [/东南亚|SEA|印尼|泰国|越南|马来西亚|菲律宾/i, '东南亚'],
  [/韩国|Korea/i, '韩国'],
  [/中东|MENA|阿联酋|沙特/i, '中东'],
  [/拉美|Latin|巴西|墨西哥/i, '拉美'],
  [/英语市场|英文市场|English market/i, '英语市场'],
  [/全球|Global/i, '全球'],
];

const PRODUCT_RULES: Array<[RegExp, string]> = [
  [/(?:AI|人工智能).{0,12}SaaS|SaaS.{0,12}(?:AI|人工智能)/i, 'AI SaaS'],
  [/SaaS/i, 'SaaS 产品'],
  [/(?:电商|选品|上架|商品运营|店铺运营).{0,10}(?:工具|平台|系统)?/i, '跨境电商工具'],
  [/游戏|手游|MMO|SLG|RPG/i, '游戏产品'],
  [/App|应用/i, '移动应用'],
  [/插件|extension/i, '效率工具'],
  [/工具|平台|系统/i, '数字工具'],
];

const BUSINESS_RULES: Array<[RegExp, string]> = [
  [/订阅|月卡|会员/, '订阅 / 月卡'],
  [/一次性|买断/, '一次性买断'],
  [/IAP|内购/i, '应用内购买'],
  [/广告/, '广告'],
  [/佣金|抽成/, '佣金 / 抽成'],
  [/服务费/, '服务费'],
  [/免费|暂不变现/, '免费产品，暂不考虑变现'],
];

const MARKET_OPTIONS: ClarificationQuestionOption[] = [
  { value: '日本', label: '日本' },
  { value: '美国', label: '美国' },
  { value: '欧洲', label: '欧洲' },
  { value: OTHER_VALUE, label: OTHER_VALUE },
  { value: UNDECIDED_VALUE, label: UNDECIDED_VALUE },
];

const BUSINESS_OPTIONS: ClarificationQuestionOption[] = [
  { value: '订阅 / 月卡', label: '订阅 / 月卡' },
  { value: '一次性买断', label: '一次性买断' },
  { value: '应用内购买', label: '应用内购买' },
  { value: '广告', label: '广告' },
  { value: '佣金 / 抽成', label: '佣金 / 抽成' },
  { value: '服务费', label: '服务费' },
  { value: '免费产品，暂不考虑变现', label: '免费产品，暂不考虑变现' },
  { value: OTHER_VALUE, label: OTHER_VALUE },
  { value: UNDECIDED_VALUE, label: UNDECIDED_VALUE },
];

function normalizeText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeFieldValue(value: string) {
  const normalized = normalizeText(value);
  return PENDING_TOKENS.has(normalized) ? '' : normalized;
}

function clipValueSegment(value: string) {
  const chars = ['\n', '\r', ';', '；'];
  let end = value.length;
  for (const char of chars) {
    const index = value.indexOf(char);
    if (index >= 0 && index < end) end = index;
  }
  return normalizeFieldValue(value.slice(0, end).replace(/^[，,]\s*/, '').replace(/[，,]\s*$/, ''));
}

function extractLabeledValues(query: string): Partial<Record<ClarificationFieldKey, string>> {
  const values: Partial<Record<ClarificationFieldKey, string>> = {};
  const matches = [...query.matchAll(LABEL_PATTERN)];
  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i];
    const label = match[1];
    const field = LABEL_TO_FIELD[label];
    if (!field || match.index === undefined) continue;
    const valueStart = match.index + match[0].length;
    const valueEnd = i + 1 < matches.length && matches[i + 1].index !== undefined ? matches[i + 1].index : query.length;
    const rawValue = query.slice(valueStart, valueEnd);
    const clipped = clipValueSegment(rawValue);
    if (clipped) values[field] = clipped;
  }
  return values;
}

function stripStructuredSegments(baseQuery: string) {
  const ranges: Array<{ start: number; end: number }> = [];
  const matches = [...baseQuery.matchAll(LABEL_PATTERN)];
  for (let i = 0; i < matches.length; i += 1) {
    const current = matches[i];
    if (current.index === undefined) continue;
    const nextStart = i + 1 < matches.length && matches[i + 1].index !== undefined
      ? matches[i + 1].index
      : baseQuery.length;
    const segment = baseQuery.slice(current.index, nextStart);
    const boundary = ['\n', '\r', ';', '；']
      .map((char) => segment.indexOf(char))
      .filter((index) => index >= 0)
      .sort((a, b) => a - b)[0];
    const end = boundary !== undefined ? current.index + boundary : nextStart;
    ranges.push({ start: current.index, end });
  }
  if (ranges.length === 0) return baseQuery.trim();
  let cursor = 0;
  let output = '';
  for (const range of ranges) {
    output += baseQuery.slice(cursor, range.start);
    cursor = range.end;
  }
  output += baseQuery.slice(cursor);
  return output
    .replace(/(^|\n)\s*产品补充说明[：:]/g, '$1')
    .replace(/[，,；;]+/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractSupplementText(baseQuery: string) {
  const matched = baseQuery.match(/产品补充说明[：:]\s*([\s\S]*)$/);
  if (matched?.[1]) return matched[1].trim();
  return baseQuery.trim();
}

function uniquePush(values: string[], next: string) {
  if (next && !values.includes(next)) values.push(next);
}

function inferProductType(text: string) {
  for (const [pattern, label] of PRODUCT_RULES) {
    if (pattern.test(text)) return label;
  }
  return '';
}

function inferMarketCandidates(text: string) {
  const candidates: string[] = [];
  for (const [pattern, label] of REGION_RULES) {
    if (pattern.test(text)) uniquePush(candidates, label);
  }
  return candidates;
}

function inferBusinessModel(text: string) {
  for (const [pattern, label] of BUSINESS_RULES) {
    if (pattern.test(text)) return label;
  }
  return '';
}

function inferTargetUser(text: string) {
  const direct = text.match(/(?:面向|目标用户|用户是|用户为)([^，。；\n]{2,56})/);
  if (direct?.[1]) return normalizeFieldValue(direct[1]);
  const age = text.match(/([0-9]{1,2}\s*(?:-|–|—|至)\s*[0-9]{1,2}\s*岁[^，。；\n]{0,36})/);
  if (age?.[1]) return normalizeFieldValue(age[1]);
  return '';
}

function inferPainPoint(text: string) {
  const direct = text.match(/(?:核心痛点|痛点|主要问题|需要解决)(?:是|为)?([^，。；\n]{4,120})/);
  if (direct?.[1]) return normalizeFieldValue(direct[1]);
  return '';
}

function productTemplateOptions(productType: string, field: ClarificationFieldKey): ClarificationQuestionOption[] {
  const isGame = /游戏/i.test(productType);
  const isEcommerceTool = /跨境电商工具/i.test(productType);
  const isSaas = /AI SaaS|SaaS 产品/i.test(productType);
  const isToolOrApp = /移动应用|效率工具|数字工具/i.test(productType);
  if (field === 'painPoint' && isGame) {
    return [
      { value: '缺少低压力、无强社交负担的陪伴体验', label: '缺少低压力、无强社交负担的陪伴体验', suggested: true },
      { value: '希望通过人格或选择探索自我', label: '希望通过人格或选择探索自我', suggested: true },
      { value: '传统社交产品即时互动压力较高', label: '传统社交产品即时互动压力较高', suggested: true },
      { value: '缺少可以长期参与和共同建设的社区', label: '缺少可以长期参与和共同建设的社区', suggested: true },
      { value: OTHER_VALUE, label: OTHER_VALUE },
      { value: UNDECIDED_VALUE, label: UNDECIDED_VALUE },
    ];
  }
  if (field === 'targetUser' && isEcommerceTool) {
    return [
      { value: '跨境卖家运营团队（有投放预算）', label: '跨境卖家运营团队（有投放预算）', suggested: true },
      { value: '独立站运营负责人', label: '独立站运营负责人', suggested: true },
      { value: OTHER_VALUE, label: OTHER_VALUE },
      { value: UNDECIDED_VALUE, label: UNDECIDED_VALUE },
    ];
  }
  if (field === 'targetUser' && isSaas) {
    return [
      { value: '中小企业增长负责人', label: '中小企业增长负责人', suggested: true },
      { value: '独立开发者 / 小团队创始人', label: '独立开发者 / 小团队创始人', suggested: true },
      { value: OTHER_VALUE, label: OTHER_VALUE },
      { value: UNDECIDED_VALUE, label: UNDECIDED_VALUE },
    ];
  }
  if (field === 'targetUser' && isToolOrApp) {
    return [
      { value: '18-24 岁学生与初入职场人群', label: '18-24 岁学生与初入职场人群', suggested: true },
      { value: '25-35 岁有明确任务需求的从业者', label: '25-35 岁有明确任务需求的从业者', suggested: true },
      { value: OTHER_VALUE, label: OTHER_VALUE },
      { value: UNDECIDED_VALUE, label: UNDECIDED_VALUE },
    ];
  }
  return [];
}

function fieldState(
  field: ClarificationFieldKey,
  status: ClarificationStatus,
  value: string,
  reason: string,
  candidates?: string[],
): ClarificationFieldState {
  return {
    field,
    label: FIELD_LABELS[field],
    status,
    value: normalizeFieldValue(value),
    reason,
    candidates,
  };
}

function isBroadTargetUser(value: string) {
  const normalized = normalizeText(value);
  const hasSpecificAgeRange = /[0-9]{1,2}\s*(?:-|–|—|至)\s*[0-9]{1,2}\s*岁/.test(normalized);
  const hasPersonaSignal = /喜欢|玩家|开发者|卖家|运营|学生|职场|创作者|团队|家庭|场景/.test(normalized);
  if (hasSpecificAgeRange || hasPersonaSignal) return false;
  return /所有人|全部|海外用户|泛用户|大众用户|年轻人/.test(normalized);
}

export function buildQuestionForField(
  field: ClarificationFieldKey,
  fields: Record<ClarificationFieldKey, ClarificationFieldState>,
): ClarificationQuestion {
  const current = fields[field];
  const productType = fields.productType.value || inferProductType(`${fields.productType.value} ${fields.painPoint.value}`);
  if (field === 'targetMarket') {
    return {
      field,
      label: FIELD_LABELS[field],
      prompt: '你希望先验证哪个首发市场？',
      helper: '不同市场的用户偏好、渠道、支付和本地化差异较大，建议首轮只选择一个。',
      options: current.candidates?.length
        ? [...current.candidates.map((item) => ({ value: item, label: item })), { value: OTHER_VALUE, label: '其他' }, { value: UNDECIDED_VALUE, label: UNDECIDED_VALUE }]
        : MARKET_OPTIONS,
    };
  }
  if (field === 'painPoint') {
    const template = productTemplateOptions(productType, 'painPoint');
    return {
      field,
      label: FIELD_LABELS[field],
      prompt: '目标用户为什么会持续需要这个产品？',
      helper: '功能描述不等于核心痛点，请选择用户目前最希望解决的问题。',
      options: template.length > 0
        ? template
        : [
          { value: '当前方案成本过高，难以持续', label: '当前方案成本过高，难以持续', suggested: true },
          { value: '现有流程复杂，执行效率低', label: '现有流程复杂，执行效率低', suggested: true },
          { value: '缺少稳定结果，效果不可预测', label: '缺少稳定结果，效果不可预测', suggested: true },
          { value: OTHER_VALUE, label: OTHER_VALUE },
          { value: UNDECIDED_VALUE, label: UNDECIDED_VALUE },
        ],
    };
  }
  if (field === 'targetUser') {
    const template = productTemplateOptions(productType, 'targetUser');
    return {
      field,
      label: FIELD_LABELS[field],
      prompt: '谁最可能成为第一批持续使用者？',
      helper: '建议具体到年龄段、身份或职业、已有行为和使用场景。',
      options: template.length > 0
        ? template
        : [
          { value: '18-24 岁学生与初入职场人群', label: '18-24 岁学生与初入职场人群', suggested: true },
          { value: '25-35 岁有明确任务需求的从业者', label: '25-35 岁有明确任务需求的从业者', suggested: true },
          { value: OTHER_VALUE, label: OTHER_VALUE },
          { value: UNDECIDED_VALUE, label: UNDECIDED_VALUE },
        ],
    };
  }
  if (field === 'businessModel') {
    return {
      field,
      label: FIELD_LABELS[field],
      prompt: '你准备通过什么方式获得收入？',
      helper: '变现路径会直接影响进入判断、验证动作和停止门槛。',
      options: BUSINESS_OPTIONS,
    };
  }
  return {
    field,
    label: FIELD_LABELS[field],
    prompt: '请确认你的产品类型。',
    helper: '产品类型用于匹配证据来源、竞品和验证路径。',
    options: [
      { value: 'AI SaaS', label: 'AI SaaS' },
      { value: 'SaaS 产品', label: 'SaaS 产品' },
      { value: '跨境电商工具', label: '跨境电商工具' },
      { value: '游戏产品', label: '游戏产品' },
      { value: '移动应用', label: '移动应用' },
      { value: OTHER_VALUE, label: OTHER_VALUE },
      { value: UNDECIDED_VALUE, label: UNDECIDED_VALUE },
    ],
  };
}

function applySeedIfNeeded(
  fields: Record<ClarificationFieldKey, ClarificationFieldState>,
  seed?: ClarificationParseSeed,
) {
  if (!seed) return fields;
  let next = { ...fields };
  const seedProduct = normalizeFieldValue(seed.productType ?? '');
  if (seedProduct && next.productType.status !== 'explicit') {
    next = {
      ...next,
      productType: fieldState('productType', 'explicit', seedProduct, '来自机会入口已确认信息。'),
    };
  }
  const seedMarket = normalizeFieldValue(seed.targetMarket ?? '');
  if (seedMarket) {
    if (next.targetMarket.status === 'ambiguous') {
      next = {
        ...next,
        targetMarket: {
          ...next.targetMarket,
          reason: `机会入口已指定“${seedMarket}”，但你的描述同时包含“${next.targetMarket.value || '多个市场'}”，请确认本轮首发市场。`,
        },
      };
    } else if (next.targetMarket.status !== 'explicit') {
      next = {
        ...next,
        targetMarket: fieldState('targetMarket', 'explicit', seedMarket, '来自机会入口已确认信息。'),
      };
    }
  }
  return next;
}

function buildFieldStates(
  query: string,
  seed?: ClarificationParseSeed,
): Record<ClarificationFieldKey, ClarificationFieldState> {
  const text = normalizeText(query);
  const labeled = extractLabeledValues(query);
  const labeledProductType = labeled.productType ?? '';
  const inferredProductType = inferProductType(text);
  const productType = labeledProductType || inferredProductType;
  const hasProductCue = /做一个|做一款|产品|工具|SaaS|游戏|App|应用|平台/.test(text);

  const labeledMarket = labeled.targetMarket ?? '';
  const inferredMarkets = inferMarketCandidates(text);
  const hasMarketCue = /目标市场|首发市场|先验证/.test(text);
  const hasMarketContext = /市场|地区|国家/.test(text);
  let marketState: ClarificationFieldState;
  if (labeledMarket) {
    const explicitCandidates = inferMarketCandidates(labeledMarket);
    if (explicitCandidates.length > 1) {
      marketState = fieldState('targetMarket', 'ambiguous', labeledMarket, '检测到多个目标市场，需要先确定首发市场。', explicitCandidates);
    } else {
      marketState = fieldState('targetMarket', 'explicit', labeledMarket, '用户已明确给出目标市场。');
    }
  } else if (hasMarketCue && inferredMarkets.length > 1) {
    marketState = fieldState('targetMarket', 'ambiguous', inferredMarkets.join('、'), '检测到多个目标市场，需要先确定首发市场。', inferredMarkets);
  } else if (hasMarketCue && inferredMarkets.length === 1) {
    marketState = fieldState('targetMarket', 'explicit', inferredMarkets[0], '用户在描述中明确给出了目标市场。');
  } else if (inferredMarkets.length > 1) {
    marketState = fieldState('targetMarket', 'ambiguous', inferredMarkets.join('、'), '检测到多个潜在市场，需要确认首发市场。', inferredMarkets);
  } else if (inferredMarkets.length === 1 && hasMarketContext) {
    marketState = fieldState('targetMarket', 'explicit', inferredMarkets[0], '用户在描述中给出了目标市场。');
  } else if (inferredMarkets.length === 1) {
    marketState = fieldState('targetMarket', 'inferred', inferredMarkets[0], '从描述中推断到可能市场，仍需确认。');
  } else {
    marketState = fieldState('targetMarket', 'missing', '', '未识别到目标市场。');
  }

  const labeledUser = labeled.targetUser ?? '';
  const inferredUser = inferTargetUser(text);
  const userValue = labeledUser || inferredUser;
  const hasUserCue = /面向|目标用户|第一批/.test(text);
  let userState: ClarificationFieldState;
  if ((labeledUser || (hasUserCue && inferredUser)) && !isBroadTargetUser(userValue)) {
    userState = fieldState('targetUser', 'explicit', userValue, '用户已明确给出目标用户。');
  } else if (userValue) {
    userState = fieldState(
      'targetUser',
      isBroadTargetUser(userValue) ? 'ambiguous' : (labeledUser ? 'ambiguous' : 'inferred'),
      userValue,
      isBroadTargetUser(userValue) ? '目标用户描述过宽，需要收窄到首批持续使用者。' : '从描述中推断到目标用户，仍需确认。',
    );
  } else if (productType) {
    userState = fieldState('targetUser', 'inferred', '', '可根据产品类型推断用户方向，但缺少明确对象。');
  } else {
    userState = fieldState('targetUser', 'missing', '', '未识别到目标用户。');
  }

  const labeledPainPoint = labeled.painPoint ?? '';
  const inferredPainPoint = inferPainPoint(text);
  const painPointValue = labeledPainPoint || inferredPainPoint;
  let painPointState: ClarificationFieldState;
  if (labeledPainPoint) {
    painPointState = fieldState('painPoint', 'explicit', labeledPainPoint, '用户已明确给出核心痛点。');
  } else if (painPointValue) {
    painPointState = fieldState('painPoint', 'inferred', painPointValue, '痛点为系统推断，需要确认。');
  } else if (FEATURE_HEAVY_TERMS.test(text) && !PAIN_INDICATOR_TERMS.test(text)) {
    painPointState = fieldState('painPoint', 'missing', '', '当前主要是功能描述，尚未形成核心痛点表达。');
  } else if (productType) {
    painPointState = fieldState('painPoint', 'inferred', '', '可根据产品类型推断痛点方向，但仍需你确认。');
  } else {
    painPointState = fieldState('painPoint', 'missing', '', '未识别到核心痛点。');
  }

  const labeledBusiness = labeled.businessModel ?? '';
  const inferredBusiness = inferBusinessModel(text);
  const businessValue = labeledBusiness || inferredBusiness;
  const hasBusinessCue = /商业模式|变现|订阅|内购|广告|买断|佣金|抽成|服务费|月卡/.test(text);
  const businessState = labeledBusiness
    ? fieldState('businessModel', 'explicit', labeledBusiness, '用户已明确给出商业模式。')
    : businessValue && hasBusinessCue
      ? fieldState('businessModel', 'explicit', businessValue, '用户在描述中明确给出了商业模式。')
      : businessValue
        ? fieldState('businessModel', 'inferred', businessValue, '商业模式由系统推断，需要确认。')
        : fieldState('businessModel', 'missing', '', '未识别到商业模式。');

  const productState = labeledProductType
    ? fieldState('productType', 'explicit', labeledProductType, '用户已明确给出产品类型。')
    : inferredProductType && hasProductCue
      ? fieldState('productType', 'explicit', inferredProductType, '用户在描述中明确给出了产品类型。')
      : inferredProductType
        ? fieldState('productType', 'inferred', inferredProductType, '产品类型由系统推断，需要确认。')
        : fieldState('productType', 'missing', '', '未识别到产品类型。');

  return applySeedIfNeeded({
    productType: productState,
    targetMarket: marketState,
    targetUser: userState,
    painPoint: painPointState,
    businessModel: businessState,
  }, seed);
}

export function parseClarificationResult(query: string, seed?: ClarificationParseSeed): ClarificationResult {
  const fields = buildFieldStates(query, seed);
  const unresolvedFields = FIELD_ORDER.filter((field) => fields[field].status !== 'explicit');
  const questions = unresolvedFields
    .slice(0, MAX_PRIMARY_QUESTIONS)
    .map((field) => buildQuestionForField(field, fields));
  return { fields, unresolvedFields, questions };
}

export function toStructuredConditions(fields: Record<ClarificationFieldKey, ClarificationFieldState>): StructuredBriefConditions {
  return {
    productType: normalizeFieldValue(fields.productType.value),
    targetMarket: normalizeFieldValue(fields.targetMarket.value),
    targetUser: normalizeFieldValue(fields.targetUser.value),
    painPoint: normalizeFieldValue(fields.painPoint.value),
    businessModel: normalizeFieldValue(fields.businessModel.value),
  };
}

export function applyFieldAnswer(
  fields: Record<ClarificationFieldKey, ClarificationFieldState>,
  field: ClarificationFieldKey,
  rawValue: string,
): Record<ClarificationFieldKey, ClarificationFieldState> {
  const normalizedRaw = normalizeText(rawValue);
  if (!normalizedRaw) return fields;
  const value = normalizeFieldValue(rawValue);
  const isUndecided = !value || normalizedRaw === UNDECIDED_VALUE;
  return {
    ...fields,
    [field]: {
      ...fields[field],
      value: isUndecided ? UNDECIDED_VALUE : value,
      status: isUndecided ? 'missing' : 'explicit',
      reason: isUndecided ? '仍未确认该项。' : '已由用户确认。',
      candidates: undefined,
    },
  };
}

export function countExplicitFields(fields: Record<ClarificationFieldKey, ClarificationFieldState>) {
  return FIELD_ORDER.filter((field) => fields[field].status === 'explicit').length;
}

export function hasAllExplicit(fields: Record<ClarificationFieldKey, ClarificationFieldState>) {
  return countExplicitFields(fields) === FIELD_ORDER.length;
}

export function mergeStructuredBrief(baseQuery: string, conditions: StructuredBriefConditions) {
  const strippedStructured = stripStructuredSegments(baseQuery);
  const strippedBase = extractSupplementText(strippedStructured);
  const lines = [
    `产品类型：${conditions.productType || UNDECIDED_VALUE}`,
    `目标市场：${conditions.targetMarket || UNDECIDED_VALUE}`,
    `目标用户：${conditions.targetUser || UNDECIDED_VALUE}`,
    `核心痛点：${conditions.painPoint || UNDECIDED_VALUE}`,
    `商业模式：${conditions.businessModel || UNDECIDED_VALUE}`,
  ];
  if (!strippedBase) return lines.join('\n');
  return `${lines.join('\n')}\n\n产品补充说明：\n${strippedBase}`;
}

function containsMultipleMarketTokens(value: string) {
  const normalized = normalizeText(value);
  if (!normalized) return false;
  if (/欧美/.test(normalized)) return true;
  if (/(和|\/|、|，|,)/.test(normalized)) return true;
  const inferred = inferMarketCandidates(normalized);
  return inferred.length >= 2;
}

export function validateClarificationAnswer(
  field: ClarificationFieldKey,
  rawValue: string,
): ClarificationValidationResult {
  const value = normalizeText(rawValue);
  if (!value) {
    return {
      ok: false,
      message: '请输入内容后再确认。',
    };
  }
  if (field !== 'targetMarket') {
    return { ok: true };
  }
  if (containsMultipleMarketTokens(value)) {
    return {
      ok: false,
      message: '首轮验证需要聚焦一个市场，请只填写一个国家或地区。',
      hint: '例如：韩国、英国或东南亚。',
    };
  }
  return { ok: true };
}

export function clarificationStatusLabel(status: ClarificationStatus) {
  if (status === 'explicit') return '已明确';
  if (status === 'ambiguous') return '有歧义';
  if (status === 'inferred') return '系统推断';
  return '待补充';
}
