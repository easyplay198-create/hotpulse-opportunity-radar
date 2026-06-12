import styles from '../../pages/AnalyzePage/AnalyzePage.module.css';

type Props = {
  missing: string[];
  query: string;
  onExampleApply: (value: string) => void;
};

const QUALITY_FIELDS = [
  { label: '目标市场', help: '判断竞争、渠道、支付和本地化边界。' },
  { label: '目标用户', help: '确认谁会感到痛、谁可能付费。' },
  { label: '产品类型', help: '让系统识别替代方案与验证路径。' },
  { label: '使用场景 / 核心痛点', help: '决定是否值得进入低成本测试。' },
  { label: '商业模式 / 付费方式', help: '用于生成价格和停止门槛。' },
] as const;

const QUALITY_EXAMPLES = [
  'AI 图片工具出海日本，面向独立设计师，订阅制，核心痛点是低成本生成电商素材',
  '英语学习 App 进入日本市场，面向大学生和职场新人，订阅制，验证付费意愿',
  '陪伴型机器狗进入日本市场，面向独居老人家庭，硬件销售 + AI 陪伴订阅，验证养老陪伴场景',
] as const;

function fieldStatus(field: string, missing: string[]) {
  return missing.includes(field) ? '待补充' : '已识别';
}

export function AnalyzeInputQualityGate({ missing, query, onExampleApply }: Props) {
  const completedCount = QUALITY_FIELDS.length - missing.length;

  return (
    <section className={styles.qualityGate} aria-label={`输入质量门槛：${query}`}>
      <div className={styles.qualityHeader}>
        <div>
          <span className={styles.qualityEyebrow}>Input Quality Gate</span>
          <h2 className={styles.qualityTitle}>还差 {missing.length} 项关键信息，暂不进入验证</h2>
          <p className={styles.qualitySubtitle}>
            当前已识别 {completedCount}/5 项。HotPulse 会先拦截低质量输入，避免把不完整描述误判成市场结论。
          </p>
        </div>
        <div className={styles.qualityScoreBadge}>{completedCount}/5</div>
      </div>

      <div className={styles.qualityGrid}>
        {QUALITY_FIELDS.map((field) => {
          const isMissing = missing.includes(field.label);
          return (
            <div
              key={field.label}
              className={`${styles.qualityItem} ${isMissing ? styles.qualityItemMissing : styles.qualityItemActive}`}
            >
              <div className={styles.qualityItemTop}>
                <span className={styles.qualityCheckDot} />
                <strong className={styles.qualityItemStatus}>{fieldStatus(field.label, missing)}</strong>
              </div>
              <span className={styles.qualityItemLabel}>{field.label}</span>
              <p>{field.help}</p>
            </div>
          );
        })}
      </div>

      <div className={styles.qualityReason}>
        <strong>为什么现在不能开始验证</strong>
        <p>缺少市场、用户、场景或商业模式时，风险矩阵和行动计划只能是推测。先补齐 Brief，再进入低成本验证。</p>
      </div>

      <div className={styles.qualityExamples}>
        <div className={styles.qualityExampleTitle}>可以直接套用一个完整示例</div>
        <div className={styles.qualityExampleGrid}>
          {QUALITY_EXAMPLES.map((example) => (
            <button key={example} type="button" className={styles.qualityExampleButton} onClick={() => onExampleApply(example)}>
              {example}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
