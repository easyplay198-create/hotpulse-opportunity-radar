import type { AnalyzeProfile } from '../../types/analyze';
import styles from '../../pages/AnalyzePage/AnalyzePage.module.css';

interface AnalyzeAdvancedOptionsProps {
  profile: AnalyzeProfile;
  onChange: (profile: AnalyzeProfile) => void;
}

const STAGES = ['想法阶段', '已有 MVP', '已有产品', '已有用户'];
const MARKETS = ['Global', '日本', '印尼', '东南亚', '欧美', '拉美', '中东', '自定义'];
const BUDGETS = ['$0-$50', '$50-$200', '$200-$1000', '$1000+'];
const GOALS = ['需求是否存在', '用户是否愿意付费', '本地化是否有效', '获客成本是否可接受', '支付订阅能否跑通'];

export function AnalyzeAdvancedOptions({ profile, onChange }: AnalyzeAdvancedOptionsProps) {
  const update = (key: keyof AnalyzeProfile, value: string) => onChange({ ...profile, [key]: value });

  return (
    <details className={styles.advancedPanel}>
      <summary className={styles.advancedSummary}>
        <span>验证条件</span>
        <small>用于约束预算、市场和验证目标，不会改变原有提交逻辑。</small>
      </summary>
      <div className={styles.advancedGrid}>
        <label className={styles.advancedField}>
          <span>当前阶段</span>
          <select value={profile.productStage ?? '想法阶段'} onChange={(event) => update('productStage', event.target.value)}>
            {STAGES.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className={styles.advancedField}>
          <span>目标市场</span>
          <select value={profile.targetMarket ?? 'Global'} onChange={(event) => update('targetMarket', event.target.value)}>
            {MARKETS.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className={styles.advancedField}>
          <span>预算范围</span>
          <select value={profile.budgetRange ?? '$0-$50'} onChange={(event) => update('budgetRange', event.target.value)}>
            {BUDGETS.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className={styles.advancedField}>
          <span>验证目标</span>
          <select value={profile.validationGoal ?? '需求是否存在'} onChange={(event) => update('validationGoal', event.target.value)}>
            {GOALS.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
      </div>
    </details>
  );
}
