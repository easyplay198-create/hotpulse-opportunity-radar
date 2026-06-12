import type { AnalyzeStep } from '../../types/analyze';
import styles from '../../pages/AnalyzePage/AnalyzePage.module.css';

const DEFAULT_STEPS = ['理解输入', '拆解假设', '匹配市场信号', '识别风险', '生成下一步动作'];

interface AnalyzeProgressPanelProps {
  activeIndex: number;
  done: boolean;
  steps?: AnalyzeStep[];
}

export function AnalyzeProgressPanel({ activeIndex, done, steps }: AnalyzeProgressPanelProps) {
  return (
    <section className={styles.progressPanel} aria-label="分析过程">
      <div className={styles.progressHeader}>
        <div>
          <span className={styles.panelEyebrow}>Analysis Progress</span>
          <h2>正在拆解市场验证路径</h2>
        </div>
        <strong>{done ? '已完成' : '分析中'}</strong>
      </div>
      <div className={styles.progressSteps}>
        {DEFAULT_STEPS.map((label, index) => {
          const status = done || index < activeIndex ? '已完成' : index === activeIndex ? '分析中' : '等待中';
          const summary = steps?.[index]?.summary ?? (index === activeIndex ? '正在处理当前步骤...' : '等待前置步骤完成');
          return (
            <article key={label} className={styles.progressStep} data-status={status}>
              <span className={styles.pulseDot} />
              <small>{String(index + 1).padStart(2, '0')}</small>
              <strong>{label}</strong>
              <p>{summary}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
