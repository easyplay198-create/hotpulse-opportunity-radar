import type { KeyboardEvent } from 'react';
import styles from '../../pages/AnalyzePage/AnalyzePage.module.css';

interface Props {
  query: string;
  source: 'real' | 'mock' | 'fallback';
  analyzing: boolean;
  onQueryChange: (query: string) => void;
  onSubmit: () => void;
  onReset: () => void;
}

const EXAMPLES = [
  'AI 图片工具出海日本，面向独立设计师，订阅制',
  '开发者插件进入欧美市场，验证付费意愿',
  '陪伴型机器狗进入日本市场，验证养老陪伴场景',
] as const;

const GUIDE_PILLS = ['产品类型', '目标市场', '目标用户', '核心痛点', '商业模式'] as const;

export function AnalyzeWorkbench({ query, source, analyzing, onQueryChange, onSubmit, onReset }: Props) {
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') onSubmit();
  };

  return (
    <section className={styles.workbenchCard}>
      <div className={styles.workbenchContent}>
        <div className={styles.workbenchIntro}>
          <p className={styles.eyebrow}>验证工具 / source={source}</p>
          <h1>把一个产品方向，拆成可验证的市场 MVP 实验</h1>
          <p className={styles.workbenchSubtitle}>
            输入产品、目标市场、目标用户、痛点和商业模式，HotPulse 会先判断信息是否足够，再生成阶段化 MVP 验证计划。
          </p>
          <div className={styles.workbenchBullets}>
            <span>当前专注 AI / SaaS / App 出海团队</span>
            <span>先判断是否值得低成本验证</span>
            <span>信息越完整，验证结果越可靠</span>
          </div>
        </div>

        <div className={styles.workbenchCommand}>
          <div className={styles.commandInputShell}>
            <textarea
              className={styles.commandTextarea}
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="例如：AI 图片工具出海日本，面向独立设计师，订阅制，核心痛点是低成本生成电商素材"
              rows={5}
            />

            <div className={styles.commandGuide}>
              <span>请尽量包含：</span>
              <div className={styles.commandGuidePills}>
                {GUIDE_PILLS.map((item) => (
                  <span key={item} className={styles.commandGuidePill}>
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.commandActions}>
            <button type="button" className={styles.commandPrimaryButton} onClick={onSubmit} disabled={analyzing}>
              {analyzing ? '验证中...' : '开始验证'}
            </button>
            <button type="button" className={styles.commandSecondaryButton} onClick={onReset}>
              重新输入
            </button>
          </div>

          <div className={styles.exampleChipRow}>
            {EXAMPLES.map((item) => (
              <button key={item} type="button" className={styles.exampleChip} onClick={() => onQueryChange(item)}>
                {item}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
