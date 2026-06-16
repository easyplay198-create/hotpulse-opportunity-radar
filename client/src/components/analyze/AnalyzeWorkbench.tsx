import type { KeyboardEvent } from 'react';
import styles from '../../pages/AnalyzePage/AnalyzePage.module.css';
import { sourceModeLabel } from './analyzePresentation';

interface Props {
  query: string;
  source: 'real' | 'mock' | 'fallback';
  analyzing: boolean;
  submitLabel?: string;
  submitDisabled?: boolean;
  onQueryChange: (query: string) => void;
  onSubmit: () => void;
  onReset: () => void;
}

const EXAMPLES = [
  'AI 图片工具出海日本，面向独立设计师，订阅制，核心痛点是低成本生成电商素材',
  '开发者插件进入欧美市场，面向独立开发者，验证订阅价格接受度',
  '陪伴型机器狗进入日本市场，面向独居老人家庭，硬件销售 + AI 陪伴订阅，验证养老陪伴场景',
] as const;

const GUIDE_ITEMS = [
  { title: '产品类型', desc: 'AI 工具、SaaS、App、游戏或硬件方向' },
  { title: '目标市场', desc: '例如日本、东南亚、欧美、美国或 Global' },
  { title: '目标用户', desc: '具体到人群、团队角色或购买者' },
  { title: '核心痛点', desc: '用户为什么现在需要解决这个问题' },
  { title: '商业模式', desc: '订阅、一次性付费、硬件 + 服务或广告' },
] as const;

function sourceLabel(source: Props['source']) {
  return sourceModeLabel(source);
}

export function AnalyzeWorkbench({
  query,
  source,
  analyzing,
  submitLabel,
  submitDisabled,
  onQueryChange,
  onSubmit,
  onReset,
}: Props) {
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !submitDisabled && !analyzing) onSubmit();
  };

  return (
    <section className={styles.workbenchCard} aria-label="验证 Brief 工作台">
      <div className={styles.workbenchHeader}>
        <div>
          <span className={styles.workbenchEyebrow}>INPUT BRIEF</span>
          <h2>验证 Brief 工作台</h2>
          <p>
            先把方向描述清楚，系统再判断是否值得进入市场 MVP 验证。信息越具体，风险、证据和动作越可执行。
          </p>
        </div>
        <span className={styles.sourceBadge}>{sourceLabel(source)}</span>
      </div>

      <div className={styles.workbenchGrid}>
        <div className={styles.commandInputShell}>
          <label className={styles.inputLabel} htmlFor="analyze-brief">
            描述你要验证的出海方向
          </label>
          <textarea
            id="analyze-brief"
            className={styles.commandTextarea}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="例如：AI 图片工具出海日本，面向独立设计师，订阅制，核心痛点是低成本生成电商素材。想验证是否有付费意愿、渠道是否可触达、价格是否成立。"
            rows={8}
          />
          <div className={styles.commandGuide}>
            <span>Ctrl / Cmd + Enter 可直接开始验证</span>
            <div className={styles.commandActions}>
              <button type="button" className={styles.commandPrimaryButton} onClick={onSubmit} disabled={analyzing || submitDisabled}>
                {analyzing ? '验证中...' : (submitLabel ?? '生成验证判断')}
              </button>
              <button type="button" className={styles.commandSecondaryButton} onClick={onReset}>
                重新输入
              </button>
            </div>
          </div>
        </div>

        <aside className={styles.briefChecklist} aria-label="验证 Brief 填写要点">
          <div className={styles.briefChecklistHeader}>
            <span>建议包含</span>
            <strong>5 个判断要点</strong>
          </div>
          {GUIDE_ITEMS.map((item) => (
            <div key={item.title} className={styles.briefChecklistItem}>
              <span className={styles.briefChecklistDot} />
              <div>
                <strong>{item.title}</strong>
                <p>{item.desc}</p>
              </div>
            </div>
          ))}
        </aside>
      </div>

      <div className={styles.exampleChipRow} aria-label="示例输入">
        {EXAMPLES.map((item) => (
          <button key={item} type="button" className={styles.exampleChip} onClick={() => onQueryChange(item)}>
            {item}
          </button>
        ))}
      </div>
    </section>
  );
}
