import { useEffect, useRef, useState } from 'react';
import type { HotItem } from '../types/hot';
import type { SmallTeamOpportunity } from '../lib/buildSmallTeamOpportunities';
import {
  type AdvisorAsset,
  type AdvisorAvoidDirection,
  type AdvisorBudget,
  type AdvisorCapability,
  type AdvisorGoal,
  type AdvisorMatchResult,
  type AdvisorProfile,
  type AdvisorWeeklyTime,
  matchAdvisorOpportunities,
} from '../lib/matchAdvisorOpportunities';
import {
  clearMigratedStorageItems,
  readMigratedJsonItem,
  STORAGE_KEY_MIGRATIONS,
  writeCurrentStorageItem,
} from '../lib/storageMigration';
import './OpportunityAdvisorPanel.css';

const PRODUCT_TYPES = ['AI 工具', '内容产品', '游戏', '短剧', '语聊', '开发者工具', '其他'];
const MARKETS = ['Global', 'Japan', 'Indonesia', 'Southeast Asia', 'Latin America', 'Middle East', 'US', '自定义'];
const STAGES = ['想法阶段', '已有 MVP', '已有产品', '想测试海外'];
const ASSETS: AdvisorAsset[] = ['还只是想法', '已有 MVP', '已有产品', '已有 App', '已有网站 / landing page', '已有用户', '已有内容 / 素材'];
const CAPABILITIES: AdvisorCapability[] = ['技术开发能力', '设计 / UI 能力', '内容生产能力', '社群 / 私域用户', '投放经验', '本地化能力', '支付 / 订阅接入经验', 'AI API / token 成本优势', 'App 上架经验', '行业客户资源', '还不确定'];
const GOALS: AdvisorGoal[] = ['需求是否存在', '用户是否愿意付费', '哪个国家更适合', '本地化是否有效', '获客成本是否可接受', '支付 / 订阅能不能跑通'];
const AVOID_DIRECTIONS: AdvisorAvoidDirection[] = ['不想重开发', '不想高投流', '不想高合规风险', '不想高 AI 成本', '不想做 App 上架', '还不确定'];
const BUDGETS: AdvisorBudget[] = ['暂不确定', '$0-$50：只做访谈 / 社区验证', '$50-$200：轻量 landing page / 小样本测试', '$200-$1000：小预算投放 / 多市场对比', '$1000-$5000：较完整 MVP 验证', '$5000+：准备正式进入', '自定义'];
const WEEKLY_TIMES: AdvisorWeeklyTime[] = ['1-3 小时', '3-8 小时', '8-20 小时', '20 小时以上'];

interface OpportunityAdvisorPanelProps {
  items: HotItem[];
  smallTeamOpportunities: SmallTeamOpportunity[];
  source: 'real' | 'mock' | 'fallback';
}

const DEFAULT_PROFILE: AdvisorProfile = {
  productType: 'AI 工具',
  targetMarket: 'Global',
  stage: '想法阶段',
  assets: ['还只是想法'],
  capabilities: [],
  validationGoals: ['需求是否存在'],
  avoidDirections: [],
  budgetRange: '暂不确定',
  weeklyTime: '3-8 小时',
  notes: '',
};

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function initialAdvisorProfile(): AdvisorProfile {
  if (typeof window === 'undefined') return DEFAULT_PROFILE;
  const savedProfile = readMigratedJsonItem(
    window.localStorage,
    STORAGE_KEY_MIGRATIONS.advisorProfile,
    isJsonRecord,
  );
  return savedProfile ? { ...DEFAULT_PROFILE, ...savedProfile } as AdvisorProfile : DEFAULT_PROFILE;
}

function initialAdvisorResult(): AdvisorMatchResult | null {
  if (typeof window === 'undefined') return null;
  return readMigratedJsonItem(
    window.localStorage,
    STORAGE_KEY_MIGRATIONS.advisorResult,
    isJsonRecord,
  ) as unknown as AdvisorMatchResult | null;
}

export function OpportunityAdvisorPanel({ items, smallTeamOpportunities, source }: OpportunityAdvisorPanelProps) {
  const [profile, setProfile] = useState<AdvisorProfile>(initialAdvisorProfile);
  const [recommendations, setRecommendations] = useState<AdvisorMatchResult | null>(initialAdvisorResult);
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(1);
  const [editing, setEditing] = useState(false);
  const skipNextProfileWriteRef = useRef(false);

  useEffect(() => {
    if (skipNextProfileWriteRef.current) {
      skipNextProfileWriteRef.current = false;
      return;
    }
    writeCurrentStorageItem(
      window.localStorage,
      STORAGE_KEY_MIGRATIONS.advisorProfile,
      JSON.stringify(profile),
    );
  }, [profile]);

  const stepLabels: Array<{ step: 1 | 2 | 3 | 4; label: string }> = [
    { step: 1, label: '产品' },
    { step: 2, label: '资源' },
    { step: 3, label: '验证目标' },
    { step: 4, label: '推荐结果' },
  ];

  const toggleProfileList = <T extends string>(key: 'assets' | 'capabilities' | 'validationGoals' | 'avoidDirections', value: T) => {
    setProfile((current) => {
      const list = current[key] as string[];
      return {
        ...current,
        [key]: list.includes(value) ? list.filter((item) => item !== value) : [...list, value],
      };
    });
  };

  const handleGenerate = () => {
    const result = matchAdvisorOpportunities(items, smallTeamOpportunities, profile);
    setRecommendations(result);
    setEditing(false);
    setActiveStep(4);
    writeCurrentStorageItem(
      window.localStorage,
      STORAGE_KEY_MIGRATIONS.advisorResult,
      JSON.stringify(result),
    );
  };

  const handleReset = () => {
    skipNextProfileWriteRef.current = true;
    setProfile({ ...DEFAULT_PROFILE });
    setRecommendations(null);
    clearMigratedStorageItems(window.localStorage, STORAGE_KEY_MIGRATIONS.advisorProfile);
    clearMigratedStorageItems(window.localStorage, STORAGE_KEY_MIGRATIONS.advisorResult);
  };

  const sourceParam = source === 'real' ? 'real' : 'mock';

  return (
    <section className="advisor-panel" aria-label="我的机会顾问">
      <div className="advisor-panel__header">
        <p className="advisor-panel__eyebrow">个性化机会匹配</p>
        <h2 className="advisor-panel__title">我的机会顾问</h2>
        <p className="advisor-panel__description">按产品、资源、验证目标逐步填写，生成适合优先小样本测试的机会建议。</p>
        {recommendations && <p className="advisor-panel__restoreHint">已恢复上次机会顾问结果，可继续查看或清空重填。</p>}
      </div>

      {recommendations && !editing ? (
        <div className="advisor-panel__resultSummary">
          <p className="advisor-panel__resultSummaryTitle">当前画像摘要</p>
          <p className="advisor-panel__resultSummaryText">{profile.productType} / {profile.targetMarket} / {profile.validationGoals[0] ?? '验证目标未选'} / {profile.budgetRange}</p>
          <button type="button" className="advisor-panel__secondary" onClick={() => setEditing(true)}>调整条件</button>
        </div>
      ) : (
        <div className="advisor-panel__steps" role="tablist" aria-label="机会顾问步骤">
          {stepLabels.map(({ step, label }) => (
            <button
              key={step}
              type="button"
              className={`advisor-panel__step${activeStep === step ? ' advisor-panel__step--active' : ''}`}
              onClick={() => setActiveStep(step)}
            >
              {step}. {label}
            </button>
          ))}
        </div>
      )}

      <div className={`advisor-panel__group${activeStep === 1 && (!recommendations || editing) ? ' advisor-panel__group--active' : ''}`}>
        <div className="advisor-panel__groupHeader"><h3>Step 1 · 你的产品</h3><p>先告诉我你现在有什么。</p></div>
        <div className="advisor-panel__section"><span className="advisor-panel__fieldTitle">当前状态</span><div className="advisor-panel__chips">{ASSETS.map((asset) => (<button key={asset} type="button" className={`advisor-panel__chip${profile.assets.includes(asset) ? ' advisor-panel__chip--active' : ''}`} onClick={() => toggleProfileList('assets', asset)}>{asset}</button>))}</div></div>
        <div className="advisor-panel__section advisor-panel__section--grid">
          <label>产品类型<select value={profile.productType} onChange={(event) => setProfile({ ...profile, productType: event.target.value })}>{PRODUCT_TYPES.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>当前阶段<select value={profile.stage} onChange={(event) => setProfile({ ...profile, stage: event.target.value })}>{STAGES.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>目标市场<select value={profile.targetMarket} onChange={(event) => setProfile({ ...profile, targetMarket: event.target.value })}>{MARKETS.map((item) => <option key={item}>{item}</option>)}</select></label>
          {profile.targetMarket === '自定义' && (<label>自定义市场<input value={profile.customMarket ?? ''} onChange={(event) => setProfile({ ...profile, customMarket: event.target.value })} placeholder="例如 Thailand / Mexico" /></label>)}
        </div>
      </div>

      <div className={`advisor-panel__group${activeStep === 2 && (!recommendations || editing) ? ' advisor-panel__group--active' : ''}`}>
        <div className="advisor-panel__groupHeader"><h3>Step 2 · 你的资源</h3><p>再告诉我你能投入什么。</p></div>
        <div className="advisor-panel__section"><span className="advisor-panel__fieldTitle">你有什么能力</span><div className="advisor-panel__chips">{CAPABILITIES.map((capability) => (<button key={capability} type="button" className={`advisor-panel__chip${profile.capabilities.includes(capability) ? ' advisor-panel__chip--active' : ''}`} onClick={() => toggleProfileList('capabilities', capability)}>{capability}</button>))}</div></div>
        <div className="advisor-panel__section advisor-panel__section--grid">
          <label>验证预算<select value={profile.budgetRange} onChange={(event) => setProfile({ ...profile, budgetRange: event.target.value as AdvisorBudget })}>{BUDGETS.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>每周可投入时间<select value={profile.weeklyTime} onChange={(event) => setProfile({ ...profile, weeklyTime: event.target.value as AdvisorWeeklyTime })}>{WEEKLY_TIMES.map((item) => <option key={item}>{item}</option>)}</select></label>
        </div>
      </div>

      <div className={`advisor-panel__group${activeStep === 3 && (!recommendations || editing) ? ' advisor-panel__group--active' : ''}`}>
        <div className="advisor-panel__groupHeader"><h3>Step 3 · 你的验证目标</h3><p>最后说清楚你想先验证什么。</p></div>
        <div className="advisor-panel__section"><span className="advisor-panel__fieldTitle">你想先验证什么</span><div className="advisor-panel__chips">{GOALS.map((goal) => (<button key={goal} type="button" className={`advisor-panel__chip${profile.validationGoals.includes(goal) ? ' advisor-panel__chip--active' : ''}`} onClick={() => toggleProfileList('validationGoals', goal)}>{goal}</button>))}</div></div>
        <div className="advisor-panel__section"><span className="advisor-panel__fieldTitle">你暂时不想碰什么</span><div className="advisor-panel__chips">{AVOID_DIRECTIONS.map((avoid) => (<button key={avoid} type="button" className={`advisor-panel__chip${profile.avoidDirections.includes(avoid) ? ' advisor-panel__chip--active' : ''}`} onClick={() => toggleProfileList('avoidDirections', avoid)}>{avoid}</button>))}</div></div>
        <label className="advisor-panel__notes">补充说明<textarea value={profile.notes} onChange={(event) => setProfile({ ...profile, notes: event.target.value })} placeholder="例如：我有日语内容资源，但预算有限，想先测试订阅转化。" /></label>
      </div>

      <div className="advisor-panel__actions">
        <button type="button" className="advisor-panel__generate" onClick={handleGenerate}>生成建议</button>
        <button type="button" className="advisor-panel__reset" onClick={handleReset}>清空重填</button>
        {recommendations && !editing && <button type="button" className="advisor-panel__secondary" onClick={() => setEditing(true)}>调整条件</button>}
      </div>

      {recommendations && (
        <div className={`advisor-panel__results${activeStep === 4 || (!editing ? ' advisor-panel__results--active' : '')}`.trim()}>
          <h3>Step 4 · 推荐结果</h3>
          <p className="advisor-panel__resultSummaryText advisor-panel__resultSummaryText--block">{profile.productType} / {profile.targetMarket} / {profile.validationGoals[0] ?? '验证目标未选'} / {profile.budgetRange}</p>
          {recommendations.bestMatch ? (
            <article className="advisor-panel__resultCard advisor-panel__resultCard--best">
              <div className="advisor-panel__resultTop"><h4>{recommendations.bestMatch.title}</h4><span>匹配分 {recommendations.bestMatch.fitScore}</span></div>
              <p><strong>为什么适合：</strong>{recommendations.bestMatch.reason}</p>
              <p><strong>下一步：</strong>{recommendations.bestMatch.firstStep}</p>
              <a className="advisor-panel__reportLink" href={`?source=${sourceParam}&report=${recommendations.bestMatch.sourceItemId}`}>查看验证报告</a>
            </article>
          ) : <p className="advisor-panel__emptyResult">暂无匹配机会，建议放宽市场或预算条件后再试。</p>}

          {recommendations.alternatives.length > 0 && (
            <div className="advisor-panel__resultGroup">
              <h3>备选验证方向</h3>
              {recommendations.alternatives.slice(0, 2).map((item) => (
                <article key={item.opportunityId} className="advisor-panel__resultCard">
                  <div className="advisor-panel__resultTop"><h4>{item.title}</h4><span>匹配分 {item.fitScore}</span></div>
                  <p><strong>为什么适合：</strong>{item.reason}</p>
                  <p><strong>下一步：</strong>{item.firstStep}</p>
                  <a className="advisor-panel__reportLink" href={`?source=${sourceParam}&report=${item.sourceItemId}`}>查看验证报告</a>
                </article>
              ))}
              {recommendations.alternatives.length > 2 && <p className="advisor-panel__moreHint">还有更多备选方向。</p>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
