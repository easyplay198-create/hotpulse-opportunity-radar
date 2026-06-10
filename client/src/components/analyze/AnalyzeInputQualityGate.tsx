import styles from '../../pages/AnalyzePage/AnalyzePage.module.css';

type Props = {
  missing: string[];
  query: string;
  onExampleApply: (value: string) => void;
};

const QUALITY_FIELDS = [
  '目标市场',
  '目标用户',
  '产品类型',
  '使用场景 / 核心痛点',
  '商业模式 / 付费方式',
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
  return (
    <section className={styles.qualityGate} aria-label={`输入质量门槛：${query}`}>
      <div className={styles.qualityHeader}>
        <div className={styles.qualityEyebrow}>Input Quality Gate</div>
        <h2 className={styles.qualityTitle}>当前信息还不足以做市场进入判断</h2>
        <p className={styles.qualitySubtitle}>
          HotPulse 需要先确认关键条件，否则只能生成低可信度推测。
        </p>
      </div>

      <div className={styles.qualityGrid}>
        {QUALITY_FIELDS.map((field) => {
          const isMissing = missing.includes(field);
          return (
            <div
              key={field}
              className={`${styles.qualityItem} ${isMissing ? styles.qualityItemMissing : styles.qualityItemActive}`}
            >
              <span>{field}</span>
              <strong className={styles.qualityItemStatus}>{fieldStatus(field, missing)}</strong>
            </div>
          );
        })}
      </div>

      <div className={styles.qualityExamples}>
        <div className={styles.qualityExampleTitle}>可以直接套用一个完整示例</div>
        {QUALITY_EXAMPLES.map((example) => (
          <button key={example} type="button" className={styles.qualityExampleButton} onClick={() => onExampleApply(example)}>
            {example}
          </button>
        ))}
      </div>
    </section>
  );
}
