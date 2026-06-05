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

const EXAMPLES = ['AI 英语学习工具出海日本', '开发者插件进入欧美市场', '短剧产品测试东南亚支付', 'AI 图片工具验证拉美订阅'];

export function AnalyzeWorkbench({ query, source, analyzing, onQueryChange, onSubmit, onReset }: Props) {
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') onSubmit();
  };

  return (
    <section className={styles.workbenchHero}>
      <div>
        <p className={styles.eyebrow}>验证工具 / source={source}</p>
        <h1>把你的出海想法，变成可验证的市场进入判断</h1>
        <p>输入产品、目标市场或竞品方向，HotPulse 会检索当前市场信号，匹配证据链，扫描进入风险，并生成 7 天 MVP 验证建议。</p>
      </div>
      <div className={styles.queryBox}>
        <textarea value={query} onChange={(event) => onQueryChange(event.target.value)} onKeyDown={handleKeyDown} placeholder="例如：我想做一个面向日本市场的 AI 英语学习工具" />
        <div className={styles.actionsRow}>
          <button type="button" className={styles.primaryButton} onClick={onSubmit} disabled={analyzing}>{analyzing ? '验证中...' : '开始验证'}</button>
          <button type="button" className={styles.ghostButton} onClick={onReset}>重新输入</button>
        </div>
        <div className={styles.chipRow}>{EXAMPLES.map((item) => <button key={item} type="button" onClick={() => onQueryChange(item)}>{item}</button>)}</div>
      </div>
    </section>
  );
}
