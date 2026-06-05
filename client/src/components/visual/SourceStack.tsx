import type { EvidenceItem } from '../../types/hot';
import './VisualPrimitives.css';

type SourceLike = { source?: string };

export function SourceStack({ evidence }: { evidence?: Array<EvidenceItem | SourceLike> }) {
  const sources = [...new Set((evidence ?? []).map((item) => item.source).filter(Boolean))].slice(0, 3);
  return <div className="sourceStack">{sources.length > 0 ? sources.map((source) => <span key={source}>{source}</span>) : <span>待补来源</span>}</div>;
}
