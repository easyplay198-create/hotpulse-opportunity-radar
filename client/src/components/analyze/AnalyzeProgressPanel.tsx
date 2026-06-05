import type { AnalyzeStep } from '../../types/analyze';
import styles from '../../pages/AnalyzePage/AnalyzePage.module.css';

const DEFAULT_STEPS = ['解析产品方向', '检索市场信号', '匹配证据链', '扫描风险矩阵', '生成验证方案'];

interface AnalyzeProgressPanelProps {
  activeIndex: number;
  done: boolean;
  steps?: AnalyzeStep[];
}

export function AnalyzeProgressPanel({ activeIndex, done, steps }: AnalyzeProgressPanelProps) {
  return (
    <section className={styles.progressPanel} aria-label="分析过程">
      <div className={styles.sectionHeader}><h2>分析过程</h2><span>{done ? '已完成' : '分析中'}</span></div>
      <div className={styles.progressSteps}>
        {DEFAULT_STEPS.map((label, index) => {
          const status = done || index < activeIndex ? '已完成' : index === activeIndex ? '分析中' : '等待中';
          const summary = steps?.[index]?.summary ?? (index === activeIndex ? '正在处理当前步骤...' : '等待前置步骤完成');
          return <article key={label} className={styles.progressStep} data-status={status}><span className={styles.pulseDot} /><strong>{label}</strong><small>{status}</small><p>{summary}</p></article>;
        })}
      </div>
    </section>
  );
}
