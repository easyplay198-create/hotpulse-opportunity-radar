import type { EvidenceStrength } from '../../types/hot';
import './VisualPrimitives.css';

const COPY: Record<EvidenceStrength, { label: string; width: string; tone: string }> = {
  high: { label: '强证据', width: '92%', tone: '#16a34a' },
  medium: { label: '中证据', width: '62%', tone: '#2563eb' },
  low: { label: '待补证据', width: '34%', tone: '#f59e0b' },
};

export function EvidenceMeter({ strength }: { strength: EvidenceStrength }) {
  const copy = COPY[strength];
  return <div className="evidenceMeter"><strong>{copy.label}</strong><div className="evidenceMeter__bar"><span style={{ width: copy.width, background: copy.tone }} /></div></div>;
}
