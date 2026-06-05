import './VisualPrimitives.css';

const STEPS = ['Day 1-2 表达页', 'Day 3 本地化文案', 'Day 4-5 小样本测试', 'Day 6 数据整理', 'Day 7 进入判断'];

export function ValidationTimelineMini() {
  return <div className="timelineMini">{STEPS.map((step) => <span key={step}>{step}</span>)}</div>;
}
