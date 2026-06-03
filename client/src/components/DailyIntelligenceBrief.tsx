import { useState } from 'react';
import type { DailyBriefSourceStatus, DailyIntelligenceBrief, DailyIntelligenceBriefItem } from '../lib/buildDailyIntelligenceBrief';
import './DailyIntelligenceBrief.css';

interface DailyIntelligenceBriefProps {
  brief: DailyIntelligenceBrief;
  dataSource: DailyBriefSourceStatus;
  rawSignalCount: number;
  discoverableOpportunityCount: number;
}

interface BriefSectionConfig {
  key: keyof DailyIntelligenceBrief;
  title: string;
  description: string;
}

const SECTIONS: BriefSectionConfig[] = [
  { key: 'todayNew', title: '今日新增', description: '新出现的信号。' },
  { key: 'rising', title: '持续升温', description: '正在升温的方向。' },
  { key: 'worthValidating', title: '值得验证', description: '优先验证切口。' },
  { key: 'riskUp', title: '风险上升', description: '需要重点观察。' },
  { key: 'caseOrPattern', title: '案例 / 模式观察', description: '案例与模式。' },
];

function sourceLabel(item: DailyIntelligenceBriefItem) {
  if (item.sourceType === 'derived_from_real_signal') return '真实派生';
  if (item.sourceType === 'derived_from_mock_signal') return 'Mock 派生';
  if (item.sourceType === 'derived_from_fallback_seed') return 'Fallback 派生';
  return '手工样例';
}

function sourceBadge(item: DailyIntelligenceBriefItem) {
  if (item.sourceType === 'manual_seed') return '手工样例 · 非市场结论';
  if (item.sourceType === 'derived_from_mock_signal') return 'Mock 派生 · 需验证';
  if (item.sourceType === 'derived_from_fallback_seed') return 'Fallback 派生 · 需验证';
  return '真实派生 · 需验证';
}

function totalBriefItems(brief: DailyIntelligenceBrief) {
  return SECTIONS.reduce((sum, section) => sum + brief[section.key].length, 0);
}

function sourceDescription(dataSource: DailyBriefSourceStatus) {
  if (dataSource === 'real') return '今天先看最值得验证的 3 个市场机会，再看辅助情报。';
  if (dataSource === 'fallback') return '当前为 fallback seed 派生简报，仅用于展示结构。';
  return '当前为 mock 信号派生简报，仅用于展示结构。';
}

function insightShort(text: string) {
  return text.length > 38 ? `${text.slice(0, 38)}…` : text;
}

function BriefCard({ item }: { item: DailyIntelligenceBriefItem }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <article className="daily-brief-card">
      <div className="daily-brief-card__top">
        <span className={`daily-brief-card__source daily-brief-card__source--${item.sourceType}`}>{sourceLabel(item)}</span>
        <span className="daily-brief-card__strength">{item.evidenceStrength} · {sourceBadge(item)}</span>
      </div>
      <h4>{item.title}</h4>
      <p className="daily-brief-card__insight">{insightShort(item.opportunityInsight)}</p>
      <button className="daily-brief-card__toggle" type="button" onClick={() => setExpanded((value) => !value)}>
        {expanded ? '收起详情' : '展开详情'}
      </button>
      {expanded && (
        <div className="daily-brief-card__detail">
          <p className="daily-brief-card__meta">来源：{item.source} · 类型：{item.signalType} · 品类：{item.category}</p>
          <p><strong>摘要：</strong>{item.summary}</p>
          <p><strong>适合谁看：</strong>{item.suitableFor}</p>
          <p><strong>可验证方向：</strong>{item.validationDirection}</p>
        </div>
      )}
    </article>
  );
}

export function DailyIntelligenceBrief({
  brief,
  dataSource,
  rawSignalCount,
  discoverableOpportunityCount,
}: DailyIntelligenceBriefProps) {
  const totalItems = totalBriefItems(brief);

  return (
    <section className="daily-brief" aria-label="今日出海机会简报">
      <div className="daily-brief__header">
        <div>
          <p className="daily-brief__eyebrow">Daily Intelligence Brief</p>
          <h2>今日出海机会简报</h2>
          <p>{sourceDescription(dataSource)}</p>
        </div>
      </div>

      <div className="daily-brief__status" aria-label="简报数据状态">
        <span>数据源：<strong>{dataSource}</strong></span>
        <span>原始信号：<strong>{rawSignalCount}</strong> 条</span>
        <span>可追溯机会：<strong>{discoverableOpportunityCount}</strong> 条</span>
        <span>简报条目：<strong>{totalItems}</strong> 条</span>
      </div>

      <div className="daily-brief__heroNotice">
        <h3>今日出海机会简报 · 辅助信号</h3>
        <p>这里补充今日新增、持续升温、风险上升和案例观察，不重复上方主机会卡。</p>
      </div>

      <div className="daily-brief__sections">
        {SECTIONS.map((section) => {
          const item = brief[section.key][0];
          return (
            <section key={section.key} className="daily-brief-section">
              <div className="daily-brief-section__header">
                <h3>{section.title}</h3>
                <p>{section.description}</p>
              </div>
              {item ? <BriefCard item={item} /> : <p className="daily-brief-section__empty">暂无条目。</p>}
            </section>
          );
        })}
      </div>
      <p className="daily-brief__footnote">真实派生 · 需验证；手工样例 · 非市场结论。</p>
    </section>
  );
}
