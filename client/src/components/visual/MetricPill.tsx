import './VisualPrimitives.css';

export function MetricPill({ label, value, tone = 'blue' }: { label: string; value: string | number; tone?: 'blue' | 'green' | 'amber' | 'red' | 'gray' }) {
  return <span className={`metricPill metricPill--${tone}`}><span>{label}</span><strong>{value}</strong></span>;
}
